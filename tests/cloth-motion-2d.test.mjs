import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
for(const f of ['fit-product-transfer.js','fit-cloth-motion-2d.js','fit-garment-cutout.js','fit-garment-segmentation.js'])runInNewContext(readFileSync(new URL('../src/'+f,import.meta.url),'utf8'),sandbox);
const {ClothSpring,subdivide,deform,profiles}=sandbox.RawnakFitClothMotion;
const {buildMesh,defaultAnchors,drawCutout}=sandbox.RawnakFitGarmentCutout;
const {GarmentSegmenter}=sandbox.RawnakFitGarmentSegmentation;
function pose(shift=0){
 const p=Array.from({length:33},()=>({x:.5+shift,y:.5,visibility:1}));
 Object.assign(p,{11:{x:.32+shift,y:.27},12:{x:.68+shift,y:.27},13:{x:.24+shift,y:.48},14:{x:.76+shift,y:.48},15:{x:.19+shift,y:.77},16:{x:.81+shift,y:.77},23:{x:.38+shift,y:.71},24:{x:.62+shift,y:.71}});
 return p;
}
const asset=(sleeves='short')=>({canvas:{width:400,height:500},sleeves,anchors:defaultAnchors(sleeves)});
test('material springs have bounded different responses and clear history after a tracking gap',()=>{
 const offsets={};
 for(const name of ['cotton','silk','denim']){
  const spring=new ClothSpring();
  assert.equal(spring.update(pose(),100,name).x,0);
  const v=spring.update(pose(.05),200,name);offsets[name]=Math.abs(v.x);
  assert.ok(v.x<0&&Math.abs(v.x)<=profiles[name].limit);
  assert.equal(spring.update(pose(.08),1000,name).x,0);
  spring.update(pose(.09),1100,name);const lost=pose();lost[11].visibility=.01;
  assert.equal(spring.update(lost,1200,name).x,0);assert.equal(spring.last,null);
 }
 assert.ok(offsets.silk>offsets.denim);
});
test('mesh subdivision preserves shared edges and pins every exterior point',()=>{
 for(const type of ['short','long']){
  const base=buildMesh(asset(type),pose(),640,480),fine=subdivide(base),moved=deform(base,{x:.02,y:.01},640,480);
  assert.equal(fine.triangles.length,base.triangles.length*4);
  assert.equal(moved.vertices.length,fine.vertices.length);
  for(const i of fine.pinned){assert.equal(fine.vertices[i].x,moved.vertices[i].x);assert.equal(fine.vertices[i].y,moved.vertices[i].y);}
  assert.ok(moved.vertices.some((p,i)=>Math.abs(p.x-fine.vertices[i].x)>.01));
 }
});
test('extreme motion cannot invert triangles or move vertices outside frame',()=>{
 const base=buildMesh(asset(),pose(),640,480),fine=subdivide(base),moved=deform(base,{x:99,y:-99},640,480);
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 for(const t of moved.triangles){const a=cross(...t.map(i=>fine.vertices[i])),b=cross(...t.map(i=>moved.vertices[i]));assert.ok(a*b>0);assert.ok(Math.abs(b)>=Math.abs(a)*.5);}
 assert.ok(moved.vertices.every(p=>p.x>=0&&p.x<=640&&p.y>=0&&p.y<=480));
});
function canvas(){
 const calls=[];const ctx={calls,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},transform(...m){calls.push(['transform',...m]);},drawImage(...args){calls.push(['draw',this.globalCompositeOperation,...args]);},clearRect(){},fillRect(){},createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};
 return{width:0,height:0,ctx,getContext(){return ctx;}};
}
test('cloth preview subdivides only when enabled and retains semantic clipping',()=>{
 const a=asset(),out=canvas();
 assert.equal(drawCutout(out.ctx,a,pose(),640,480).triangles,12);
 assert.equal(drawCutout(out.ctx,a,pose(),640,480,{clothOffset:{x:.01,y:0}}).triangles,48);
 const segmenter=new GarmentSegmenter(null,canvas),target=canvas(),mask={labels:new Uint8Array(10000).fill(4),width:100,height:100},source={width:640,height:480};
 const opts={width:640,height:480,color:'#aabbcc',cutout:a,clothMaterial:'silk',timestamp:100};
 assert.equal(segmenter.applyMask(target.ctx,source,pose(),opts,mask).ok,true);
 assert.equal(segmenter.applyMask(target.ctx,source,pose(.03),{...opts,timestamp:200},mask).ok,true);
 assert.ok(segmenter.cloth.last);assert.ok(segmenter.layer.ctx.calls.some(x=>x[0]==='draw'&&x[1]==='destination-in'));
 assert.equal(segmenter.applyMask(target.ctx,source,pose(),{...opts,timestamp:300},null).ok,false);
 assert.equal(segmenter.cloth.last,null);
});
