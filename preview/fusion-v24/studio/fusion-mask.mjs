// U²-Netp browser adapter, based on upstream rembg preprocessing contract.
// Only model/runtime files are fetched; product image pixels stay in browser memory.
const SIZE=320;
const MODEL='https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx';
const SHA='309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
const RUNTIME='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
let loading=null,busy=false;
export function prepareInput(rgba,w=SIZE,h=SIZE){
 if(rgba?.length!==w*h*4||w!==SIZE||h!==SIZE)throw Error('Invalid 320×320 input');
 let max=0;for(let i=0;i<rgba.length;i+=4)max=Math.max(max,rgba[i],rgba[i+1],rgba[i+2]);
 if(!max)throw Error('Blank image');
 const mean=[.485,.456,.406],std=[.229,.224,.225],n=w*h,values=new Float32Array(n*3);
 for(let c=0;c<3;c++)for(let i=0;i<n;i++)values[c*n+i]=(rgba[i*4+c]/max-mean[c])/std[c];
 return values;
}
export function normalizeMask(data){
 if(data?.length!==SIZE*SIZE)throw Error('Unexpected mask size');
 let lo=Infinity,hi=-Infinity;
 for(const v of data){if(!Number.isFinite(v))throw Error('Invalid mask');lo=Math.min(lo,v);hi=Math.max(hi,v);}
 if(hi-lo<1e-5)throw Error('No usable foreground signal');
 return Uint8ClampedArray.from(data,v=>Math.round((v-lo)*255/(hi-lo)));
}
export function alphaFromMask(rgba,mask,threshold=.5){
 if(rgba?.length!==mask?.length*4||!Number.isFinite(threshold)||threshold<.1||threshold>.9)throw Error('Invalid mask parameters');
 const result=new Uint8ClampedArray(rgba);let kept=0;
 for(let i=0;i<mask.length;i++){const alpha=mask[i]/255>=threshold?255:0;result[i*4+3]=Math.min(result[i*4+3],alpha);if(result[i*4+3]>127)kept++;}
 const coverage=kept/mask.length;if(coverage<.025||coverage>.95)throw Error('Foreground too small or fills frame');
 return {data:result,coverage};
}
async function engine(){
 if(!loading)loading=(async()=>{
  const ort=await import(RUNTIME+'ort.min.mjs');
  ort.env.wasm.wasmPaths=RUNTIME;ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const response=await fetch(MODEL,{credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('Model download failed');
  const bytes=await response.arrayBuffer();if(bytes.byteLength>6*1024*1024)throw Error('Unexpected model size');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==SHA)throw Error('Model checksum mismatch');
  const session=await ort.InferenceSession.create(bytes,{executionProviders:['wasm']});
  if(session.inputNames.length!==1||!session.outputNames.length){await session.release();throw Error('Unexpected model I/O');}
  return {ort,session};
 })().catch(e=>{loading=null;throw e;});
 return loading;
}
export async function isolateProduct(file,{threshold=.5}={}){
 if(busy)throw Error('Another image is being analyzed');
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Invalid image');
 busy=true;let image=null,tensor=null,outputs=null;
 try{
  image=await createImageBitmap(file);
  if(!image.width||!image.height||image.width*image.height>24000000)throw Error('Image dimensions exceed limit');
  const input=document.createElement('canvas');input.width=input.height=SIZE;
  const ic=input.getContext('2d',{willReadFrequently:true});ic.fillStyle='#ffffff';ic.fillRect(0,0,SIZE,SIZE);ic.drawImage(image,0,0,SIZE,SIZE);
  const {ort,session}=await engine();
  tensor=new ort.Tensor('float32',prepareInput(ic.getImageData(0,0,SIZE,SIZE).data),[1,3,SIZE,SIZE]);
  outputs=await session.run({[session.inputNames[0]]:tensor});
  const output=outputs[session.outputNames[0]],mask=normalizeMask(output?.data);
  const ratio=Math.min(1,1024/Math.max(image.width,image.height)),w=Math.max(1,Math.round(image.width*ratio)),h=Math.max(1,Math.round(image.height*ratio));
  const result=document.createElement('canvas');result.width=w;result.height=h;
  const ctx=result.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h),resampled=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)resampled[y*w+x]=mask[Math.min(SIZE-1,Math.floor((y+.5)*SIZE/h))*SIZE+Math.min(SIZE-1,Math.floor((x+.5)*SIZE/w))];
  const cut=alphaFromMask(pixels.data,resampled,threshold);pixels.data.set(cut.data);ctx.putImageData(pixels,0,0);
  const blob=await new Promise((resolve,reject)=>result.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'));
  return {blob,canvas:result,coverage:cut.coverage,method:'u2netp-onnx'};
 }finally{image?.close();tensor?.dispose?.();for(const t of Object.values(outputs||{}))t.dispose?.();busy=false;}
}
