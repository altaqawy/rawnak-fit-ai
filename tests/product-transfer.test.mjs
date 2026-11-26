import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
for(const filename of ['fit-product-transfer.js','fit-garment-segmentation.js'])runInNewContext(readFileSync(new URL('../src/'+filename,import.meta.url),'utf8'),sandbox);
const {buildMesh,affine,drawPanel,preparePanel}=sandbox.RawnakFitProductTransfer;
const {GarmentSegmenter}=sandbox.RawnakFitGarmentSegmentation;
const pose=()=>{const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));p[11]={x:.3,y:.25};p[12]={x:.7,y:.28};p[23]={x:.35,y:.7};p[24]={x:.65,y:.72};return p;};
const points=(a,b,c,d)=>Math.abs(a-c)<1e-6&&Math.abs(b-d)<1e-6;
test('mesh follows shoulder and hip anchors and rejects invalid or profile poses',()=>{
 const p=pose(),mesh=buildMesh(p,640,480);assert.ok(mesh);assert.equal(mesh.vertices.length,12);assert.equal(mesh.triangles.length,12);assert.ok(mesh.vertices[0].x<mesh.vertices[2].x);
 p[11].visibility=.01;assert.equal(buildMesh(p,640,480),null);
 const side=pose();side[12].x=.31;assert.equal(buildMesh(side,640,480),null);
});
test('triangle affine maps all three source vertices exactly',()=>{
 const src=[{x:1,y:2},{x:40,y:3},{x:7,y:30}],dst=[{x:20,y:21},{x:70,y:11},{x:17,y:55}];
 const m=affine(src,dst);assert.ok(m);const [a,b,c,d,e,f]=m;
 for(let i=0;i<3;i++)assert.ok(points(a*src[i].x+c*src[i].y+e,b*src[i].x+d*src[i].y+f,dst[i].x,dst[i].y));
 assert.equal(affine([src[0],src[0],src[0]],dst),null);
});
function canvas(){
 const calls=[];const ctx={calls,save(){calls.push(['save']);},restore(){calls.push(['restore']);},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},transform(...m){calls.push(['transform',...m]);},drawImage(...a){calls.push(['draw',this.globalCompositeOperation,...a]);},fillRect(){calls.push(['fill']);},clearRect(){},createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(){calls.push(['mask']);}};
 return {width:0,height:0,ctx,getContext(){return ctx;}};
}
test('panel crop and texture warper render 12 triangles without tinting the whole frame',()=>{
 const texture=preparePanel({width:2000,height:1000},{centralCrop:true,createCanvas:canvas});assert.equal(texture.width,720);assert.equal(texture.height,550);
 const layer=canvas();const result=drawPanel(layer.ctx,texture,pose(),640,480,{strength:.8});
 assert.equal(result.triangles,12);assert.equal(result.alpha,.8);assert.equal(layer.ctx.calls.filter(x=>x[0]==='transform').length,12);
 assert.throws(()=>preparePanel({width:0,height:0},{createCanvas:canvas}));
});
test('texture compositor clips semantic garment mask before overlay and fails closed',()=>{
 let mask=new Uint8Array(10000).fill(4);const model={segmentForVideo(frame,t,cb){cb({categoryMask:{width:100,height:100,getAsUint8Array:()=>mask}});},close(){}};
 const engine=new GarmentSegmenter(model,canvas),target=canvas(),source={width:1920,height:1080},texture={width:100,height:120};
 const opts={width:640,height:360,color:'#aabbcc',timestamp:100,texture};
 const r=engine.apply(target.ctx,source,pose(),opts);assert.equal(r.mode,'semantic-product-panel');assert.equal(engine.layer.width,640);assert.equal(engine.layer.height,360);
 assert.ok(engine.layer.ctx.calls.some(x=>x[0]==='draw'&&x[1]==='destination-in'));
 assert.equal(target.ctx.calls.filter(x=>x[0]==='draw').length,1);mask.fill(0);
 assert.equal(engine.apply(target.ctx,source,pose(),{...opts,timestamp:200}).ok,false);assert.equal(target.ctx.calls.filter(x=>x[0]==='draw').length,1);
});
