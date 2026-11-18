import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createBagSpec,requiredBagViews,detectViewFromName,describeBagComponents,
  evaluateBagCapture,makeBagDraft,VIEW_LABELS} from './bag-spec.js';
import {buildModularBag} from './bag-model.js';

const $=id=>document.getElementById(id);
const inputKeys=['widthCm','heightCm','depthCm','style','material','closure','strapType',
  'strapCount','strapLengthCm','strapWidthCm','handlesCount','flexibility',
  'mainCompartments','innerOpenPockets','innerZippedPockets','outerPockets',
  'lining','bodyColor','logoPlacement','logoType','logoText'];
const state={photos:[],model:null,scene:null,renderer:null,camera:null,controls:null,
  raf:0,observer:null,renderReady:false,hasChanges:false,modelVersion:0,
  logoFile:null,logoObjectUrl:null,logoTexture:null,corrections:{}};
function gather(){
 const raw={};
 for(const key of inputKeys)raw[key]=$(key).value;
 raw.brandLicenseConfirmed=$('brand-rights').checked;
 return createBagSpec(raw);
}
function selectedPhotos(){
 return state.photos.map(p=>({name:p.file.name,bytes:p.file.size,
  width:p.width,height:p.height,view:p.view}));
}
function releaseImages(){
 for(const p of state.photos)URL.revokeObjectURL(p.url);
 state.photos=[];
}
function renderPhotoRequirements(){
 const spec=gather(),required=requiredBagViews(spec);
 const report=evaluateBagCapture(spec,selectedPhotos());
 const box=$('photo-requirements');box.textContent='';
 for(const view of required){
  const badge=document.createElement('span');
  badge.className='view-tag'+(report.viewsMissing.includes(view)?'':' ok');
  badge.textContent=(report.viewsMissing.includes(view)?'○ ':'✓ ')+VIEW_LABELS[view];
  box.append(badge);
 }
 $('photo-progress').textContent=(required.length-report.viewsMissing.length)+' / '+required.length;
 $('photo-quality').textContent=report.viewsMissing.length
  ? 'ناقص صور: '+report.viewsMissing.map(x=>VIEW_LABELS[x]).join('، ')
  : 'زوايا مكتملة كمدخلات، لكن المنتج لا يزال بحاجة لمراجعة هندسية';
 const missing=report.unobservedParts.length;
 $('capture-status').textContent='اكتمال الزوايا: '+report.completeness+'% · '+missing+
  ' أجزاء بدون مرجع بصري كافٍ · تقفيل الداخل والحركة ليسا موثقين/معتمدين تلقائيًا';
}
function renderPhotos(){
 const host=$('photos-list');host.textContent='';
 for(const photo of state.photos){
  const row=document.createElement('div');row.className='photo-row';
  const image=document.createElement('img');image.src=photo.url;
  image.alt=photo.file.name;image.loading='lazy';
  const detail=document.createElement('div');detail.className='photo-info';
  const title=document.createElement('strong');title.textContent=photo.file.name;
  const subtitle=document.createElement('small');
  subtitle.textContent=photo.width+'×'+photo.height;
  const select=document.createElement('select');
  select.setAttribute('aria-label','حدد زاوية '+photo.file.name);
  for(const [view,label]of Object.entries(VIEW_LABELS)){
   const opt=document.createElement('option');opt.value=view;opt.textContent=label;
   select.append(opt);
  }
  const unknown=document.createElement('option');unknown.value='unknown';unknown.textContent='غير محدد';
  select.append(unknown);select.value=photo.view;
  select.addEventListener('change',()=>{photo.view=select.value;renderPhotoRequirements();scheduleRebuild();});
  detail.append(title,subtitle,select);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';
  remove.setAttribute('aria-label','حذف '+photo.file.name);
  remove.addEventListener('click',()=>{
   URL.revokeObjectURL(photo.url);
   state.photos=state.photos.filter(p=>p!==photo);
   renderPhotos();renderPhotoRequirements();scheduleRebuild();
  });
  row.append(image,detail,remove);host.append(row);
 }
 renderPhotoRequirements();
}
async function loadImageInfo(file){
 const url=URL.createObjectURL(file);
 try {
  const img=new Image();img.src=url;await img.decode();
  return {file,url,width:img.naturalWidth,height:img.naturalHeight,
   view:detectViewFromName(file.name).view};
 }catch(err){URL.revokeObjectURL(url);return null;}
}
async function addPhotos(files){
 const known=new Set(state.photos.map(p=>p.file.name+'|'+p.file.size+'|'+p.file.lastModified));
 let skipped=0;
 for(const file of files){
  if(state.photos.length>=36){skipped++;continue;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)
    ||file.size<=0||file.size>10*1024*1024){skipped++;continue;}
  const key=file.name+'|'+file.size+'|'+file.lastModified;
  if(known.has(key))continue;
  known.add(key);
  const info=await loadImageInfo(file);
  if(info)state.photos.push(info);else skipped++;
 }
 renderPhotos();
 $('photo-quality').textContent=skipped?skipped+' صور تم تجاهلها، راجع نوع الملف/الحجم/الصلاحية':'تمت إضافة الصور محليًا';
 scheduleRebuild();
}
function getReviewedParts(){
 const parts=describeBagComponents(gather());
 const ids=new Set(parts.map(p=>p.id));
 for(const id of Object.keys(state.corrections))if(!ids.has(id))delete state.corrections[id];
 return parts.map(p=>{
  const correction=state.corrections[p.id];
  return correction ? {...p,behavior:correction.behavior,moving:correction.moving,
    joint:correction.moving?(p.joint||'manual-unassigned'):null,
    reviewedByMerchant:true,physicsImplemented:false}:p;
 });
}
function showPartProperties(){
 const p=getReviewedParts().find(v=>v.id===$('part-select').value);
 if(!p)return;
 $('part-behavior').value=['rigid','semi-rigid','flexible','surface-attached'].includes(p.behavior)
  ?p.behavior:'semi-rigid';
 $('part-movable').checked=p.moving===true;
}
function showParts(){
 const box=$('parts'),select=$('part-select');
 const selected=select.value;box.textContent='';select.textContent='';
 for(const p of getReviewedParts()){
  const element=document.createElement('span');element.className=p.moving?'movable':'';
  element.textContent=(p.moving?'↝ ':'■ ')+p.id+' · '+p.behavior+
   (p.reviewedByMerchant?' ✓':'');
  element.title=p.role+(p.joint?' / '+p.joint:'');
  box.append(element);
  const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.id;
  select.append(opt);
 }
 if([...select.options].some(o=>o.value===selected))select.value=selected;
 showPartProperties();
}
let rebuildTimer=null;
function scheduleRebuild(){
 $('flexibility-value').textContent=$('flexibility').value+'%';
 showParts();renderPhotoRequirements();
 if(!state.renderReady)return;
 clearTimeout(rebuildTimer);
 rebuildTimer=setTimeout(()=>{void buildAndRender();},180);
}
function ensureScene(){
 if(state.renderer)return;
 const host=$('stage');
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setClearColor(0x000000,0);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 host.append(renderer.domElement);
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xe9f7ee,0x344e40,3));
 const key=new THREE.DirectionalLight(0xffffff,3);
 key.position.set(2,4,5);scene.add(key);
 const fill=new THREE.DirectionalLight(0xd8edff,1.7);
 fill.position.set(-3,1,-2);scene.add(fill);
 const camera=new THREE.PerspectiveCamera(44,1,.01,100);
 camera.position.set(.48,.32,.75);camera.lookAt(0,0,0);
 const controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;controls.enablePan=false;
 controls.minDistance=.15;controls.maxDistance=5;
 state.scene=scene;state.renderer=renderer;state.camera=camera;state.controls=controls;
 const size=()=>{if(!state.renderer)return;
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 state.observer=new ResizeObserver(size);state.observer.observe(host);size();
 const tick=()=>{if(!state.renderer)return;
  controls.update();renderer.render(scene,camera);
  state.raf=requestAnimationFrame(tick);
 };
 tick();
}
function resetCamera(){
 if(!state.camera||!state.model)return;
 const bounds=new THREE.Box3().setFromObject(state.model.root);
 const middle=bounds.getCenter(new THREE.Vector3()),dim=bounds.getSize(new THREE.Vector3());
 const size=Math.max(dim.x,dim.y,dim.z,.2);
 state.controls.target.copy(middle);
 state.camera.position.set(middle.x+size*1.15,middle.y+size*.72,middle.z+size*1.75);
 state.camera.near=Math.max(.001,size*.001);state.camera.far=Math.max(20,size*40);
 state.camera.updateProjectionMatrix();
 state.controls.minDistance=size*.35;state.controls.maxDistance=size*8;
 state.controls.update();
}
async function getLogoTexture(){
 const match=state.photos.find(p=>p.view==='logo');
 if(!match||gather().logoPlacement==='none')return null;
 const loader=new THREE.TextureLoader();
 const texture=await loader.loadAsync(match.url);
 texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
 return texture;
}
async function buildAndRender(){
 const id=++state.modelVersion;
 ensureScene();
 const spec=gather();
 if(state.model){state.scene.remove(state.model.root);state.model.dispose();}
 state.model=buildModularBag(spec);
 state.model.parts=getReviewedParts();
 state.model.root.userData.parts=state.model.parts;
 state.model.root.userData.corrections=Object.entries(state.corrections).map(([id,value])=>({id,...value}));
 state.scene.add(state.model.root);
 $('stage-message').hidden=true;
 state.renderReady=true;
 state.model.setOpening(Number($('opening').value)/100);
 state.model.setSwing(Number($('swing').value)/100);
 state.model.setInterior($('show-inside').checked);
 resetCamera();
 showParts();renderPhotoRequirements();
 $('download-glb').disabled=false;$('download-json').disabled=false;
 const report=evaluateBagCapture(spec,selectedPhotos());
 $('model-status').textContent='المجسم مبني من '+state.model.parts.length+
  ' جزء طبقًا لأبعاد الهيكل. '+report.viewsMissing.length+
  ' زوايا ناقصة. الحركة توضيحية وليست محاكاة فيزيائية.';
 try{
  const logo=await getLogoTexture();
  if(id!==state.modelVersion){logo?.dispose();return;}
  state.model.setLogoTexture(logo);
 }catch(err){if(id===state.modelVersion)
  $('model-status').textContent+=' · صورة الشعار لم تُحمّل: '+err.message;}
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement('a');
 anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function exportGLB(){
 if(!state.model)return;
 const el=$('download-glb');el.disabled=true;
 $('model-status').textContent='جاري تجهيز GLB التجريبي على جهازك…';
 try{
  const exporter=new GLTFExporter();
  const data=await exporter.parseAsync(state.model.root,{
    binary:true,onlyVisible:false,trs:false,
    maxTextureSize:1024
  });
  if(!(data instanceof ArrayBuffer))throw new Error('لم يتم إنشاء ملف GLB');
  saveBlob(new Blob([data],{type:'model/gltf-binary'}),'rawnak-bag-structure-draft.glb');
  $('model-status').textContent='تم تصدير GLB · نموذج هيكلي تجريبي مع بيانات الأجزاء، وليس نسخة مطابقة للصور';
 }catch(err){
  $('model-status').textContent='تعذر تصدير GLB: '+err.message;
 }finally{el.disabled=false;}
}
function exportJSON(){
 const draft=makeBagDraft(gather(),selectedPhotos());
 draft.parts=getReviewedParts();
 draft.partCorrections=Object.entries(state.corrections).map(([id,value])=>({
   id,...value,source:'merchant-review',trainingAllowed:false,
   simulationImplemented:false
 }));
 draft.review={
  source:'merchant-structured-input+photos',
  userSuppliedPhotos:state.photos.length,
  brandImageAvailable:state.photos.some(p=>p.view==='logo'),
  rightsConfirmed:$('brand-rights').checked,
  hasLivePreview:Boolean(state.model),
  reportedMovingParts:draft.parts.filter(x=>x.moving).map(x=>({id:x.id,joint:x.joint})),
  approved:false,merchantReviewPending:true,AIModelTrainingConsent:false,
  note:'هذه البيانات غير مخصصة لتدريب أي نموذج تلقائيًا'
 };
 saveBlob(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),
  'rawnak-bag-parts-draft.json');
}
for(const key of inputKeys)$(key).addEventListener('input',scheduleRebuild);
$('brand-rights').addEventListener('change',renderPhotoRequirements);
$('photos-input').addEventListener('change',async event=>{
 await addPhotos([...event.target.files]);event.target.value='';
});
$('remove-photos').addEventListener('click',()=>{
 releaseImages();$('photos-input').value='';renderPhotos();scheduleRebuild();
});
$('generate').addEventListener('click',()=>void buildAndRender());
$('reset-view').addEventListener('click',resetCamera);
$('opening').addEventListener('input',()=>{
 $('opening-out').textContent=$('opening').value+'%';
 state.model?.setOpening(Number($('opening').value)/100);
});
$('swing').addEventListener('input',()=>{
 $('swing-out').textContent=$('swing').value+'%';
 state.model?.setSwing(Number($('swing').value)/100);
});
$('show-inside').addEventListener('change',()=>{
 state.model?.setInterior($('show-inside').checked);
});
$('part-select').addEventListener('change',showPartProperties);
$('save-part-correction').addEventListener('click',()=>{
 const id=$('part-select').value;
 if(!getReviewedParts().some(p=>p.id===id))return;
 state.corrections[id]={
   behavior:$('part-behavior').value,
   moving:$('part-movable').checked
 };
 if(state.model){
   state.model.parts=getReviewedParts();
   state.model.root.userData.parts=state.model.parts;
   state.model.root.userData.corrections=Object.entries(state.corrections)
     .map(([partId,data])=>({id:partId,...data}));
 }
 showParts();
 $('part-feedback').textContent='تم حفظ تصحيح '+id+
   ' كبيانات مراجعة فقط؛ تغيير المرونة هنا لا يشغّل فيزياء القماش أو يحرك مفصلًا غير مجهّز.';
});
$('download-json').addEventListener('click',exportJSON);
$('download-glb').addEventListener('click',()=>void exportGLB());
window.addEventListener('pagehide',()=>{
 clearTimeout(rebuildTimer);releaseImages();state.model?.dispose();
 if(state.raf)cancelAnimationFrame(state.raf);
 state.observer?.disconnect();state.controls?.dispose();state.renderer?.dispose();
 state.renderer?.domElement?.remove();state.renderer=null;
});
showParts();renderPhotoRequirements();
