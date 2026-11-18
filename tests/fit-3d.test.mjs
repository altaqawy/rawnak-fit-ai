import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(root,'src/fit-3d-pose.js'),'utf8');
const sandbox={};
runInNewContext(source,sandbox);
const {compute}=sandbox.RawnakFit3DPose;
const project=(p,w,h)=>({x:p.x*w,y:p.y*h});
const opts={width:400,height:630,project,scale:1};
const fill=n=>Array.from({length:n},()=>({x:.5,y:.5,z:0,visibility:1,presence:1}));
function pose(){
  const a=fill(33);
  a[11]={x:.33,y:.32,visibility:1,z:0};
  a[12]={x:.67,y:.32,visibility:1,z:0};
  a[23]={x:.39,y:.68,visibility:1,z:0};
  a[24]={x:.61,y:.68,visibility:1,z:0};
  a[27]={x:.43,y:.86,visibility:1,z:0};
  a[28]={x:.57,y:.86,visibility:1,z:0};
  a[31]={x:.43,y:.92,visibility:1,z:0};
  a[32]={x:.57,y:.92,visibility:1,z:0};
  return a;
}
function hand(){
  const a=fill(21);
  a[0]={x:.5,y:.62,z:0};a[5]={x:.42,y:.51,z:0};
  a[17]={x:.58,y:.51,z:0};a[9]={x:.5,y:.46,z:0};
  return a;
}
function face(){
  const a=fill(478);
  a[33]={x:.40,y:.40,z:0};a[263]={x:.60,y:.40,z:0};
  a[1]={x:.5,y:.48,z:0};return a;
}

test('3D shirt collar follows shoulders; positive screen Y points toward hips',()=>{
  const p=pose();
  const out=compute('tee',p,opts);
  assert.equal(out.ok,true);
  assert.ok(Math.abs(out.y-p[11].y*opts.height)<25);
  assert.ok(out.heightPx>120);
  assert.ok(out.widthPx>100);
  assert.ok(Math.abs(out.angle)<.01,'upright garment must not invert');
});
test('3D bag is near hip, not free-floating and needs actual torso visibility',()=>{
  const p=pose();
  const b=compute('bag',p,opts);
  assert.equal(b.ok,true);
  assert.ok(b.y>p[11].y*opts.height);
  assert.ok(b.y<p[24].y*opts.height+15);
  p[23].visibility=.02;
  const partial=compute('bag',p,opts);
  assert.equal(partial.ok,true,'bag stays attached to visible shoulder');
  assert.equal(partial.approximate,true,'cropped hips must mark pose as approximate');
});
test('3D watch points to hand and scales with palm width, not viewport width',()=>{
  const p=hand();
  const s=compute('watch',p,opts);
  assert.equal(s.ok,true);
  assert.ok(s.widthPx>=25);
  assert.ok(Math.abs(s.angle)<.01,'when fingers are above wrist, 3D band stays vertical');
  const bigger=compute('watch',p,{...opts,scale:1.25});
  assert.ok(bigger.widthPx>s.widthPx);
});
test('3D face frame can yaw, preserving a visible model for side turns',()=>{
  const p=face();
  const a=compute('glasses',p,opts);
  assert.equal(a.ok,true);
  p[1].x=.57;
  const b=compute('glasses',p,opts);
  assert.equal(b.ok,true);
  assert.ok(Math.abs(b.yaw)>.4);
});
test('3D dress-independent demo supports watch, bangle, glasses, shirt, jacket, bag, shoes',()=>{
  assert.equal(compute('bracelet',hand(),opts).ok,true);
  assert.equal(compute('jacket',pose(),opts).ok,true);
  assert.equal(compute('shoes',pose(),opts).ok,true);
  assert.equal(compute('ring',hand(),opts).ok,false,'unimplemented product must be explicitly rejected');
});
test('missing hips allow explicitly approximate 3D, missing shoulders/hand suppress guess',()=>{
  const p=pose();
  p[23]={x:1.18,y:.68,visibility:.9};
  const incomplete=compute('tee',p,opts);
  assert.equal(incomplete.ok,true);
  assert.equal(incomplete.approximate,true);
  p[11].visibility=.01;
  assert.equal(compute('tee',p,opts).ok,false);
  const w=hand();w[17].visibility=.01;
  assert.equal(compute('watch',w,opts).ok,false);
});
test('video 3D pipeline uses actual depth meshes and synchronous compositing',()=>{
  const renderer=readFileSync(path.join(root,'src/fit-3d-renderer.js'),'utf8');
  const app=readFileSync(path.join(root,'src/app.js'),'utf8');
  const html=readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(renderer.includes('new THREE.WebGLRenderer('));
  assert.ok(renderer.includes('THREE.ExtrudeGeometry'),'real volumetric depth for bag and clothes');
  assert.ok(renderer.includes('new THREE.CylinderGeometry'),'3D watch face');
  assert.ok(renderer.includes('new THREE.TorusGeometry'),'glasses and bangle geometry');
  assert.ok(renderer.includes("new THREE.OrthographicCamera("));
  assert.ok(renderer.includes('preserveDrawingBuffer:true'),'sync compositor can sample WebGL pixels');
  assert.ok(app.includes("state.three.render(state.selected.id"),'models render using MediaPipe pose');
  assert.ok(app.includes("ctx.drawImage(output.canvas,0,0,w,h)"),'3D output composed with matching camera frame');
  assert.ok(html.includes('id="asset-3d"'),'merchant 3D preview selectable');
  assert.ok(html.includes('fit-3d-pose.js'),'geometry solver loaded');
  assert.ok(!html.includes('ALPHA 0.7 · BODY CALIBRATION'),'new 3D build deployed');
});
