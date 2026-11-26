import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const sandbox={Uint8Array,setTimeout,clearTimeout};
runInNewContext(readFileSync(new URL('../src/fit-segment-worker-client.js',import.meta.url),'utf8'),sandbox);
const {SegmentWorkerClient}=sandbox.RawnakFitSegmentWorker;
function mockWorker(){
 const w={messages:[],terminated:0,postMessage(m){this.messages.push(m);},terminate(){this.terminated++;},emit(m){this.onmessage?.({data:m});}};
 return w;
}
async function ready(w,opts={}){
 const c=new SegmentWorkerClient(w,{bitmapFactory:async()=>({close(){}}),initTimeout:100,frameTimeout:100,...opts});
 const p=c.init('gpu');assert.equal(w.messages[0].preference,'gpu');w.emit({type:'ready',delegate:'CPU'});await p;return c;
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('one in-flight request, exact timestamp and request identity, GPU-to-CPU reporting',async()=>{
 const w=mockWorker(),c=await ready(w);
 assert.equal(c.delegate,'CPU');const p=c.request({},42);await tick();
 assert.equal(c.busy,true);await assert.rejects(c.request({},43),/already in flight/);
 const id=w.messages[1].id;
 w.emit({type:'result',id:id+1,timestamp:42,labels:null});
 w.emit({type:'result',id,timestamp:41,labels:null});
 assert.equal(c.busy,true);
 w.emit({type:'result',id,timestamp:42,labels:new Uint8Array(4),width:2,height:2});
 const out=await p;assert.equal(out.timestamp,42);assert.equal(c.busy,false);
 c.close();assert.equal(w.terminated,1);
});
test('closing during asynchronous bitmap creation rejects job and disposes late bitmap',async()=>{
 const w=mockWorker();let release,closed=0;
 const c=await ready(w,{bitmapFactory:()=>new Promise(resolve=>release=resolve)});
 const p=c.request({},50);await tick();
 const rejected=assert.rejects(p,/closed/);c.close();await rejected;
 release({close(){closed++;}});await tick();
 assert.equal(closed,1);assert.equal(w.messages.length,1);assert.equal(w.terminated,1);
});
test('invalid mask fails closed and worker is terminated',async()=>{
 const w=mockWorker(),c=await ready(w);
 const p=c.request({},99);await tick();const rejected=assert.rejects(p,/Invalid segmentation mask/);
 w.emit({type:'result',id:w.messages[1].id,timestamp:99,labels:new Uint8Array(3),width:2,height:2});
 await rejected;assert.equal(c.busy,false);assert.equal(w.terminated,1);
});
test('initialization timeout and frame timeout reject without leaving work queued',async()=>{
 const w=mockWorker(),c=new SegmentWorkerClient(w,{initTimeout:10});
 await assert.rejects(c.init(),/load timeout/);assert.equal(w.terminated,1);
 const w2=mockWorker(),c2=await ready(w2,{frameTimeout:10});
 await assert.rejects(c2.request({},1),/frame timeout/);assert.equal(c2.busy,false);assert.equal(w2.terminated,1);
});
test('empty semantic result is accepted without fabricating a mask',async()=>{
 const w=mockWorker(),c=await ready(w);const p=c.request({},88);await tick();
 w.emit({type:'result',id:w.messages[1].id,timestamp:88,labels:null});assert.equal((await p).labels,null);c.close();
});
