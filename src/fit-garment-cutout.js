/* Front-view articulated garment cutout transfer.
 * The cutout is warped with explicit editable UV anchors; original clothes/skin
 * are not reconstructed. The semantic compositor clips every output pixel.
 */
(function(root){
'use strict';
const names=['ls','neck','rs','la','ra','lh','rh','lco','lci','rco','rci'];
const point=(x,y)=>({x,y}),mix=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
const add=(a,b)=>point(a.x+b.x,a.y+b.y),sub=(a,b)=>point(a.x-b.x,a.y-b.y),mul=(a,k)=>point(a.x*k,a.y*k);
const len=a=>Math.hypot(a.x,a.y),unit=a=>len(a)>1e-6?mul(a,1/len(a)):null,dot=(a,b)=>a.x*b.x+a.y*b.y;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const seen=p=>valid(p)&&(p.visibility==null||p.visibility>=.55)&&(p.presence==null||p.presence>=.4);
const inside=p=>valid(p)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
function defaultAnchors(sleeves='short'){
 const long=sleeves==='long';
 return {ls:point(.28,.06),neck:point(.5,.015),rs:point(.72,.06),
 la:point(.30,long?.28:.33),ra:point(.70,long?.28:.33),lh:point(.28,.985),rh:point(.72,.985),
 lco:point(.01,long?.87:.24),lci:point(long?.14:.11,long?.99:.38),
 rco:point(.99,long?.87:.24),rci:point(long?.86:.89,long?.99:.38)};
}
function validAnchors(a){
 if(!a||!names.every(k=>inside(a[k])))return false;
 const span=a.rs.x-a.ls.x;
 return span>.16&&a.lh.x<a.rh.x&&a.la.x<a.ra.x&&
 a.neck.x>a.ls.x&&a.neck.x<a.rs.x&&
 a.la.y>a.ls.y&&a.ra.y>a.rs.y&&a.lh.y>a.la.y&&a.rh.y>a.ra.y&&
 a.lco.x<a.ls.x&&a.rco.x>a.rs.x;
}
function prepareCutout(image,{sleeves='short',maxSize=768,createCanvas=()=>document.createElement('canvas')}={}){
 const source=root.RawnakFitProductTransfer.preparePanel(image,{maxSize,createCanvas});
 const w=source.width,h=source.height,ctx=source.getContext('2d',{willReadFrequently:true});
 const data=ctx.getImageData(0,0,w,h).data;
 let x0=w,y0=h,x1=-1,y1=-1,opaque=0,clear=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const a=data[(y*w+x)*4+3];if(a<16)clear++;
  if(a>64){opaque++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 }
 if(clear<w*h*.07||opaque<w*h*.10||x1-x0<16||y1-y0<16)throw Error('صورة كاملة بخلفية شفافة مطلوبة (PNG أو WebP). استخدم وضع النقشة للصور العادية.');
 const canvas=createCanvas();canvas.width=x1-x0+1;canvas.height=y1-y0+1;
 canvas.getContext('2d').drawImage(source,x0,y0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
 source.width=1;source.height=1;
 return {canvas,sleeves:sleeves==='long'?'long':'short',anchors:defaultAnchors(sleeves)};
}
function targetAnchors(pose,w,h,sleeves){
 if(!Array.isArray(pose)||![11,12,13,14,23,24].every(i=>seen(pose[i]))||!w||!h)return null;
 const long=sleeves==='long';
 if(long&&![15,16].every(i=>seen(pose[i])))return null;
 const p=i=>point(pose[i].x*w,pose[i].y*h);
 let [l,r]=p(11).x<=p(12).x?[[11,13,15,23],[12,14,16,24]]:[[12,14,16,24],[11,13,15,23]];
 const ls=p(l[0]),rs=p(r[0]),lh=p(l[3]),rh=p(r[3]),mid=mix(ls,rs,.5),hip=mix(lh,rh,.5);
 const span=len(sub(rs,ls)),body=len(sub(hip,mid)),across=unit(sub(rs,ls)),down=unit(sub(hip,mid));
 if(!across||!down||span<w*.10||body<h*.12||rs.x-ls.x<span*.65||rh.x-lh.x<span*.22||hip.y-mid.y<body*.55)return null;
 // Conservative front-facing fitting. Crossed arms and near-vertical raised
 // arms are not safe for a fixed 2D mesh, so leave the original frame intact.
 const arm=(ids,side)=>{
  const s=p(ids[0]),e=p(ids[1]),end=long?p(ids[2]):mix(s,e,.83);
  const d=unit(sub(end,s));if(!d||len(sub(end,s))<span*.22)return null;
  if(side*dot(sub(e,mid),across)<span*.06||dot(sub(end,s),down)<-span*.18)return null;
  const normal=point(-d.y,d.x);
  const out=dot(normal,mul(across,side))>=0?normal:mul(normal,-1);
  const half=span*(long?.105:.15);
  return {outer:add(end,mul(out,half)),inner:add(end,mul(out,-half))};
 };
 const L=arm(l,-1),R=arm(r,1);if(!L||!R)return null;
 const shoulder=(s,side)=>add(add(s,mul(across,side*span*.065)),mul(down,-span*.055));
 const armpit=(s,hip,side)=>add(mix(s,hip,.29),mul(across,side*span*.035));
 const hem=(p,side)=>add(add(p,mul(across,side*span*.10)),mul(down,span*.015));
 const out={ls:shoulder(ls,-1),neck:add(mid,mul(down,-span*.09)),rs:shoulder(rs,1),
 la:armpit(ls,lh,-1),ra:armpit(rs,rh,1),lh:hem(lh,-1),rh:hem(rh,1),
 lco:L.outer,lci:L.inner,rco:R.outer,rci:R.inner};
 // Don't render when the product extends beyond the sampled frame.
 if(!names.every(k=>valid(out[k])&&out[k].x>=0&&out[k].x<=w&&out[k].y>=0&&out[k].y<=h))return null;
 return out;
}
function triangles(a){
 const top=[a.ls,a.neck,a.rs],mid=[a.la,mix(a.la,a.ra,.5),a.ra],hem=[a.lh,mix(a.lh,a.rh,.5),a.rh];
 const v=[...top,...mid,...hem,a.lco,a.lci,a.rco,a.rci];
 // 8 torso triangles + 2 per sleeve. Sleeve seams share vertices.
 return {v,tri:[[0,1,4],[0,4,3],[1,2,5],[1,5,4],[3,4,7],[3,7,6],[4,5,8],[4,8,7],[0,9,10],[0,10,3],[2,11,12],[2,12,5]]};
}
function buildMesh(asset,pose,w,h){
 if(!validAnchors(asset?.anchors))return null;
 const dest=targetAnchors(pose,w,h,asset.sleeves);if(!dest)return null;
 const src=triangles(asset.anchors),dst=triangles(dest);
 return {uv:src.v,vertices:dst.v,triangles:src.tri};
}
function drawCutout(ctx,asset,pose,w,h,{strength=.9}={}){
 const tex=asset?.canvas,mesh=buildMesh(asset,pose,w,h);
 if(!ctx||!tex?.width||!tex?.height||!mesh)return false;
 const affine=root.RawnakFitProductTransfer.affine;
 const plans=mesh.triangles.map(tri=>{
  const src=tri.map(i=>point(mesh.uv[i].x*tex.width,mesh.uv[i].y*tex.height));
  const dst=tri.map(i=>mesh.vertices[i]),m=affine(src,dst);
  const area=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  // A flipped triangle indicates a crossed/folded sleeve or bad source anchors.
  if(!m||area(...src)*area(...dst)<=0||Math.abs(area(...dst))<2)return null;
  return {dst,m};
 });
 if(plans.some(p=>!p))return false;
 ctx.save();try{
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  for(const {dst,m} of plans){
   ctx.save();try{
    // Small overlap avoids thin seams; final mask protects non-clothing.
    const c=mul(add(add(dst[0],dst[1]),dst[2]),1/3);
    const q=dst.map(p=>add(p,mul(unit(sub(p,c))||point(0,0),.65)));
    ctx.beginPath();ctx.moveTo(q[0].x,q[0].y);ctx.lineTo(q[1].x,q[1].y);ctx.lineTo(q[2].x,q[2].y);ctx.closePath();ctx.clip();
    ctx.transform(...m);ctx.drawImage(tex,0,0);
   }finally{ctx.restore();}
  }
 }finally{ctx.restore();}
 return {alpha:Math.max(.4,Math.min(1,Number(strength)||.9)),triangles:plans.length};
}
root.RawnakFitGarmentCutout={names,defaultAnchors,validAnchors,prepareCutout,targetAnchors,buildMesh,drawCutout};
})(typeof window!=='undefined'?window:globalThis);
