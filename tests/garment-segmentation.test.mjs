import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
runInNewContext(readFileSync(new URL('../src/fit-garment-segmentation.js',import.meta.url),'utf8'),sandbox);
const {buildAlpha,GarmentSegmenter}=sandbox.RawnakFitGarmentSegmentation;
const W=100,H=100;
function pose(){const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));p[11]={x:.3,y:.25};p[12]={x:.7,y:.25};p[23]={x:.35,y:.7};p[24]={x:.65,y:.7};p[13]={x:.15,y:.43};p[14]={x:.85,y:.43};return p;}
function categories(){const data=new Uint8Array(W*H);data.fill(4);for(let y=35;y<45;y++)for(let x=40;x<50;x++)data[y*W+x]=2;for(let y=25;y<33;y++)for(let x=45;x<55;x++)data[y*W+x]=1;data[50*W+55]=5;return data;}
const alpha=(r,x,y)=>r.rgba[(y*W+x)*4+3];
test('semantic mask includes clothes and rejects skin, hair, accessories and lower-body fabric',()=>{
 const r=buildAlpha(categories(),W,H,pose());assert.ok(r);assert.equal(alpha(r,35,50),255);assert.equal(alpha(r,45,40),0);assert.equal(alpha(r,50,28),0);assert.equal(alpha(r,55,50),0);assert.equal(alpha(r,56,50),0);assert.equal(alpha(r,50,90),0);
});
test('missing landmarks and empty or malformed masks fail closed',()=>{
 const p=pose();p[11].visibility=0;
 assert.equal(buildAlpha(categories(),W,H,p),null);
 assert.equal(buildAlpha(new Uint8Array(W*H),W,H,pose()),null);
 assert.equal(buildAlpha(new Uint8Array(2),W,H,pose()),null);
});
function fakeCanvas(){
 const calls=[];
 const ctx={calls,drawImage(...args){calls.push(['draw',this.globalCompositeOperation,...args]);},fillRect(){calls.push(['fill',this.globalCompositeOperation]);},clearRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){calls.push(['mask']);}};
 return {width:0,height:0,ctx,getContext(){return ctx;}};
}
test('same-frame semantic result is applied with destination-in and no stale mask on failure',()=>{
 const frames=[];let mask=categories();
 const model={segmentForVideo(frame,timestamp,cb){frames.push(timestamp);cb({categoryMask:mask?{width:W,height:H,getAsUint8Array:()=>mask}:null});},close(){}};
 const engine=new GarmentSegmenter(model,fakeCanvas),target=fakeCanvas();
 const source={width:640,height:480};const opts={width:320,height:240,color:'#aabbcc',timestamp:101};
 assert.equal(engine.apply(target.ctx,source,pose(),opts).ok,true);
 assert.equal(engine.input.width,320);assert.equal(engine.input.height,240);
 assert.ok(engine.layer.ctx.calls.some(c=>c[0]==='draw'&&c[1]==='destination-in'));
 assert.equal(target.ctx.calls.length,1);
 mask=null;
 assert.equal(engine.apply(target.ctx,source,pose(),{...opts,timestamp:202}).ok,false);
 assert.equal(target.ctx.calls.length,1);assert.deepEqual(frames,[101,202]);
 engine.close();assert.equal(engine.layer.width,1);
});
