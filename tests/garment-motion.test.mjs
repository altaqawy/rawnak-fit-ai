import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sandbox={};
runInNewContext(readFileSync(path.join(root,'src/fit-garment-motion.js'),'utf8'),sandbox);
runInNewContext(readFileSync(path.join(root,'src/fit-arm-occlusion.js'),'utf8'),sandbox);
const {targetSleeves,SleeveSpring,deformGarment}=sandbox.RawnakFitGarmentMotion;
const {restoreArms}=sandbox.RawnakFitArmOcclusion;
const project=(p,w,h)=>({x:p.x*w,y:p.y*h});
const params={width:400,height:600,project,scale:1};
const placement={ok:true,x:200,y:200,widthPx:180,heightPx:258,angle:0};
const land=()=>Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:1,presence:1}));
function body(){
  const p=land();
  p[11]={x:.3,y:.3,visibility:1};p[12]={x:.7,y:.3,visibility:1};
  p[23]={x:.36,y:.72,visibility:1};p[24]={x:.64,y:.72,visibility:1};
  p[13]={x:.19,y:.44,visibility:1};p[14]={x:.81,y:.44,visibility:1};
  p[15]={x:.16,y:.56,visibility:1};p[16]={x:.84,y:.56,visibility:1};
  return p;
}
test('sleeve solver stays neutral in resting pose and follows arms-up gestures',()=>{
 const p=body();
 const rest=targetSleeves(p,placement,project,400,600);
 assert.equal(rest.reliable,true);
 assert.ok(Math.abs(rest.left)<.5 && Math.abs(rest.right)<.5);
 p[13].y=.12;p[14].y=.12;
 const raised=targetSleeves(p,placement,project,400,600);
 assert.equal(raised.reliable,true);
 assert.ok(raised.left>.55,'left sleeve raises with left arm');
 assert.ok(raised.right<-.55,'right sleeve raises with right arm');
});
test('missing elbows does not turn garment upside down',()=>{
 const p=body();p[13].visibility=.01;p[14].visibility=.01;
 const out=targetSleeves(p,placement,project,400,600);
 assert.equal(out.reliable,false);
 assert.equal(out.left,0);assert.equal(out.right,0);
});
test('spring state is stable after slow frames and can reset',()=>{
 const spring=new SleeveSpring();
 const a=spring.update({left:1.1,right:-1.1},1000);
 assert.equal(a.left,1.1);assert.equal(a.right,-1.1);
 const b=spring.update({left:-1,right:1},16000);
 assert.ok(Math.abs(b.left)<1.3&&Math.abs(b.right)<1.3);
 assert.ok(b.energy>=0 && b.energy<=.1);
 spring.reset();
 assert.equal(spring.left,0);assert.equal(spring.vRight,0);
});
test('deformer only bends cloth sleeve vertices and retains original collar/hem',()=>{
 const rest=new Float32Array([
  -.87,.40,.12, -.47,.88,.12, 0,1.2,.12, .87,.40,.12
 ]);
 const animated=new Float32Array(rest.length);
 assert.equal(deformGarment(animated,rest,{left:1,right:-1,energy:.07,phase:.2}),true);
 assert.ok(animated[0]!==rest[0]||animated[1]!==rest[1]);
 assert.equal(animated[3],rest[3]);assert.equal(animated[4],rest[4]);
 assert.equal(animated[6],rest[6]);assert.equal(animated[7],rest[7]);
 assert.ok(animated[9]!==rest[9]||animated[10]!==rest[10]);
 assert.equal(deformGarment(animated,rest,{left:0,right:0,energy:0,phase:0}),true);
 assert.deepEqual([...animated],[...rest]);
});
function fakeCtx(){
 const calls={clip:0,drawImage:0,outerCaps:0};
 const ctx={
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},arc(...args){if(args[5]===true)calls.outerCaps++;},closePath(){},rect(){},
  clip(){calls.clip++;},drawImage(){calls.drawImage++;}
 };
 return {ctx,calls};
}
test('same-frame arm occlusion copies only a plausible crossed forearm',()=>{
 const p=body();
 p[13]={x:.45,y:.43,visibility:1};p[15]={x:.54,y:.53,visibility:1};
 p[14]={x:.86,y:.43,visibility:1};p[16]={x:.92,y:.52,visibility:1};
 const {ctx,calls}=fakeCtx();
 const count=restoreArms(ctx,{width:400,height:600},p,{...params});
 assert.equal(count,1);
 assert.equal(calls.drawImage,1);
 assert.equal(calls.clip,2,'torso + capsule clipping');
 assert.equal(calls.outerCaps,2,'rounded capsule caps must point outward, not self-intersect');
});
test('occlusion refuses hidden limbs and arms confirmed behind the torso',()=>{
 const p=body();p[13]={x:.45,y:.43,visibility:1};p[15]={x:.54,y:.53,visibility:1};
 p[14].visibility=0;p[16].visibility=0;
 let c=fakeCtx();
 assert.equal(restoreArms(c.ctx,{width:400,height:600},p,{...params,enabled:false}),0);
 const world=land();world[13].z=.22;world[15].z=.22;
 c=fakeCtx();
 assert.equal(restoreArms(c.ctx,{width:400,height:600},p,{...params,worldLandmarks:world}),0);
 p[15].visibility=0;
 c=fakeCtx();
 assert.equal(restoreArms(c.ctx,{width:400,height:600},p,{...params}),0);
});
test('camera and garment integrations keep occlusion only in synchronized mode',()=>{
 const app=readFileSync(path.join(root,'src/app.js'),'utf8');
 const html=readFileSync(path.join(root,'index.html'),'utf8');
 const renderer=readFileSync(path.join(root,'src/fit-3d-renderer.js'),'utf8');
 assert.ok(html.includes('id="garment-motion"'));
 assert.ok(html.includes('id="arm-occlusion"'));
 assert.ok(renderer.includes('updateGarment(category,landmarks,placement,options)'));
 assert.ok(renderer.includes('geometry.attributes.position'));
 assert.ok(app.includes('window.RawnakFitArmOcclusion.restoreArms(ctx,sampleCanvas'));
 const pos=app.indexOf('window.RawnakFitArmOcclusion.restoreArms(ctx,sampleCanvas');
 assert.ok(pos>app.indexOf('function renderSynchronizedFrame('));
 assert.ok(pos<app.indexOf('function renderLoop('));
 assert.ok(app.includes("garmentMotion:state.garmentMotion"));
});
