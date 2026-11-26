import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const $=id=>document.getElementById(id),assets=['tshirt','jacket','hoodie'];let seq=0,model=null;
try{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.01,100),renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;$('stage').append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xffffff,0x6c7067,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,3,4);scene.add(light);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const dispose=o=>{o?.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});};
 const resize=()=>{const w=$('stage').clientWidth,h=$('stage').clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}};new ResizeObserver(resize).observe($('stage'));resize();
 async function load(name){if(!assets.includes(name))return;const id=++seq;$('status').textContent='جاري تحميل '+name;$('download').hidden=true;const url='../assets/open-garments/clothing_'+name+'.glb';
 try{const {scene:root}=await new GLTFLoader().loadAsync(url);if(id!==seq){dispose(root);return;}root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root,true),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),max=Math.max(size.x,size.y,size.z);if(!Number.isFinite(max)||max<=0){dispose(root);throw Error('Invalid bounds');}
 if(model){scene.remove(model);dispose(model);}model=root;scene.add(root);controls.target.copy(center);camera.position.copy(center).add(new T.Vector3(max*.55,max*.2,max*2.6));camera.near=max*.001;camera.far=max*20;camera.updateProjectionMatrix();controls.update();
 let meshes=0,skins=0,bones=0;root.traverse(n=>{if(n.isMesh)meshes++;if(n.isSkinnedMesh)skins++;if(n.isBone)bones++;});$('status').textContent=name+' · '+meshes+' Mesh · '+skins+' SkinnedMesh · '+bones+' Bones';$('download').href=url;$('download').hidden=false;
 }catch(e){if(id===seq)$('status').textContent='تعذر التحميل: '+e.message;}}
 for(const b of document.querySelectorAll('[data-asset]'))b.onclick=()=>void load(b.dataset.asset);renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});void load('tshirt');
}catch(e){$('status').textContent='WebGL غير متاح: '+e.message;}
