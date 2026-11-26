/* Approximate same-frame illumination transfer. No 3D lighting or wrinkle synthesis. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lightField(rgb,w,h,mask,mw,mh){
 if(!Number.isInteger(w)||!Number.isInteger(h)||!Number.isInteger(mw)||!Number.isInteger(mh)||w<1||h<1||mw<1||mh<1||rgb?.length!==w*h*4||mask?.length!==mw*mh*4)return null;
 const lum=new Float32Array(w*h),valid=new Uint8Array(w*h),gain=new Float32Array(w*h).fill(1);
 let total=0,count=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,j=(Math.min(mh-1,Math.floor((y+.5)*mh/h))*mw+Math.min(mw-1,Math.floor((x+.5)*mw/w)))*4;
  if(mask[j+3]<128)continue;
  valid[i]=1;lum[i]=.2126*rgb[i*4]+.7152*rgb[i*4+1]+.0722*rgb[i*4+2];total+=lum[i];count++;
 }
 if(count<16)return null;
 const mean=total/count;
 if(mean<18)return null;
 // Suppress fine patterns; never sample skin or background into the field.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x;if(!valid[i])continue;
  let sum=0,n=0;
  for(let j=Math.max(0,y-2);j<=Math.min(h-1,y+2);j++)for(let k=Math.max(0,x-2);k<=Math.min(w-1,x+2);k++){
   const q=j*w+k;if(valid[q]){sum+=lum[q];n++;}
  }
  gain[i]=clamp((sum/n+24)/(mean+24),.72,1.28);
 }
 return {gain,width:w,height:h};
}
function shadePixels(data,w,h,field,strength){
 if(!field||data?.length!==w*h*4||!Number.isFinite(strength)||strength<=0)return false;
 const amount=clamp(strength,0,1),fw=field.width,fh=field.height,g=field.gain;
 if(!fw||!fh||g?.length!==fw*fh)return false;
 for(let y=0;y<h;y++){
  const sy=clamp((y+.5)*fh/h-.5,0,fh-1),y0=Math.floor(sy),y1=Math.min(fh-1,y0+1),ty=sy-y0;
  for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(!data[i+3])continue;
   const sx=clamp((x+.5)*fw/w-.5,0,fw-1),x0=Math.floor(sx),x1=Math.min(fw-1,x0+1),tx=sx-x0;
   const a=g[y0*fw+x0]*(1-tx)+g[y0*fw+x1]*tx,b=g[y1*fw+x0]*(1-tx)+g[y1*fw+x1]*tx;
   const k=1+((a*(1-ty)+b*ty)-1)*amount;
   for(let c=0;c<3;c++)data[i+c]=clamp(Math.round(data[i+c]*k),0,255);
  }
 }
 return true;
}
class GarmentLighting{
 constructor(createCanvas){this.canvas=createCanvas();}
 apply(ctx,source,w,h,mask,strength){
  if(!strength||typeof ctx.getImageData!=='function'||typeof ctx.putImageData!=='function')return false;
  const ratio=Math.min(1,96/Math.max(w,h)),sw=Math.max(1,Math.round(w*ratio)),sh=Math.max(1,Math.round(h*ratio));
  if(this.canvas.width!==sw)this.canvas.width=sw;if(this.canvas.height!==sh)this.canvas.height=sh;
  const sc=this.canvas.getContext('2d',{willReadFrequently:true});
  sc.drawImage(source,0,0,sw,sh);
  const field=lightField(sc.getImageData(0,0,sw,sh).data,sw,sh,mask.rgba,mask.width,mask.height);
  if(!field)return false;
  const overlay=ctx.getImageData(0,0,w,h);
  if(!shadePixels(overlay.data,w,h,field,strength))return false;
  ctx.putImageData(overlay,0,0);return true;
 }
 close(){this.canvas.width=this.canvas.height=1;}
}
root.RawnakFitGarmentLighting={lightField,shadePixels,GarmentLighting};
})(typeof window!=='undefined'?window:globalThis);
