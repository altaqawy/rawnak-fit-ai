import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const motionSandbox={};
runInNewContext(readFileSync(path.join(root,'src/fit-garment-motion.js'),'utf8'),motionSandbox);
const windowStub={devicePixelRatio:1,RawnakFitGarmentMotion:motionSandbox.RawnakFitGarmentMotion};
const counters={render:0,normal:0,disposed:0};
class Node {
 constructor(){
  this.children=[];this.visible=true;this.userData={};
  this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
  this.rotation={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};
  this.scale={x:1,y:1,z:1,set(x,y,z){Object.assign(this,{x,y,z});},setScalar(x){this.set(x,x,x);}};
 }
 add(...items){this.children.push(...items);}
 traverse(fn){fn(this);for(const c of this.children)c.traverse?.(fn);}
 lookAt(){}updateProjectionMatrix(){}
}
class Geometry{
 constructor(){this.attributes={};this.index=[];}
 setAttribute(key,value){this.attributes[key]=value;return this;}
 setIndex(value){this.index=value;return this;}
 computeVertexNormals(){counters.normal++;}
 dispose(){counters.disposed++;}
}
class Attribute{
 constructor(data,size){this.array=new Float32Array(data);this.itemSize=size;this.count=data.length/size;}
}
class Mat{dispose(){counters.disposed++;}}
class Shape{moveTo(){}lineTo(){}quadraticCurveTo(){}closePath(){}}
class Mesh extends Node{constructor(g,m){super();this.geometry=g;this.material=m;}}
class Vec3{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
class Texture{constructor(){this.repeat={set(){}};}dispose(){counters.disposed++;}}
class Renderer{
 constructor({canvas}){this.canvas=canvas;}
 setClearColor(){}setPixelRatio(){}setSize(){}clear(){}
 render(){counters.render++;}
 dispose(){}
}
const THREE={
 Group:Node,Scene:Node,Mesh,MeshStandardMaterial:Mat,
 Shape,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,
 WebGLRenderer:Renderer,Vector3:Vec3,CatmullRomCurve3:Geometry,
 TubeGeometry:Geometry,BoxGeometry:Geometry,CylinderGeometry:Geometry,
 TorusGeometry:Geometry,SphereGeometry:Geometry,ExtrudeGeometry:Geometry,
 CircleGeometry:Geometry,CanvasTexture:Texture,
 HemisphereLight:Node,DirectionalLight:Node,OrthographicCamera:Node,
 DoubleSide:2,SRGBColorSpace:1,ACESFilmicToneMapping:2,RepeatWrapping:1000
};
const fakeDocument={
 createElement(tag){
  return {
   tag,width:400,height:600,setAttribute(){},remove(){},
   getContext:()=>({fillRect(){},fillStyle:''})
  };
 }
};
const source=readFileSync(path.join(root,'src/fit-3d-renderer.js'),'utf8')
 .replace(/^import \* as THREE from .*;\n/m,'')
 .replace(/^export /gm,'');
const clock={value:0};
const FakeDate={now(){clock.value+=50;return clock.value;}};
const Fit=new Function('THREE','window','document','Date',source+'\nreturn Fit3DRenderer;')
 (THREE,windowStub,fakeDocument,FakeDate);
const holder={clientWidth:480,clientHeight:640,append(el){el.parentElement=this;}};
const engine=new Fit(holder);
const shirt=engine.meshes.tee, jacket=engine.meshes.jacket;

test('new garment is a smooth round 3D shell rather than a shallow extrusion',()=>{
 const mesh=shirt.userData.garmentMesh;
 assert.equal(mesh.geometry.constructor,Geometry);
 assert.ok(mesh.geometry.attributes.position.count>1000);
 assert.ok(mesh.geometry.index.length/3>2000);
 assert.ok(shirt.userData.sleeves.left && shirt.userData.sleeves.right);
 const arr=mesh.geometry.attributes.position.array;
 const frontY=arr[1];
 const backY=arr[18*3+1];
 const shoulderY=arr[9*3+1];
 assert.ok(frontY>backY && backY>shoulderY,
  'front U-neck sits below the back neck and shoulder seam');
 assert.ok(shirt.userData.modelWidth>1.8);
 assert.ok(jacket.userData.sleeves.left,'jacket also uses curved fabric and pivot sleeves');
 assert.ok(mesh.material.map,'small woven texture is generated on client');
});

test('arm motion rotates separate sleeves without flattening chest geometry',()=>{
 const pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1,presence:1}));
 Object.assign(pose,{
  11:{x:.3,y:.3,visibility:1},12:{x:.7,y:.3,visibility:1},
  13:{x:.19,y:.44,visibility:1},14:{x:.81,y:.44,visibility:1},
  23:{x:.35,y:.7,visibility:1},24:{x:.65,y:.7,visibility:1}
 });
 const layout={ok:true,widthPx:160,heightPx:240,angle:0};
 const options={width:400,height:600,project:(p,w,h)=>({x:p.x*w,y:p.y*h}),garmentMotion:true};
 engine.updateGarment('tee',pose,layout,options);
 pose[13].y=.12;pose[14].y=.12;
 for(let i=0;i<12;i++)engine.updateGarment('tee',pose,layout,options);
 assert.ok(shirt.userData.sleeves.left.rotation.z>.25);
 assert.ok(shirt.userData.sleeves.right.rotation.z<-.25);
 assert.ok(Number.isFinite(shirt.userData.garmentMesh.geometry.attributes.position.array[0]));
 engine.updateGarment('tee',pose,layout,{...options,garmentMotion:false});
 assert.equal(shirt.userData.sleeves.left.rotation.z,0);
 assert.equal(shirt.userData.sleeves.right.rotation.z,0);
});

test('inspector sleeve slider rotates geometry and resets in neutral preview',()=>{
 assert.equal(engine.preview('tee',{sleeveAngle:.65,yaw:.8}),true);
 assert.ok(Math.abs(shirt.userData.sleeves.left.rotation.z-.65)<.001);
 assert.ok(Math.abs(shirt.userData.sleeves.right.rotation.z+.65)<.001);
 engine.preview('tee',{sleeveAngle:0});
 assert.equal(shirt.userData.sleeves.left.rotation.z,0);
 assert.equal(shirt.userData.sleeves.right.rotation.z,0);
 assert.ok(counters.render>=2);
});

test('the rounded garment does not break other 3D product categories',()=>{
 for(const cat of ['watch','bag','glasses','bracelet','shoes']){
  assert.equal(engine.preview(cat,{yaw:.4}),true,cat);
 }
});

test('disposing renderer releases both fabric and shared texture resources',()=>{
 engine.dispose();
 assert.equal(engine.destroyed,true);
 assert.ok(counters.disposed>0);
});
