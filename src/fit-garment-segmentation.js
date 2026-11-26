/* Semantic upper garment recoloring. The model labels apparel, not individual SKUs.
 * Category mask is consumed synchronously from the exact analyzed frame.
 * No geometric-only fallback: missing or implausible masks leave camera unedited.
 */
(function(root){
'use strict';
const MODEL_URL='https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite';
const CLOTHES=4;
const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility==null||p.visibility>=.5)&&(p.presence==null||p.presence>=.4);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function upperRegion(pose,w,h){
 if(!Array.isArray(pose)||![11,12,23,24].every(i=>visible(pose[i])))return null;
 const p=i=>({x:pose[i].x*w,y:pose[i].y*h});
 const [a,b,c,d]=[11,12,23,24].map(p);
 const span=Math.hypot(a.x-b.x,a.y-b.y),top=(a.y+b.y)/2,bottom=(c.y+d.y)/2;
 if(span<w*.10||bottom-top<h*.12||Math.abs(a.x-b.x)<span*.55)return null;
 const arms=[13,14].filter(i=>visible(pose[i])).map(p);
 const left=Math.min(a.x,b.x,c.x,d.x,...arms.map(q=>q.x))-span*.23;
 const right=Math.max(a.x,b.x,c.x,d.x,...arms.map(q=>q.x))+span*.23;
 const y0=Math.min(a.y,b.y,...arms.map(q=>q.y))-span*.19;
 const y1=bottom+span*.03;
 return {left:clamp(left,0,w),right:clamp(right,0,w),top:clamp(y0,0,h),bottom:clamp(y1,0,h)};
}
function buildAlpha(categories,w,h,pose){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||categories?.length!==w*h)return null;
 const roi=upperRegion(pose,w,h);if(!roi)return null;
 const rgba=new Uint8ClampedArray(w*h*4);
 let count=0;
 for(let y=Math.ceil(roi.top);y<Math.floor(roi.bottom);y++){
  for(let x=Math.ceil(roi.left);x<Math.floor(roi.right);x++){
   const i=y*w+x;
   if(categories[i]!==CLOTHES)continue;
   // Conservative 1-pixel erosion removes ambiguous boundaries next to skin/hair.
   if(x===0||y===0||x===w-1||y===h-1||categories[i-1]!==CLOTHES||categories[i+1]!==CLOTHES||categories[i-w]!==CLOTHES||categories[i+w]!==CLOTHES)continue;
   rgba[i*4+3]=255;count++;
  }
 }
 if(count<Math.max(12,w*h*.008))return null;
 return {rgba,width:w,height:h,count};
}
class GarmentSegmenter{
 constructor(model,createCanvas){
  this.model=model;this.input=createCanvas();this.mask=createCanvas();this.layer=createCanvas();
 }
 static async create(mod,wasm,createCanvas=()=>document.createElement('canvas')){
  const model=await mod.ImageSegmenter.createFromOptions(wasm,{baseOptions:{modelAssetPath:MODEL_URL,delegate:'CPU'},runningMode:'VIDEO',outputCategoryMask:true,outputConfidenceMasks:false});
  return new GarmentSegmenter(model,createCanvas);
 }
 apply(ctx,source,pose,{width,height,color,strength=.9,timestamp}={}){
  if(!source?.width||!source?.height||!width||!height||!Number.isFinite(timestamp)||!/^#[0-9a-f]{6}$/i.test(color))return {ok:false,reason:'بيانات المعاينة غير مكتملة'};
  if(!upperRegion(pose,source.width,source.height))return {ok:false,reason:'اظهر الكتفين والخصر أمام الكاميرا'};
  // Keep model output/readback small while retaining the original frame for compositing.
  const ratio=Math.min(1,320/Math.max(source.width,source.height));
  const iw=Math.max(1,Math.round(source.width*ratio)),ih=Math.max(1,Math.round(source.height*ratio));
  this.input.width=iw;this.input.height=ih;
  this.input.getContext('2d').drawImage(source,0,0,iw,ih);
  let result=null;
  this.model.segmentForVideo(this.input,timestamp,r=>{
   const m=r.categoryMask;
   if(m)result=buildAlpha(m.getAsUint8Array(),m.width,m.height,pose);
  });
  if(!result)return {ok:false,reason:'مش قادر أحدد منطقة الملابس بوضوح — واجه الكاميرا في إضاءة جيدة'};
  const {rgba,width:mw,height:mh,count}=result;
  this.mask.width=mw;this.mask.height=mh;
  const mc=this.mask.getContext('2d'),im=mc.createImageData(mw,mh);im.data.set(rgba);mc.putImageData(im,0,0);
  // Blend the requested hue into an original-frame copy, then restrict to the semantic mask.
  const lw=source.width,lh=source.height;
  if(this.layer.width!==lw)this.layer.width=lw;if(this.layer.height!==lh)this.layer.height=lh;
  const lc=this.layer.getContext('2d');
  lc.globalCompositeOperation='source-over';lc.globalAlpha=1;lc.clearRect(0,0,lw,lh);
  lc.drawImage(source,0,0,lw,lh);
  lc.globalCompositeOperation='color';lc.globalAlpha=clamp(Number(strength)||.9,.15,1);
  lc.fillStyle=color;lc.fillRect(0,0,lw,lh);
  lc.globalAlpha=1;lc.globalCompositeOperation='destination-in';lc.imageSmoothingEnabled=false;
  lc.drawImage(this.mask,0,0,lw,lh);
  lc.globalCompositeOperation='source-over';
  const cover=Math.max(width/lw,height/lh),dw=lw*cover,dh=lh*cover;
  ctx.drawImage(this.layer,(width-dw)/2,(height-dh)/2,dw,dh);
  return {ok:true,count,mode:'semantic-clothes-mask'};
 }
 close(){this.model.close();this.input.width=this.mask.width=this.layer.width=1;this.input.height=this.mask.height=this.layer.height=1;}
}
root.RawnakFitGarmentSegmentation={GarmentSegmenter,buildAlpha,upperRegion,MODEL_URL,CLOTHES};
})(typeof window!=='undefined'?window:globalThis);
