/* Experimental front-panel texture transfer. No garment reconstruction:
 * a supplied fabric/front-panel crop is piecewise affine warped to the tracked
 * shoulders/hips; the semantic clothes mask is applied by the compositor.
 */
(function(root){
'use strict';
const ok=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility==null||p.visibility>=.55)&&(p.presence==null||p.presence>=.4);
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function buildMesh(pose,w,h){
 if(!Array.isArray(pose)||![11,12,23,24].every(i=>ok(pose[i]))||!w||!h)return null;
 const p=i=>({x:pose[i].x*w,y:pose[i].y*h});
 let [a,b,c,d]=[11,12,23,24].map(p);
 if(a.x>b.x){[a,b]=[b,a];[c,d]=[d,c];}
 const span=b.x-a.x,hip=d.x-c.x,top=(a.y+b.y)/2,bot=(c.y+d.y)/2;
 if(span<w*.10||hip<span*.33||bot-top<h*.12||Math.abs(a.y-b.y)>span*.45)return null;
 const rows=[];
 for(const t of [.16,.42,.68,.96]){
  const l=mix(a,c,t),r=mix(b,d,t),mid=mix(l,r,.5);
  // Slightly widen near the hem to cover central cloth, not sleeves.
  rows.push([mix(l,mid,.04),mid,mix(r,mid,.04)]);
 }
 const vertices=rows.flat();
 if(vertices.some(p=>p.x<0||p.x>w||p.y<0||p.y>h))return null;
 const uv=rows.flatMap((_,r)=>[0,.5,1].map(u=>({x:u,y:r/3})));
 const triangles=[];
 for(let r=0;r<3;r++)for(let c=0;c<2;c++){
  const i=r*3+c;triangles.push([i,i+1,i+4],[i,i+4,i+3]);
 }
 return {vertices,uv,triangles};
}
function affine(s,d){
 const [a,b,c]=s,[x,y,z]=d;
 const det=a.x*(b.y-c.y)+b.x*(c.y-a.y)+c.x*(a.y-b.y);
 if(Math.abs(det)<1e-7)return null;
 function coeff(k){
  return [(k[0]*(b.y-c.y)+k[1]*(c.y-a.y)+k[2]*(a.y-b.y))/det,
   (k[0]*(c.x-b.x)+k[1]*(a.x-c.x)+k[2]*(b.x-a.x))/det,
   (k[0]*(b.x*c.y-c.x*b.y)+k[1]*(c.x*a.y-a.x*c.y)+k[2]*(a.x*b.y-b.x*a.y))/det];
 }
 const xx=coeff([x.x,y.x,z.x]),yy=coeff([x.y,y.y,z.y]);
 return [xx[0],yy[0],xx[1],yy[1],xx[2],yy[2]];
}
function drawPanel(ctx,texture,pose,w,h,{strength=.9}={}){
 const tw=texture?.width||texture?.naturalWidth,th=texture?.height||texture?.naturalHeight;
 if(!ctx||!tw||!th)return false;
 const mesh=buildMesh(pose,w,h);if(!mesh)return false;
 const alpha=Math.max(.4,Math.min(1,Number(strength)||.9));
 // Render at full opacity into a transparent intermediate. Global strength
 // is applied once at composition so triangle seams don't get double opacity.
 ctx.save();
 try{
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  for(const tri of mesh.triangles){
   const src=tri.map(i=>({x:mesh.uv[i].x*tw,y:mesh.uv[i].y*th}));
   const dst=tri.map(i=>mesh.vertices[i]);const m=affine(src,dst);if(!m)continue;
   // Extend clip by a fraction of a pixel to avoid antialias gaps.
   const center={x:dst.reduce((a,p)=>a+p.x,0)/3,y:dst.reduce((a,p)=>a+p.y,0)/3};
   const expanded=dst.map(p=>{const len=Math.hypot(p.x-center.x,p.y-center.y)||1;return {x:p.x+(p.x-center.x)*.8/len,y:p.y+(p.y-center.y)*.8/len};});
   ctx.save();try{
    ctx.beginPath();ctx.moveTo(expanded[0].x,expanded[0].y);ctx.lineTo(expanded[1].x,expanded[1].y);ctx.lineTo(expanded[2].x,expanded[2].y);ctx.closePath();ctx.clip();
    ctx.transform(...m);ctx.drawImage(texture,0,0,tw,th);
   }finally{ctx.restore();}
  }
 }finally{ctx.restore();}
 return {alpha,triangles:mesh.triangles.length};
}
function preparePanel(image,{centralCrop=false,maxSize=768,createCanvas=()=>document.createElement('canvas')}={}){
 const w=image?.naturalWidth||image?.width,h=image?.naturalHeight||image?.height;
 if(!w||!h||w<32||h<32||w*h>24000000)throw Error('Invalid product image dimensions');
 const crop=centralCrop?{x:w*.32,y:h*.33,w:w*.36,h:h*.55}:{x:0,y:0,w,h};
 const scale=Math.min(1,maxSize/Math.max(crop.w,crop.h));
 const canvas=createCanvas();canvas.width=Math.max(1,Math.round(crop.w*scale));canvas.height=Math.max(1,Math.round(crop.h*scale));
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('No canvas context');
 ctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
 return canvas;
}
root.RawnakFitProductTransfer={buildMesh,affine,drawPanel,preparePanel};
})(typeof window!=='undefined'?window:globalThis);
