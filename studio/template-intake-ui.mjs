import {inspectGLB,buildEntry,checksum} from './template-intake.mjs';
const $=id=>document.getElementById(id);
let revision=0,checked=null,live=null;
function say(id,s){$(id).textContent=s;}
function cleanup(){if(!live)return;cancelAnimationFrame(live.raf);live.observer.disconnect();live.controls.dispose();live.scene.traverse(o=>{o.geometry?.dispose();for(const m of (o.material?Array.isArray(o.material)?o.material:[o.material]:[])){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});live.renderer.dispose();live.renderer.domElement.remove();live=null;}
async function preview(data,id){
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
 const frame=()=>{if(live!==session)return;controls.update();renderer.render(scene,camera);session.raf=requestAnimationFrame(frame);};frame();$('empty').hidden=true;
}
$('glb').addEventListener('change',async()=>{
 const id=++revision;checked=null;cleanup();$('export').disabled=true;$('empty').hidden=false;say('metrics','');say('preview-status','');const f=$('glb').files[0];if(!f)return;
 say('status','جاري تدقيق الملف محليًا…');
 try{
  if(!/\.glb$/i.test(f.name)||f.size>20*1048576)throw Error('اختر GLB أقل من 20 MB');
  const data=await f.arrayBuffer();const stats=inspectGLB(data),hash=await checksum(data);if(id!==revision)return;
  say('metrics',stats.triangles+' مثلث · '+stats.meshes+' Mesh · '+stats.materials+' خامة · '+stats.skins+' Skin · '+stats.animations+' Animation');
  if(!$('asset-id').value)$('asset-id').value=f.name.replace(/\.glb$/i,'').toLowerCase().replace(/[^a-z0-9_-]/g,'-').replace(/^[^a-z0-9]+/,'').slice(0,64);
  try{await preview(data,id);}catch(e){if(id===revision)say('preview-status','تعذرت المعاينة: '+e.message);return;}
  if(id!==revision)return;
  checked={hash,stats};$('export').disabled=false;say('status','نجح التدقيق الأولي والمعاينة. راجع الحقوق قبل تصدير البيانات.');
 }catch(e){if(id===revision)say('status','رفض الملف: '+e.message);}
});
$('intake').addEventListener('submit',e=>{
 e.preventDefault();if(!checked)return;
 try{const entry=buildEntry({id:$('asset-id').value,category:$('category').value,license:$('license').value,source:$('source').value,confirmed:$('confirmed').checked},checked.hash);
 const url=URL.createObjectURL(new Blob([JSON.stringify(entry,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=entry.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 say('status','تم تجهيز بيانات القالب؛ أضف الملف الأصلي إلى fusion/local-assets ثم سجله في المكتبة.');
 }catch(e){say('status',e.message);}
});window.addEventListener('pagehide',()=>{revision++;cleanup();});
