import {PILOTS,VIEW_LABELS,getPilot,evaluatePilot,createAssetDraft,selectRecommendedRoute} from './asset-pipeline.js';
import {getCaptureProfile} from './capture-profiles.js';
import {estimateColorFromImageFile} from './photo-style.js';

const $=id=>document.getElementById(id);
const state={category:'tshirt',photos:[],viewer:null,glb:null,registry:null,visualEstimate:null};
const safeStatus=(id,text)=>{const node=$(id);if(node)node.textContent=text;};
const safeText=(el,text)=>{el.textContent=text;return el;};
const make=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;};
function makeInput(type,props={}){
  const el=document.createElement('input');el.type=type;
  for(const [k,v] of Object.entries(props))el[k]=v;return el;
}
function measureValues(){
  const result={};
  for(const [key] of PILOTS[state.category].measures)result[key]=$('measure-'+key)?.value||'';
  return result;
}
function draftInput(){
  return {
    category:state.category,
    name:$('name').value,sku:$('sku').value,variant:$('variant').value,
    photos:state.photos.map(p=>({name:p.file.name,bytes:p.file.size,
      width:p.width,height:p.height,view:p.view})),
    measurements:measureValues(),rightsConfirmed:$('rights-confirmed').checked,
    categoryConfirmed:$('category-confirmed').checked,
    localGlb:state.glb?{name:state.glb.name,bytes:state.glb.size}:null,
    visualEstimate:state.visualEstimate
  };
}
function resetStyle(){
  state.visualEstimate=null;
  $('style-swatch').style.background='transparent';
  safeStatus('style-status','ارفع صورة أمامية وحدد زاويتها ثم اضغط تحليل اللون');
}
async function runStyleAnalysis(){
  const photo=state.photos.find(p=>p.view==='front');
  if(!photo){
    safeStatus('style-status','حدد صورة واحدة على الأقل كزاوية أمامية الأول.');
    return;
  }
  safeStatus('style-status','جاري تحليل الصورة محليًا…');
  try{
    const result=await estimateColorFromImageFile(photo.file);
    state.visualEstimate=result;
    $('style-swatch').style.background=result.color||'transparent';
    safeStatus('style-status',result.color
      ? result.color+' · ثقة '+(result.confidence==='medium'?'متوسطة':'منخفضة')+' · لون تقريبي غير معتمد'
      : result.reason);
    refresh();
  }catch(error){safeStatus('style-status','تعذر تحليل اللون: '+(error?.message||error));}
}
function selectCategory(category){
  if(!getPilot(category))return;
  const prior=state.category;
  state.category=category;
  for(const btn of document.querySelectorAll('.pilot')){
    const selected=btn.dataset.category===category;
    btn.classList.toggle('active',selected);
    btn.setAttribute('aria-pressed',String(selected));
  }
  const holder=$('measurements');holder.textContent='';
  for(const [key,label,unit] of PILOTS[category].measures){
    const field=make('label');
    field.append(make('span',null,label+' ('+unit+')'));
    const input=makeInput('number',{id:'measure-'+key,min:'0.1',max:'5000',step:'0.1',
      inputMode:'decimal',placeholder:'أدخل القياس الفعلي'});
    input.addEventListener('input',refresh);
    field.append(input);holder.append(field);
  }
  // Avoid carrying category-specific assumptions or dimension claims across categories.
  if(category!==prior){
    resetStyle();
    state.photos.forEach(p=>p.view='angle');
    $('category-confirmed').checked=false;
    $('upload-glb').value='';
    removeModel();
  }
  renderPhotos();renderRoute();refresh();
}
function renderRoute(){
  const p=PILOTS[state.category],route=selectRecommendedRoute(state.category);
  $('route-family').textContent=p.family.toUpperCase()+' · '+p.model;
  $('route-template').textContent=p.recommendedTemplate;
  $('route-description').textContent='الأساس: '+route.primary+' · بديل تجريبي: '+route.secondary+
    ' · محرك اللايف: '+route.engine+' · لا يتم تشغيل إعادة بناء تلقائية في النسخة الحالية.';
  const sourceLinks=$('route-links');sourceLinks.textContent='';
  const recommended={tshirt:['garmentcode','swifttailor','patterngsl'],
    watch:['meshy','trellis2'],bag:['meshy','colmap','trellis2']};
  const providers=state.registry?.candidates||[];
  const matches=(recommended[state.category]||[])
    .map(id=>providers.find(x=>x.id===id)).filter(Boolean);
  const fallbacks={
    garmentcode:{name:'GarmentCode',url:'https://github.com/maria-korosteleva/GarmentCode'},
    swifttailor:{name:'SwiftTailor',url:'https://github.com/Qualcomm-AI-research/garment-gen'},
    patterngsl:{name:'PatternGSL',url:'https://lagrangeli.github.io/PatternGSL/'},
    meshy:{name:'Meshy',url:'https://docs.meshy.ai/en/api/multi-image-to-3d'},
    trellis2:{name:'TRELLIS.2',url:'https://github.com/microsoft/TRELLIS.2'},
    colmap:{name:'COLMAP',url:'https://colmap.github.io/'}
  };
  const items=matches.length?matches:(recommended[state.category]||[]).map(id=>fallbacks[id]);
  for(const source of items){
    if(!source||!/^https:\/\//.test(source.url))continue;
    const link=make('a',null,source.name);
    link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';sourceLinks.append(link);
  }
  const profile=getCaptureProfile(state.category);
  safeStatus('capture-advice','المقترح للتجربة '+profile.previewMin+' صور · لمراجعة أشمل '+
    profile.verifiedMin+'–'+profile.verifiedTarget+' صورة، مع جميع الزوايا الحقيقية.');
  $('capture-guide').href='./capture.html?category='+encodeURIComponent(state.category);
  $('model-reference').hidden=state.category!=='tshirt';
}
function renderPhotos(){
  const list=$('photo-list');list.textContent='';
  $('photo-count').textContent=state.photos.length+' صورة';
  for(const photo of state.photos){
    const row=make('div','photo-item');
    const image=make('img');image.src=photo.url;
    image.alt=photo.file.name;image.loading='lazy';
    const info=make('div','photo-info');
    info.append(make('strong',null,photo.file.name.slice(0,120)));
    info.append(make('small',null,photo.width+'×'+photo.height+
      ' · '+(photo.file.size/1048576).toFixed(1)+'MB'));
    const select=make('select');
    select.setAttribute('aria-label','زاوية تصوير '+photo.file.name);
    for(const [key,label] of Object.entries(VIEW_LABELS)){
      const opt=make('option',null,label);opt.value=key;select.append(opt);
    }
    select.value=photo.view;
    select.addEventListener('change',()=>{photo.view=select.value;resetStyle();refresh();});
    info.append(select);
    const remove=make('button',null,'×');remove.type='button';
    remove.setAttribute('aria-label','حذف الصورة '+photo.file.name);
    remove.addEventListener('click',()=>{
      state.photos=state.photos.filter(x=>x!==photo);
      URL.revokeObjectURL(photo.url);resetStyle();renderPhotos();refresh();
    });
    row.append(image,info,remove);list.append(row);
  }
}
async function probeImage(file){
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const image=new Image();
    const done=(w,h)=>resolve({file,url,width:w,height:h,view:'angle'});
    image.onload=()=>done(image.naturalWidth,image.naturalHeight);
    image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('تعذر قراءة '+file.name));};
    image.src=url;
  });
}
async function handlePhotos(files){
  const existing=new Set(state.photos.map(p=>p.file.name+'|'+p.file.size+'|'+p.file.lastModified));
  const added=[];
  for(const file of files){
    if(state.photos.length+added.length>=48)break;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1048576||file.size<=0)continue;
    const signature=file.name+'|'+file.size+'|'+file.lastModified;
    if(existing.has(signature))continue;
    existing.add(signature);
    try{added.push(await probeImage(file));}
    catch(e){safeStatus('qa-status',e.message);}
  }
  state.photos.push(...added);resetStyle();renderPhotos();refresh();
}
function refresh(){
  const input=draftInput(),report=evaluatePilot(input),p=PILOTS[state.category];
  $('qa-percent').textContent=report.qualityScore+'%';
  $('progress-fill').style.width=report.qualityScore+'%';
  $('qa-status').textContent=report.intakeReady
    ? 'المدخلات جاهزة لتجربة إعادة البناء — لم يتم توليد أو اعتماد نموذج بعد'
    : 'مدخلات ناقصة · لا يمكن الادعاء بوجود مجسم مطابق';
  const holder=$('qa-blockers');holder.textContent='';
  const success='✓ كل صور التجربة المبدئية والزوايا والمقاسات وحقوق الاستخدام مكتملة';
  if(report.intakeReady)holder.append(make('div','check-row pass',success));
  for(const item of report.blockers)holder.append(make('div','check-row','• '+item));
  const present=Object.entries(report.viewCounts).filter(([,n])=>n>0)
    .map(([view,n])=>VIEW_LABELS[view]+' '+n).join(' · ');
  if(present)holder.append(make('div','check-row pass','الزوايا المتاحة: '+present));
  safeStatus('processing-status',
    report.intakeReady
      ? 'ممكن تجهيز مهمة إعادة بناء لاحقًا؛ مزود الـAI والـGPU غير مربوطين حاليًا'
      : 'املا البيانات الناقصة، ثم صدّر خطة التجهيز للمراجعة. مفيش توليد 3D تلقائي.');
}
function downloadJson(){
  try{
    const draft=createAssetDraft(draftInput());
    const data=JSON.stringify(draft,null,2);
    const blob=new Blob([data],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=make('a');
    anchor.href=url;anchor.download='rawnak-asset-'+(draft.product.sku.replace(/[^a-z0-9_-]/gi,'_')||'draft')+'.json';
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    safeStatus('processing-status','تم إنشاء ملف خطة المنتج JSON. لم يتم إرسال أي صور.');
  }catch(error){safeStatus('processing-status','تعذر التصدير: '+error.message);}
}
async function copyReport(){
  const draft=draftInput(),report=evaluatePilot(draft),p=PILOTS[state.category];
  const message=['RAWNAK FIT / Asset Intake',p.label+' · '+(draft.name||'بدون اسم')+' · '+(draft.sku||'بدون SKU'),
    'اكتمال المدخلات: '+report.qualityScore+'%','عدد الصور: '+report.totalPhotos,
    'المسار: '+p.recommendedTemplate+' / '+p.primary,
    ...report.blockers.map(x=>'• '+x),
    'إعادة البناء لم تبدأ، ولا توجد موافقة تجارية أو مقاسات Fit مؤكدة.'].join('\n');
  try{
    await navigator.clipboard.writeText(message);
    safeStatus('processing-status','تم نسخ تقرير المراجعة.');
  }catch{safeStatus('processing-status','النسخ غير متاح في المتصفح، استخدم تصدير JSON.');}
}
let preview=null;
function cleanScene(){
  if(!preview)return;
  preview.disposed=true;
  preview.observer?.disconnect();
  cancelAnimationFrame(preview.raf);
  preview.controls?.dispose();
  preview.scene?.traverse(obj=>{
    obj.geometry?.dispose?.();
    if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material])
      .forEach(mat=>{for(const val of Object.values(mat))if(val?.isTexture)val.dispose();mat.dispose?.();});
  });
  preview.renderer?.dispose();
  preview.renderer?.domElement?.remove();
  preview=null;
}
function removeModel(){
  cleanScene();state.glb=null;
  $('model-placeholder').classList.remove('hidden');
  safeStatus('model-status','مافيش ملف GLB محمّل حاليًا. الاستيراد محلي وغير معتمد.');
}
function extractGlbJson(buffer){
  if(buffer.byteLength<28)throw new Error('ملف GLB غير صالح');
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
    view.getUint32(8,true)!==buffer.byteLength)throw new Error('ترويسة GLB v2 غير صحيحة');
  const len=view.getUint32(12,true);
  if(len<2||len>buffer.byteLength-20||view.getUint32(16,true)!==0x4e4f534a)
    throw new Error('جزء بيانات GLB غير صحيح');
  const text=new TextDecoder().decode(new Uint8Array(buffer,20,len));
  const gltf=JSON.parse(text);
  if(gltf.asset?.version!=='2.0'||!Array.isArray(gltf.meshes)||!gltf.meshes.length)
    throw new Error('الملف لا يحتوي شبكة glTF 2.0 صالحة');
  if((gltf.buffers||[]).some(b=>b.uri)||(gltf.images||[]).some(i=>i.uri))
    throw new Error('المعاينة تتطلب GLB مدمجًا بالكامل بدون روابط صور أو بيانات خارجية');
  if((gltf.extensionsRequired||[]).some(x=>!['KHR_materials_unlit','KHR_texture_transform'].includes(x)))
    throw new Error('يحتاج هذا النموذج إضافة ضغط/خامات غير مفعّلة في النسخة الأولى');
  if(gltf.meshes.length>60)throw new Error('عدد الشبكات الهندسية كبير للمعاينة على الموبايل');
  const accessors=gltf.accessors||[];
  let triangleEstimate=0;
  for(const mesh of gltf.meshes){
    for(const primitive of mesh.primitives||[]){
      if(primitive.mode!=null && primitive.mode!==4)
        throw new Error('يجب أن يحتوي النموذج على مثلثات TRIANGLES');
      const accessor=accessors[primitive.indices??primitive.attributes?.POSITION];
      const count=Number(accessor?.count)||0;
      if(!Number.isSafeInteger(count)||count<0)throw new Error('معلومات هندسة المجسم غير صحيحة');
      triangleEstimate+=count/3;
    }
  }
  if(triangleEstimate>250000)throw new Error('المجسم ثقيل جدًا للمعاينة: أكثر من 250 ألف مثلث');
  return gltf;
}
async function previewGlb(file){
  if(!file)return;
  if(!/\.glb$/i.test(file.name)||file.size>20*1048576||file.size<28){
    safeStatus('model-status','ارفع GLB حجمه أقل من 20MB');return;
  }
  cleanScene();state.glb=null;
  safeStatus('model-status','جاري تحليل ملف GLB على جهازك…');
  try{
    const data=await file.arrayBuffer(),meta=extractGlbJson(data);
    const [{default:three},loaderModule,orbitModule]=await Promise.all([
      import('three').then(mod=>({default:mod})),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/controls/OrbitControls.js')
    ]);
    const {GLTFLoader}=loaderModule,{OrbitControls}=orbitModule;
    const parsed=await new GLTFLoader().parseAsync(data,'');
    const scene=new three.Scene();
    const model=parsed.scene;
    const bounds=new three.Box3().setFromObject(model),size=new three.Vector3();
    bounds.getSize(size);
    if(!Number.isFinite(size.length())||size.length()<0.001)
      throw new Error('أبعاد المجسم غير صالحة');
    // Preview normalization is NOT a physical measurement or real sizing.
    const maxDim=Math.max(size.x,size.y,size.z);
    const normalized=Math.min(10,2.25/maxDim);
    model.scale.multiplyScalar(normalized);
    bounds.setFromObject(model);
    const center=new three.Vector3();bounds.getCenter(center);
    model.position.sub(center);
    scene.add(model);
    const camera=new three.PerspectiveCamera(45,1,.05,100);
    camera.position.set(0,1.2,4.5);camera.lookAt(0,0,0);
    scene.add(new three.HemisphereLight(0xeafbea,0x496858,2.8));
    const light=new three.DirectionalLight(0xffffff,2.4);
    light.position.set(2,4,5);scene.add(light);
    const container=$('model-stage');
    const renderer=new three.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
    renderer.outputColorSpace=three.SRGBColorSpace;
    renderer.toneMapping=three.ACESFilmicToneMapping;
    container.append(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.enableDamping=true;controls.enablePan=false;
    controls.minDistance=2;controls.maxDistance=8;
    const live={renderer,scene,controls,raf:0,observer:null,disposed:false};
    const resize=()=>{
      const w=container.clientWidth,h=container.clientHeight;
      if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
    };
    live.observer=new ResizeObserver(resize);live.observer.observe(container);resize();
    const animate=()=>{if(live.disposed)return;controls.update();renderer.render(scene,camera);live.raf=requestAnimationFrame(animate);};
    preview=live;animate();
    state.glb=file;$('model-placeholder').classList.add('hidden');
    let triangles=0;model.traverse(obj=>{
      if(obj.isMesh){const g=obj.geometry;triangles+=g.index?g.index.count/3:(g.attributes.position?.count||0)/3;}
    });
    safeStatus('model-status','تم فتح GLB محليًا · '+Math.round(triangles).toLocaleString()+
      ' مثلث · '+meta.meshes.length+' Mesh · للمعاينة فقط، غير معتمد.');
    refresh();
  }catch(error){
    cleanScene();state.glb=null;
    safeStatus('model-status','فشل عرض GLB: '+(error?.message||error));
  }
}
for(const button of document.querySelectorAll('.pilot'))
  button.addEventListener('click',()=>selectCategory(button.dataset.category));
$('upload-images').addEventListener('change',async e=>{
  await handlePhotos([...e.target.files]);e.target.value='';
});
$('upload-glb').addEventListener('change',async e=>{await previewGlb(e.target.files?.[0]);});
$('clear-photos').addEventListener('click',()=>{
  state.photos.forEach(p=>URL.revokeObjectURL(p.url));
  state.photos=[];$('upload-images').value='';resetStyle();renderPhotos();refresh();
});
$('reset-model').addEventListener('click',()=>{$('upload-glb').value='';removeModel();refresh();});
$('estimate-style').addEventListener('click',()=>void runStyleAnalysis());
$('download-manifest').addEventListener('click',downloadJson);
$('copy-report').addEventListener('click',()=>void copyReport());
for(const id of ['name','sku','variant','rights-confirmed','category-confirmed'])
  $(id).addEventListener('input',refresh);
window.addEventListener('pagehide',()=>{
  state.photos.forEach(p=>URL.revokeObjectURL(p.url));cleanScene();
});
const incoming=new URLSearchParams(location.search);
const incomingCategory=incoming.get('category');
selectCategory(Object.hasOwn(PILOTS,incomingCategory)?incomingCategory:'tshirt');
$('name').value=String(incoming.get('name')||'').slice(0,100);
$('sku').value=String(incoming.get('sku')||'').slice(0,64);
refresh();
void fetch('./asset-library-sources.json').then(res=>{
  if(!res.ok)throw new Error('registry unavailable');
  return res.json();
}).then(data=>{state.registry=data;renderRoute();}).catch(()=>renderRoute());
