/* One-frame-in-flight worker transport. Timeouts and closing reject pending
 * operations. Worker results must match both request ID and source timestamp.
 */
(function(root){
'use strict';
class SegmentWorkerClient{
 constructor(worker,{bitmapFactory=(canvas)=>createImageBitmap(canvas),initTimeout=45000,frameTimeout=1800}={}){
  this.worker=worker;this.bitmapFactory=bitmapFactory;this.initTimeout=initTimeout;this.frameTimeout=frameTimeout;
  this.closed=false;this.ready=false;this.delegate='';this.nextId=0;this.pending=null;this.initializing=null;
  worker.onmessage=e=>this.receive(e.data);
  worker.onerror=e=>this.fail(Error(e?.message||'Segmentation worker crashed'));
  worker.onmessageerror=()=>this.fail(Error('Invalid worker message'));
 }
 static async create(url,opts={}){
  if(typeof Worker!=='function'||typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function')throw Error('Worker imaging unsupported');
  const client=new SegmentWorkerClient(new Worker(url));
  try{await client.init(opts.preference||'cpu');return client;}catch(e){client.close();throw e;}
 }
 init(preference='cpu'){
  if(this.closed)return Promise.reject(Error('Worker closed'));
  if(this.ready)return Promise.resolve(this.delegate);
  if(this.initializing)return this.initializing.promise;
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  const timer=setTimeout(()=>this.fail(Error('Segmentation worker load timeout')),this.initTimeout);
  this.initializing={promise,resolve,reject,timer};
  try{this.worker.postMessage({type:'init',preference:preference==='gpu'?'gpu':'cpu'});}catch(e){this.fail(e);}
  return promise;
 }
 get busy(){return Boolean(this.pending);}
 request(canvas,timestamp){
  if(this.closed||!this.ready)return Promise.reject(Error('Worker not ready'));
  if(this.pending)return Promise.reject(Error('Frame already in flight'));
  if(!Number.isFinite(timestamp))return Promise.reject(Error('Invalid timestamp'));
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  const id=++this.nextId,timer=setTimeout(()=>this.fail(Error('Segmentation frame timeout')),this.frameTimeout);
  const job={id,timestamp,resolve,reject,timer};this.pending=job;
  Promise.resolve().then(()=>this.bitmapFactory(canvas)).then(bitmap=>{
   if(this.closed||this.pending!==job){bitmap?.close();return;}
   try{this.worker.postMessage({type:'segment',id,timestamp,bitmap},[bitmap]);}catch(e){bitmap?.close();this.fail(e);}
  }).catch(e=>{if(this.pending===job)this.fail(e);});
  return promise;
 }
 receive(m){
  if(this.closed||!m)return;
  if(m.type==='ready'&&this.initializing){
   const a=this.initializing;this.initializing=null;clearTimeout(a.timer);this.delegate=m.delegate;this.ready=true;a.resolve(m.delegate);return;
  }
  if(m.type==='init-error'&&this.initializing){this.fail(Error(m.message||'Worker initialization failed'));return;}
  const p=this.pending;
  if(!p||m.id!==p.id)return;
  if(m.type==='frame-error'){this.fail(Error(m.message||'Worker inference failed'));return;}
  if(m.type!=='result'||m.timestamp!==p.timestamp)return;
  if(m.labels!==null&&(!(m.labels instanceof Uint8Array)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<1||m.height<1||m.labels.length!==m.width*m.height||m.labels.length>1048576)){
   this.fail(Error('Invalid segmentation mask'));return;
  }
  this.pending=null;clearTimeout(p.timer);p.resolve(m);
 }
 fail(error){
  if(this.closed)return;
  this.closed=true;this.ready=false;
  if(this.initializing){const a=this.initializing;this.initializing=null;clearTimeout(a.timer);a.reject(error);}
  if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);p.reject(error);}
  this.worker.onmessage=this.worker.onerror=this.worker.onmessageerror=null;this.worker.terminate();
 }
 close(){this.fail(Error('Worker closed'));}
}
root.RawnakFitSegmentWorker={SegmentWorkerClient};
})(typeof window!=='undefined'?window:globalThis);
