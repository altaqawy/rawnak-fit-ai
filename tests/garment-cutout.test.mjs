import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
for(const filename of ['fit-product-transfer.js','fit-garment-cutout.js','fit-garment-segmentation.js'])runInNewContext(readFileSync(new URL('../src/'+filename,import.meta.url),'utf8'),sandbox);
const {defaultAnchors,validAnchors,prepareCutout,targetAnchors,buildMesh,drawCutout}=sandbox.RawnakFitGarmentCutout;
const {buildAlpha,GarmentSegmenter}=sandbox.RawnakFitGarmentSegmentation;
function pose(){
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
 Object.assign(p,{11:{x:.32,y:.27},12:{x:.68,y:.27},13:{x:.24,y:.48},14:{x:.76,y:.48},15:{x:.19,y:.77},16:{x:.81,y:.77},23:{x:.38,y:.71},24:{x:.62,y:.71}});
 return p;
}
function canvas(){
 const calls=[];const ctx={calls,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},transform(...m){calls.push(['transform',...m]);},drawImage(...args){calls.push(['draw',this.globalCompositeOperation,...args]);},clearRect(){},fillRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){calls.push(['mask']);}};
 return {width:0,height:0,ctx,getContext(){return ctx;}};
}
test('front-view cutout follows shoulders and supports independently articulated sleeves',()=>{
 for(const sleeves of ['short','long']){
  const a={canvas:{width:400,height:500},sleeves,anchors:defaultAnchors(sleeves)},m=buildMesh(a,pose(),640,480);
  assert.ok(validAnchors(a.anchors));assert.ok(m);assert.equal(m.triangles.length,sleeves==='long'?16:12);
  const out=canvas();assert.equal(drawCutout(out.ctx,a,pose(),640,480).triangles,m.triangles.length);
  assert.equal(out.ctx.calls.filter(x=>x[0]==='transform').length,m.triangles.length);
 }
 const p=pose(),base=targetAnchors(p,640,480,'long');p[13]={x:.17,y:.49};const moved=targetAnchors(p,640,480,'long');
 assert.ok(moved);assert.ok(base.leo.x!==moved.leo.x);assert.equal(base.lco.x,moved.lco.x);
});
test('crossed or hidden arms and invalid source anchors fail closed',()=>{
 const a={canvas:{width:400,height:500},sleeves:'long',anchors:defaultAnchors('long')},p=pose();
 p[13].x=.65;assert.equal(buildMesh(a,p,640,480),null);
 const q=pose();q[15].visibility=.01;assert.equal(buildMesh(a,q,640,480),null);
 a.anchors.ls={x:.95,y:.1};assert.equal(validAnchors(a.anchors),false);
 assert.equal(drawCutout(canvas().ctx,a,pose(),640,480),false);
});
test('cutout preparation crops transparency and refuses opaque product photos',()=>{
 const createCanvas=(transparent)=>()=>{const c=canvas();c.ctx.getImageData=()=>{const data=new Uint8ClampedArray(c.width*c.height*4);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(!transparent||(x>=10&&x<90&&y>=8&&y<92))data[(y*c.width+x)*4+3]=255;return {data};};return c;};
 const asset=prepareCutout({width:100,height:100},{createCanvas:createCanvas(true)});
 assert.equal(asset.canvas.width,80);assert.equal(asset.canvas.height,84);
 assert.throws(()=>prepareCutout({width:100,height:100},{createCanvas:createCanvas(false)}));
});
test('long-sleeve mask reaches tracked cuffs but excludes skin and unrelated lower clothes',()=>{
 const w=100,h=100,c=new Uint8Array(w*h).fill(4),p=pose();
 const short=buildAlpha(c,w,h,p),long=buildAlpha(c,w,h,p,{longSleeves:true});
 const at=(m,x,y)=>m.rgba[(y*w+x)*4+3];
 assert.equal(at(short,19,77),0);assert.equal(at(long,19,77),255);assert.equal(at(long,50,90),0);
 c[77*w+19]=2;assert.equal(at(buildAlpha(c,w,h,p,{longSleeves:true}),19,77),0);
});
test('compositor clips full cutout and reuses mask buffers across same-sized frames',()=>{
 const labels=new Uint8Array(10000).fill(4);
 const model={segmentForVideo(frame,t,cb){cb({categoryMask:{width:100,height:100,getAsUint8Array:()=>labels}});},close(){}};
 const segmenter=new GarmentSegmenter(model,canvas),target=canvas();
 const cutout={canvas:{width:400,height:500},sleeves:'long',anchors:defaultAnchors('long')};
 const opts={width:640,height:480,color:'#aabbcc',timestamp:100,cutout};
 assert.equal(segmenter.apply(target.ctx,{width:640,height:480},pose(),opts).mode,'semantic-garment-cutout');
 const buffer=segmenter.maskImage;
 assert.equal(segmenter.apply(target.ctx,{width:640,height:480},pose(),{...opts,timestamp:200}).ok,true);
 assert.equal(segmenter.maskImage,buffer);
 assert.ok(segmenter.layer.ctx.calls.some(x=>x[0]==='draw'&&x[1]==='destination-in'));
 labels.fill(0);const count=target.ctx.calls.length;
 assert.equal(segmenter.apply(target.ctx,{width:640,height:480},pose(),{...opts,timestamp:300}).ok,false);assert.equal(target.ctx.calls.length,count);
});
