import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const anchor='  drawCatalog();\n  updateUI();\n})();';
assert.ok(source.includes(anchor));
const instrumented=source.replace(anchor,'  drawCatalog();\n  updateUI();\n  globalThis.__fitHarness={state,renderSynchronizedFrame,invalidateSwap,resetSegmenter,smoothing};\n})();');
function harness(){
 const context2d={drawImage(){},clearRect(){},setTransform(){}};
 class Element{
  constructor(){this.clientWidth=640;this.clientHeight=480;this.width=300;this.height=150;this.currentTime=1;this.videoWidth=640;this.videoHeight=480;this.readyState=4;this.style={};this.classList={toggle(){},add(){},remove(){}};}
  getContext(){return context2d;}addEventListener(){}setAttribute(){}append(){}
 }
 const nodes=new Map(),select=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 let now=100;
 const sandbox={document:{querySelector:select,createElement:()=>new Element()},window:{location:{search:''},devicePixelRatio:1,addEventListener(){}},performance:{now:()=>now},URLSearchParams,devicePixelRatio:1,console};
 runInNewContext(instrumented,sandbox);
 const app=sandbox.__fitHarness,pose=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
 Object.assign(pose,{11:{x:.3,y:.3},12:{x:.7,y:.3},23:{x:.35,y:.7},24:{x:.65,y:.7}});
 const jobs=[],composed=[];
 const worker={request(canvas,timestamp){return new Promise((resolve,reject)=>jobs.push({canvas,timestamp,resolve,reject}));},close(){}};
 Object.assign(app.state,{stream:{},engine:'ready',assetMode:'swap',segmentStatus:'ready',segmentWorker:worker,segmentBackend:'WORKER CPU',segmenter:{applyMask(ctx,frame,points,opts,mask){composed.push({width:frame.width,height:frame.height,timestamp:opts.timestamp,mask,points});return{ok:true};},close(){}},models:{pose:{detectForVideo(){return{landmarks:[pose]};}}}});
 return {app,jobs,composed,video:select('#camera-video'),setNow:n=>{now=n;},pose};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('app keeps one frozen frame in flight and never composes mismatched video',async()=>{
 const h=harness(),{app,jobs,composed}=h;
 app.renderSynchronizedFrame(100);
 assert.equal(jobs.length,1);assert.equal(jobs[0].canvas.width,320);assert.equal(app.state.syncFrameReady,false);
 h.video.currentTime=2;h.setNow(240);app.renderSynchronizedFrame(240);assert.equal(jobs.length,1);
 jobs[0].resolve({timestamp:100,labels:null});await flush();
 assert.equal(composed.length,1);assert.equal(composed[0].timestamp,100);assert.equal(composed[0].width,640);assert.equal(app.state.syncFrameReady,true);assert.equal(app.state.swapJob,null);
 h.setNow(400);app.renderSynchronizedFrame(400);assert.equal(jobs.length,2);
 app.invalidateSwap();jobs[1].resolve({timestamp:400,labels:null});await flush();assert.equal(composed.length,1);assert.equal(app.state.syncFrameReady,false);
});
test('late result after model reset or camera closure never affects new preview',async()=>{
 const h=harness(),{app,jobs,composed}=h;
 app.renderSynchronizedFrame(100);assert.equal(jobs.length,1);
 app.resetSegmenter();app.state.stream=null;
 jobs[0].resolve({timestamp:100,labels:null});await flush();
 assert.equal(composed.length,0);assert.equal(app.state.swapJob,null);
});
test('motion adaptive smoothing damps jitter and clears history on lost pose',()=>{
 const {app,pose}=harness();
 const first=app.smoothing('pose',pose);const x=first[11].x;
 pose[11].x=x+.002;const tiny=app.smoothing('pose',pose)[11].x;assert.ok(tiny>x&&tiny<x+.002);
 pose[11].x=x+.12;const large=app.smoothing('pose',pose)[11].x;assert.equal(large,pose[11].x);
 assert.equal(app.smoothing('pose',null),null);assert.equal(app.state.lastPoints,null);
});
