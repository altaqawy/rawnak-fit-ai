import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(root,'src/fit-calibration.js'),'utf8');
const sandbox={};
runInNewContext(source,sandbox);
const {createPlacement,alphaBounds}=sandbox.RawnakFitCalibration;
const screen={width:400,height:620,project:(point,w,h)=>({x:point.x*w,y:point.y*h}),
  crop:{width:350,height:400,x:0,y:0},scale:1};
const fill=(count)=>Array.from({length:count},()=>({x:.5,y:.45,visibility:1,presence:1}));
const makeBody=()=>{
  const p=fill(33);
  p[11]={x:.34,y:.35,visibility:1};
  p[12]={x:.66,y:.35,visibility:1};
  p[23]={x:.4,y:.69,visibility:1};
  p[24]={x:.6,y:.69,visibility:1};
  return p;
};
const makeFace=()=>{
  const p=fill(478);
  p[33]={x:.4,y:.45};p[263]={x:.6,y:.45};p[1]={x:.5,y:.5};
  return p;
};
const makeHand=()=>{
  const p=fill(21);
  p[0]={x:.5,y:.63};p[5]={x:.43,y:.51};p[9]={x:.5,y:.49};p[17]={x:.57,y:.51};
  return p;
};
test('T-shirt is anchored at shoulders rather than accidentally covering the face',()=>{
  const pose=makeBody();
  const x=createPlacement('tee',pose,screen);
  assert.equal(x.ok,true);
  const shoulderY=pose[11].y*screen.height;
  assert.ok(x.y-x.height*.5>=shoulderY-x.height*.11,'photo top stays near shoulder line');
  assert.ok(x.width>70);
  assert.ok(x.metrics.shouldersPx>70);
  const bigger=createPlacement('tee',pose,{...screen,scale:1.2});
  assert.ok(bigger.width>x.width);
});
test('Missing hips or low visibility must suppress shirt, not guess anatomy',()=>{
  const pose=makeBody();pose[23].visibility=.1;
  const output=createPlacement('tee',pose,screen);
  assert.equal(output.ok,false);assert.match(output.reason,/الخصر|كتفيك/);
});
test('Deep side turn cannot be represented as accurate frontal 2D clothing',()=>{
  const world=fill(33);
  world[11]={x:-.13,y:0,z:.21};world[12]={x:.13,y:0,z:-.21};
  const output=createPlacement('tee',makeBody(),{...screen,worldLandmarks:world});
  assert.equal(output.ok,false);assert.match(output.reason,/3D/);
});
test('Bag requires both shoulders and hips and stays within display bounds',()=>{
  const bag=createPlacement('bag',makeBody(),screen);
  assert.equal(bag.ok,true);assert.ok(bag.x+bag.width/2<screen.width);
  const cropped=makeBody();cropped[24].y=1.05;
  assert.equal(createPlacement('bag',cropped,screen).ok,false);
});
test('Hand scale derives from palm width and wrist axis, not viewport width',()=>{
  const watch=createPlacement('watch',makeHand(),{...screen,crop:{width:280,height:490}});
  assert.equal(watch.ok,true);assert.ok(watch.width>40 && watch.width<80);
  assert.ok(Number.isFinite(watch.angle));
  const missing=makeHand();missing[17].x=-.3;
  assert.equal(createPlacement('watch',missing,screen).ok,false);
});
test('A frontal 2D glasses overlay is suppressed for pronounced head yaw',()=>{
  const face=makeFace();
  const opts={...screen,crop:{width:500,height:260}};
  assert.equal(createPlacement('glasses',face,opts).ok,true);
  face[1].x=.62;
  const result=createPlacement('glasses',face,opts);
  assert.equal(result.ok,false);assert.match(result.reason,/3D/);
});
test('Alpha crop gracefully falls back without DOM/decoded pixels',()=>{
  const crop=alphaBounds({naturalWidth:512,naturalHeight:512});
  assert.deepEqual({x:crop.x,y:crop.y,width:crop.width,height:crop.height},{x:0,y:0,width:512,height:512});
});
