import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sandbox={};
runInNewContext(readFileSync(path.join(root,'src/fit-clothing-swap.js'),'utf8'),sandbox);
const {getTorsoQuad,tintGarment}=sandbox.RawnakFitClothingSwap;
const project=(p,w,h)=>({x:p.x*w,y:p.y*h});
const pose=()=>{
  const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1,presence:1}));
  p[11]={x:.28,y:.27,visibility:1,presence:1};
  p[12]={x:.72,y:.27,visibility:1,presence:1};
  p[23]={x:.34,y:.76,visibility:1,presence:1};
  p[24]={x:.66,y:.76,visibility:1,presence:1};
  return p;
};
const opts={width:400,height:600,project};
function fakeCtx(){
  const calls=[];
  const ctx={
    canvas:{width:400,height:600},save:()=>calls.push('save'),
    restore:()=>calls.push('restore'),beginPath:()=>calls.push('begin'),
    moveTo:()=>calls.push('move'),lineTo:()=>calls.push('line'),
    closePath:()=>calls.push('close'),fill:()=>calls.push('fill')
  };
  return {ctx,calls};
}
test('garment tint only proceeds for good front-facing shoulder/hip anchors',()=>{
  const v=getTorsoQuad(pose(),opts);
  assert.equal(v.ok,true);
  assert.equal(v.points.length,4);
  assert.ok(v.shoulderWidth>100);
  const p=pose();p[23].visibility=0;
  assert.equal(getTorsoQuad(p,opts).ok,false);
  const side=pose();side[11].x=.50;side[12].x=.53;
  assert.equal(getTorsoQuad(side,opts).ok,false);
});
test('color transfer composes one quadrilateral on the existing same video frame',()=>{
  const {ctx,calls}=fakeCtx();
  const result=tintGarment(ctx,pose(),{...opts,color:'#aabbcc',strength:.85});
  assert.equal(result.ok,true);
  assert.deepEqual(calls,['save','begin','move','line','line','line','close','fill','restore']);
  assert.equal(ctx.globalCompositeOperation,'color');
  assert.equal(ctx.fillStyle,'#aabbcc');
  assert.equal(ctx.globalAlpha,.85);
});
test('bad pose or unsafe color does not paint the frame',()=>{
  const p=pose();p[12].visibility=0;
  const a=fakeCtx();
  assert.equal(tintGarment(a.ctx,p,{...opts,color:'#aabbcc'}).ok,false);
  assert.equal(a.calls.length,0);
  const b=fakeCtx();
  assert.equal(tintGarment(b.ctx,pose(),{...opts,color:'url(https://bad.example)'}).ok,false);
  assert.equal(b.calls.length,0);
});
test('UI exposes same-type opt-in without modifying bag category',()=>{
  const app=readFileSync(path.join(root,'src/app.js'),'utf8');
  const html=readFileSync(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes('id="clothing-swap-controls"'));
  assert.ok(html.includes('fit-clothing-swap.js'));
  assert.ok(html.indexOf('fit-clothing-swap.js')<html.indexOf('src/app.js'));
  assert.ok(app.includes("['tee','jacket'].includes(state.selected.id)"));
  assert.ok(app.includes("window.RawnakFitClothingSwap?.tintGarment"));
  assert.ok(app.includes("if (nextMode === 'fast' && state.assetMode === 'swap')"));
  assert.ok(app.includes("state.assetMode = '3d'"));
});
