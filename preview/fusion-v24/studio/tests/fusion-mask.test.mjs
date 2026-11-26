import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareInput,normalizeMask,alphaFromMask} from '../fusion-mask.mjs';
test('U2Netp normalizes RGB into channel-first tensor',()=>{
 const rgba=new Uint8Array(320*320*4);
 for(let i=0;i<rgba.length;i+=4){rgba[i]=200;rgba[i+1]=100;rgba[i+3]=255;}
 const x=prepareInput(rgba),n=320*320;
 assert.equal(x.length,n*3);assert.ok(Math.abs(x[0]-(1-.485)/.229)<1e-5);assert.ok(Math.abs(x[n]-(.5-.456)/.224)<1e-5);
 assert.throws(()=>prepareInput(new Uint8Array(4)));
});
test('mask normalization rejects flat and nonfinite output',()=>{
 const x=new Float32Array(320*320);x[0]=.2;x[1]=.8;x[2]=.5;
 const mask=normalizeMask(x);assert.equal(mask[1],255);assert.ok(mask[2]>mask[0]);
 assert.throws(()=>normalizeMask(new Float32Array(320*320).fill(.2)));
 x[0]=NaN;assert.throws(()=>normalizeMask(x));
});
test('threshold preserves original alpha and rejects degenerate foreground',()=>{
 const rgba=new Uint8ClampedArray([1,2,3,255,4,5,6,150,7,8,9,255,10,11,12,0]);
 const r=alphaFromMask(rgba,new Uint8Array([0,255,255,255]),.5);
 assert.equal(r.coverage,.5);assert.deepEqual([...r.data],[1,2,3,0,4,5,6,150,7,8,9,255,10,11,12,0]);
 assert.throws(()=>alphaFromMask(rgba,new Uint8Array(4),.5));
});
