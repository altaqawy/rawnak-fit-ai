import {PATTERNS,clamp} from './bag-patterns.js';

const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
const failed=reason=>({method:'local-silhouette',status:'abstained',reason});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function analysePixels(data,w,h){
  if(w<16||h<16||data?.length!==4*w*h)return failed('resolution');
  const pixel=i=>[data[4*i],data[4*i+1],data[4*i+2]], border=[];
  for(let x=0;x<w;x++){border.push(x,(h-1)*w+x);}
  for(let y=1;y<h-1;y++){border.push(y*w,y*w+w-1);}
  const alpha=border.filter(i=>data[i*4+3]<24).length/border.length>.82;
  const bg=[0,1,2].map(c=>median(border.map(i=>data[i*4+c])));
  const noise=border.map(i=>distance(pixel(i),bg)).sort((a,b)=>a-b);
  if(!alpha&&noise[Math.floor(noise.length*.85)]>32)return failed('complex-background');
  const threshold=Math.max(29,noise[Math.floor(noise.length*.85)]*2.4+11);
  const mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
  for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>95&&(alpha||distance(pixel(i),bg)>threshold)?1:0;
  let largest=[],second=0;
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    let head=0,tail=1;queue[0]=i;mask[i]=0;
    while(head<tail){
      const p=queue[head++],x=p%w;
      for(const n of [x?p-1:-1,x<w-1?p+1:-1,p-w,p+w]){
        if(n<0||n>=mask.length||!mask[n])continue;
        mask[n]=0;queue[tail++]=n;
      }
    }
    if(tail>largest.length){second=largest.length;largest=queue.slice(0,tail);}
    else second=Math.max(second,tail);
  }
  const coverage=largest.length/(w*h);
  if(coverage<.04||coverage>.89||second>largest.length*.24)return failed('ambiguous-object');
  const rows=Array.from({length:h},()=>({min:w,max:-1,count:0})),colors=[[],[],[]];
  let clipped=0;
  for(const [k,i] of largest.entries()){
    const x=i%w,y=Math.floor(i/w),r=rows[y];r.min=Math.min(r.min,x);r.max=Math.max(r.max,x);r.count++;
    if(x===0||x===w-1||y===0||y===h-1)clipped++;
    if(k%5===0)pixel(i).forEach((v,c)=>colors[c].push(v));
  }
  if(clipped>1)return failed('clipped');
  const widths=rows.map(r=>Math.max(0,r.max-r.min+1)),maxWidth=Math.max(...widths);
  const broad=rows.map((r,i)=>widths[i]>.35*maxWidth&&r.count/widths[i]>.56);
  let best=[0,0],start=0;
  for(let i=0;i<=h;i++){
    if(i<h&&broad[i])continue;
    if(i-start>best[1]-best[0])best=[start,i];
    start=i+1;
  }
  const [top,end]=best,bodyH=end-top;
  if(bodyH<h*.16||maxWidth<w*.2)return failed('unresolved-body');
  const widthAt=f=>{
    const y=Math.round(top+(bodyH-1)*(1-f));
    return Math.max(.35,median(widths.slice(Math.max(top,y-1),Math.min(end,y+2)))/maxWidth);
  };
  const envelope=[.035,.25,.5,.75,.965].map(widthAt);
  const bands=[];
  for(let y=0;y<h;y+=Math.max(1,Math.floor(h/64))){
    const r=rows[y];if(r.count)bands.push([y/h,r.min/w,(r.max+1)/w]);
  }
  const color='#'+colors.map(a=>median(a).toString(16).padStart(2,'0')).join('');
  const rank=Object.entries(PATTERNS).map(([style,p])=>({style,
    error:Math.sqrt(p.width.reduce((sum,v,i)=>sum+(v-envelope[i])**2,0)/5)})).sort((a,b)=>a.error-b.error);
  return {status:'candidate',method:alpha?'alpha-mask':'uniform-background-contrast',confidence:'low',
    widthProfile:envelope,color,coverage,bodyAspect:maxWidth/bodyH,bands,ranking:rank.slice(0,3)};
}
export const STAGES=Object.freeze({
  objectMask:'conditional-local',partSegmentation:'unavailable',viewpoint:'merchant-confirmed-or-filename-hint',
  templateMatching:'silhouette-ranking',deformation:'bounded-width-profile',
  material:'explicit-swatch-or-local-color-cue',multiView:'front-back-width-consistency',
  textureProjection:'explicit-logo-and-UV-maps',interiorInference:'unavailable',modelTraining:'off'
});
export function fitFromEvidence(images){
  const views=images.filter(p=>p.linked!==false&&['front','back'].includes(p.view)&&p.source==='merchant'&&p.analysis?.status==='candidate');
  if(!views.length)return {status:'needs-confirmed-frontal-view',fit:null};
  const spread=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  const first=views[0].analysis.widthProfile;
  if(views.some(v=>spread(v.analysis.widthProfile,first)>.24))return {status:'inconsistent-views',fit:null};
  const widths=first.map((_,i)=>views.reduce((s,v)=>s+v.analysis.widthProfile[i],0)/views.length);
  return {status:'candidate',fit:{method:'bounded-frontal-envelope',widths:widths.map(v=>clamp(v,.35,1)),sources:views.map(v=>v.id)},
    color:views[0].analysis.color,ranking:views[0].analysis.ranking};
}
export function sourceMetadata(p){
  return {id:p.id,name:p.name,view:p.view,source:p.source,bytes:p.bytes,width:p.width,height:p.height,
    analysis:p.analysis||null,linked:Boolean(p.url)};
}
export async function readLocalPhoto(file){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>10*1024*1024)throw Error('format');
  const bytes=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  const id=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const scale=Math.min(1,160/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const analysis=analysePixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
    return {id,name:file.name,url,bytes:file.size,width:img.naturalWidth,height:img.naturalHeight,analysis};
  }catch(e){URL.revokeObjectURL(url);throw e;}
}
