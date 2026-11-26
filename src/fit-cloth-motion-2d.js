/* Experimental 2D cloth motion: spring-driven, bounded mesh deformation.
 * This is a screen-space visual approximation, not a physical textile solver.
 * Boundary vertices remain attached, and inverted triangles are rejected.
 */
(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const profiles=Object.freeze({cotton:{k:110,d:17,gain:.55,limit:.023},silk:{k:72,d:11,gain:.85,limit:.034},denim:{k:180,d:25,gain:.27,limit:.012}});
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function subdivide(mesh){
 const uv=mesh.uv.map(p=>({...p})),vertices=mesh.vertices.map(p=>({...p})),triangles=[],edges=new Map();
 const key=(a,b)=>a<b?a+':'+b:b+':'+a;
 for(const t of mesh.triangles)for(let i=0;i<3;i++){
  const a=t[i],b=t[(i+1)%3],k=key(a,b);const e=edges.get(k);
  if(e)e.count++;else edges.set(k,{a,b,count:1,index:null});
 }
 const pinned=new Set();
 for(const e of edges.values())if(e.count===1){pinned.add(e.a);pinned.add(e.b);}
 const avg=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 for(const e of edges.values()){
  e.index=vertices.length;vertices.push(avg(vertices[e.a],vertices[e.b]));uv.push(avg(uv[e.a],uv[e.b]));
  if(e.count===1)pinned.add(e.index);
 }
 for(const [a,b,c] of mesh.triangles){
  const ab=edges.get(key(a,b)).index,bc=edges.get(key(b,c)).index,ca=edges.get(key(c,a)).index;
  triangles.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
 }
 return {uv,vertices,triangles,pinned};
}
class ClothSpring{
 constructor(){this.reset();}
 reset(){this.last=null;this.x=0;this.y=0;this.vx=0;this.vy=0;}
 update(pose,timestamp,material='cotton'){
  const p=profiles[material]||profiles.cotton;
  const a=pose?.[11],b=pose?.[12],c=pose?.[23],d=pose?.[24];
  if(![a,b,c,d].every(v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&(v.visibility??1)>=.55)||!Number.isFinite(timestamp)){this.reset();return {x:0,y:0};}
  const center={x:(a.x+b.x+c.x+d.x)/4,y:(a.y+b.y+c.y+d.y)/4};
  const span=Math.hypot(a.x-b.x,a.y-b.y);
  if(span<.06){this.reset();return {x:0,y:0};}
  if(!this.last||timestamp<=this.last.t||timestamp-this.last.t>500||this.last.material!==material){
   this.reset();this.last={...center,t:timestamp,material};return {x:0,y:0};
  }
  const dt=(timestamp-this.last.t)/1000;
  // Lag the cloth relative to body motion. Spring integrates in small substeps.
  const tx=clamp(-(center.x-this.last.x)/span*p.gain,-p.limit,p.limit);
  const ty=clamp(-(center.y-this.last.y)/span*p.gain,-p.limit,p.limit);
  this.last={...center,t:timestamp,material};
  const steps=Math.max(1,Math.ceil(dt/.012)),h=dt/steps;
  for(let i=0;i<steps;i++){
   this.vx+=(p.k*(tx-this.x)-p.d*this.vx)*h;this.vy+=(p.k*(ty-this.y)-p.d*this.vy)*h;
   this.x=clamp(this.x+this.vx*h,-p.limit,p.limit);this.y=clamp(this.y+this.vy*h,-p.limit,p.limit);
  }
  return {x:this.x,y:this.y};
 }
}
function deform(mesh,offset,w,h){
 const fine=subdivide(mesh),span=Math.hypot(mesh.vertices[2].x-mesh.vertices[0].x,mesh.vertices[2].y-mesh.vertices[0].y);
 if(!Number.isFinite(span)||span<1||!Number.isFinite(offset?.x)||!Number.isFinite(offset?.y))return fine;
 const dx=clamp(offset.x,-.04,.04)*span,dy=clamp(offset.y,-.04,.04)*span;
 const vertices=fine.vertices.map((p,i)=>{
  if(fine.pinned.has(i))return p;
  const weight=clamp(fine.uv[i].y,.15,1);
  return {x:clamp(p.x+dx*weight,0,w),y:clamp(p.y+dy*weight,0,h)};
 });
 // Never distort a triangle past half its original area or flip winding.
 const safe=fine.triangles.every(t=>{
  const a=cross(...t.map(i=>fine.vertices[i])),b=cross(...t.map(i=>vertices[i]));
  return Math.abs(a)>0.01&&a*b>0&&Math.abs(b)>=Math.abs(a)*.5;
 });
 return safe?{...fine,vertices}:fine;
}
root.RawnakFitClothMotion={ClothSpring,subdivide,deform,profiles};
})(typeof window!=='undefined'?window:globalThis);
