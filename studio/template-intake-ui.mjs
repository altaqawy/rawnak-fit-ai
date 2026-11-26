import {inspectGLB,buildEntry,checksum} from './template-intake.mjs';
import {ROLES,collectParts,applyPart,makePartPlan,applyPlan} from './template-parts.mjs';
import {makeDemoBag} from './template-demo.mjs';
const $=id=>document.getElementById(id);
let revision=0,checked=null,live=null,parts=[],edits={},activePart=null;
function say(id,s){$(id).textContent=s;}
function fillOptions(select,values){select.replaceChildren();for(const [value,label] of Object.entries(values)){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}}
function showPart(){
 activePart=parts.find(p=>p.key===$('part-select').value)||null;
 const p=activePart;if(!p)return;
 const e=edits[p.key]||{role:p.role,scale:[1,1,1],visible:p.baseVisible,mobility:'unknown'};
 $('part-role').value=e.role;$('part-mobility').value=e.mobility||'unknown';
 for(const [i,k] of ['x','y','z'].entries()){$('part-'+k).value=Math.round(e.scale[i]*100);$('part-'+k).disabled=!p.editable;}
 $('part-visible').checked=e.visible;$('part-visible').disabled=!p.editable;
 say('part-status',p.editable?'تعديل محاور الجزء بالنسبة إلى الأصل؛ لا يضمن تطابق الخياطة.':'تعديل الشكل مقفل لجزء مرتبط بعظام أو Morph أو بأجزاء أخرى؛ يمكن تصنيفه.');
}
function initParts(model,stats){
 parts=collectParts(model);edits={};activePart=null;
 // Animation may drive transform properties on any node. Lock geometry edits
 // globally rather than making a misleading static approximation of motion.
 if(stats.animations||stats.skins)for(const p of parts)p.editable=false;
 fillOptions($('part-select'),Object.fromEntries(parts.map(p=>[p.key,p.name+' · '+ROLES[p.role]+' · '+p.key])));
 $('parts-editor').hidden=!parts.length;showPart();
}
function commitPart(){
 const p=activePart;if(!p)return;
 try{
  const e={role:$('part-role').value,mobility:$('part-mobility').value,scale:['x','y','z'].map(k=>Number($('part-'+k).value)/100),visible:$('part-visible').checked};
  edits[p.key]=applyPart(p,e);say('part-status','تم تحديث معاينة الجزء محليًا. الحركة وصف فقط، وليست أنيميشن.');
 }catch(e){say('part-status',e.message);}
}
fillOptions($('part-role'),ROLES);
$('part-select').addEventListener('change',showPart);
for(const k of ['role','mobility','x','y','z','visible'])$('part-'+k).addEventListener('input',commitPart);
$('part-reset').addEventListener('click',()=>{if(!activePart)return;const p=activePart;edits[p.key]=applyPart(p,{role:p.role,scale:[1,1,1],visible:p.baseVisible});showPart();});
function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('part-export').addEventListener('click',()=>{try{if(!checked)return;downloadJson(makePartPlan(parts,edits,checked.hash),'rawnak-parts.json');say('part-status','تم تنزيل خطة التعديل المرتبطة ببصمة الأصل.');}catch(e){say('part-status',e.message);}});
$('part-import').addEventListener('change',async e=>{const f=e.target.files[0],id=revision;if(!f||!checked)return;try{if(f.size>1024*1024)throw Error('ملف الخطة كبير');const plan=JSON.parse(await f.text());if(id!==revision)return;edits=applyPlan(parts,plan,checked.hash);showPart();say('part-status','تمت استعادة تعديلات الملف الأصلي.');}catch(err){say('part-status',err.message);}finally{e.target.value='';}});

function cleanup(){if(!live)return;cancelAnimationFrame(live.raf);live.observer.disconnect();live.controls.dispose();live.scene.traverse(o=>{o.geometry?.dispose();for(const m of (o.material?Array.isArray(o.material)?o.material:[o.material]:[])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});live.renderer.dispose();live.renderer.domElement.remove();live=null;}
async function preview(data,id,stats){
 const [three,{GLTFLoader},{OrbitControls}]=await Promise.all([import('three'),import('three/addons/loaders/GLTFLoader.js'),import('three/addons/controls/OrbitControls.js')]);
 if(id!==revision)return;
 const {scene:model}=await new GLTFLoader().parseAsync(data,'');
 if(id!==revision){model.traverse(o=>o.geometry?.dispose());return;}
 const box=new three.Box3().setFromObject(model),size=box.getSize(new three.Vector3()),max=Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(max)||max<=0)throw Error('Invalid model bounds');
 model.scale.multiplyScalar(2/max);box.setFromObject(model);model.position.sub(box.getCenter(new three.Vector3()));
 const scene=new three.Scene();scene.add(model,new three.HemisphereLight(0xffffff,0x586e62,2.2));const light=new three.DirectionalLight(0xffffff,2.5);light.position.set(2,3,4);scene.add(light);
 const renderer=new three.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=three.SRGBColorSpace;
 const camera=new three.PerspectiveCamera(42,1,.01,100);camera.position.set(2,1.4,4);
 const host=$('viewer');host.append(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(w&&h){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}};
 const observer=new ResizeObserver(resize);observer.observe(host);resize();
 const session={renderer,scene,controls,observer,raf:0};live=session;
 initParts(model,stats);
 const frame=()=>{if(live!==session)return;controls.update();renderer.render(scene,camera);session.raf=requestAnimationFrame(frame);};frame();$('empty').hidden=true;
}
async function loadTemplate(f){
 const id=++revision;checked=null;parts=[];edits={};activePart=null;$('parts-editor').hidden=true;cleanup();$('export').disabled=true;$('empty').hidden=false;say('metrics','');say('preview-status','');if(!f)return;
 say('status','جاري تدقيق الملف محليًا…');
 try{
  if(!/\.glb$/i.test(f.name)||f.size>20*1048576)throw Error('اختر GLB أقل من 20 MB');
  const data=await f.arrayBuffer();const stats=inspectGLB(data),hash=await checksum(data);if(id!==revision)return;
  say('metrics',stats.triangles+' مثلث · '+stats.meshes+' Mesh · '+stats.materials+' خامة · '+stats.skins+' Skin · '+stats.animations+' Animation');
  if(!$('asset-id').value)$('asset-id').value=f.name.replace(/\.glb$/i,'').toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/^[^a-z0-9]+/,'').slice(0,64);
  try{await preview(data,id,stats);}catch(e){if(id===revision)say('preview-status','تعذرت المعاينة: '+e.message);return;}
  if(id!==revision)return;
  checked={hash,stats};$('export').disabled=false;say('status','نجح التدقيق الأولي والمعاينة. راجع الحقوق قبل تصدير البيانات.');
 }catch(e){if(id===revision)say('status','رفض الملف: '+e.message);}
}
$('glb').addEventListener('change',()=>void loadTemplate($('glb').files[0]));
$('demo-template').addEventListener('click',async()=>{
 const request=++revision;$('demo-template').disabled=true;say('status','جاري توليد شنطة اختبار متعددة الأجزاء…');
 try{const f=await makeDemoBag();if(request!==revision)return;$('glb').value='';$('asset-id').value='rawnak-demo-bag';$('category').value='bag';$('license').value='';$('source').value='';$('confirmed').checked=false;await loadTemplate(f);}
 catch(e){if(request===revision)say('status','تعذر تجهيز النموذج: '+e.message);}
 finally{$('demo-template').disabled=false;}
});
$('intake').addEventListener('submit',e=>{
 e.preventDefault();if(!checked)return;
 try{const entry=buildEntry({id:$('asset-id').value,category:$('category').value,license:$('license').value,source:$('source').value,confirmed:$('confirmed').checked},checked.hash);
 const url=URL.createObjectURL(new Blob([JSON.stringify(entry,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=entry.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 say('status','تم تجهيز بيانات القالب؛ أضف الملف الأصلي إلى fusion/local-assets ثم سجله في المكتبة.');
 }catch(e){say('status',e.message);}
});window.addEventListener('pagehide',()=>{revision++;cleanup();});
