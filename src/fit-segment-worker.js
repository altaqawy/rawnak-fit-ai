/* Classic worker supports MediaPipe's legacy WASM importScripts loader.
 * Only local ImageBitmaps enter this worker; no frame is uploaded.
 */
'use strict';
const VERSION='0.10.21';
const BASES=['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@'+VERSION,'https://unpkg.com/@mediapipe/tasks-vision@'+VERSION];
const MODEL='https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
let model=null,loading=false,delegate=null;
async function init(preference){
 if(loading||model)return;
 loading=true;let last;
 try{
  if(typeof OffscreenCanvas!=='function')throw Error('OffscreenCanvas unavailable');
  for(const base of BASES){
   let mod,wasm;
   try{mod=await import(base+'/vision_bundle.mjs');wasm=await mod.FilesetResolver.forVisionTasks(base+'/wasm');}catch(e){last=e;continue;}
   for(const candidate of preference==='gpu'?['GPU','CPU']:['CPU']){
    try{
     model=await mod.ImageSegmenter.createFromOptions(wasm,{canvas:new OffscreenCanvas(1,1),baseOptions:{modelAssetPath:MODEL,delegate:candidate},runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false});
     delegate=candidate;self.postMessage({type:'ready',delegate});return;
    }catch(e){last=e;}
   }
  }
  throw last||Error('Model unavailable');
 }catch(e){self.postMessage({type:'init-error',message:String(e?.message||e)});}
 finally{loading=false;}
}
self.onmessage=event=>{
 const m=event.data||{};
 if(m.type==='init'){void init(m.preference);return;}
 if(m.type!=='segment')return;
 const bitmap=m.bitmap;
 try{
  if(!model||!bitmap||!Number.isFinite(m.timestamp))throw Error('Segmenter not initialized');
  const t=performance.now();let output=null;
  model.segmentForVideo(bitmap,m.timestamp,result=>{
   const mask=result.categoryMask;
   if(mask){const labels=new Uint8Array(mask.getAsUint8Array());output={labels,width:mask.width,height:mask.height};}
  });
  if(output)self.postMessage({type:'result',id:m.id,timestamp:m.timestamp,...output,ms:performance.now()-t},[output.labels.buffer]);
  else self.postMessage({type:'result',id:m.id,timestamp:m.timestamp,labels:null,ms:performance.now()-t});
 }catch(e){self.postMessage({type:'frame-error',id:m.id,message:String(e?.message||e)});}
 finally{bitmap?.close();}
};
