import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={};
runInNewContext(readFileSync(new URL('../src/fit-garment-lighting.js',import.meta.url),'utf8'),sandbox);
const {lightField,shadePixels}=sandbox.RawnakFitGarmentLighting;
const rgba=(w,h,fn)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),(y*w+x)*4);return data;};
test('lighting field responds to broad shadow and highlight without borrowing excluded pixels',()=>{
 const w=24,h=12,mask=rgba(w,h,(x,y)=>[0,0,0,x<20?255:0]);
 const image=rgba(w,h,(x,y)=>{const n=x<10?65:150;return [n,n,n,255];});
 const a=lightField(image,w,h,mask,w,h);
 assert.ok(a.gain[5*w+3]<1);assert.ok(a.gain[5*w+16]>1);
 for(let y=0;y<h;y++)for(let x=20;x<w;x++)image[(y*w+x)*4]=255;
 const b=lightField(image,w,h,mask,w,h);
 assert.deepEqual([...a.gain],[...b.gain]);
});
test('shading changes RGB only, stays bounded and respects the off setting',()=>{
 const w=2,h=1,data=new Uint8ClampedArray([100,150,200,255,99,88,77,0]),field={width:2,height:1,gain:new Float32Array([.72,1.28])};
 const before=[...data];assert.equal(shadePixels(data,w,h,field,0),false);assert.deepEqual([...data],before);
 assert.equal(shadePixels(data,w,h,field,1),true);assert.deepEqual([...data],[72,108,144,255,99,88,77,0]);
});
test('missing or extremely dark garment evidence does not fabricate illumination',()=>{
 const mask=rgba(8,8,()=>[0,0,0,255]);const black=rgba(8,8,()=>[0,0,0,255]);
 assert.equal(lightField(black,8,8,mask,8,8),null);
 assert.equal(lightField(black,8,8,new Uint8ClampedArray(1),8,8),null);
 const white=rgba(8,8,()=>[200,200,200,255]);const field=lightField(white,8,8,mask,8,8);assert.ok([...field.gain].every(x=>x===1));
});
