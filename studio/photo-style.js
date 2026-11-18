// RAWNAK FIT color hint, photo to material v0.1.
// Heuristic foreground swatch only; never claim to infer cloth construction or textures.
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rgb=(r,g,b)=>'#'+[r,g,b].map(x=>Math.round(clamp(x,0,255)).toString(16).padStart(2,'0')).join('');
const delta=(a,b)=>Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);
function median(a){const sorted=[...a].sort((x,y)=>x-y);return sorted[Math.floor(sorted.length/2)]??0;}
export function estimateForegroundColor(rgba,width,height){
  if(!rgba||!Number.isInteger(width)||!Number.isInteger(height)||
    width<10||height<10||rgba.length<width*height*4)throw new Error('بيانات الصورة غير صالحة');
  // Four 6% corner patches estimate a uniform product photography background.
  const patches=[[],[],[]];
  const size=Math.max(2,Math.floor(Math.min(width,height)*.06));
  for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
    if(!((x<size||x>=width-size)&&(y<size||y>=height-size)))continue;
    const i=(y*width+x)*4;if(rgba[i+3]<160)continue;
    for(let c=0;c<3;c++)patches[c].push(rgba[i+c]);
  }
  const background=patches.map(median);
  const buckets=new Map();
  let candidateCount=0,nonTransparent=0;
  const x0=Math.floor(width*.09),x1=Math.ceil(width*.91);
  const y0=Math.floor(height*.09),y1=Math.ceil(height*.91);
  for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
    const i=(y*width+x)*4;if(rgba[i+3]<160)continue;
    nonTransparent++;
    const p=[rgba[i],rgba[i+1],rgba[i+2]];
    if(delta(p,background)<45)continue;
    candidateCount++;
    const key=p.map(v=>Math.floor(v/32)).join('-');
    const row=buckets.get(key)||{weight:0,sum:[0,0,0]};
    const dx=Math.abs(x-width/2)/(width/2),dy=Math.abs(y-height/2)/(height/2);
    const weight=1+.35*(1-Math.min(1,Math.hypot(dx,dy)));
    row.weight+=weight;
    for(let c=0;c<3;c++)row.sum[c]+=p[c]*weight;
    buckets.set(key,row);
  }
  if(candidateCount<25||!buckets.size)return {
    color:null,status:'insufficient-contrast',method:'background-subtraction-color-histogram',
    confidence:'low',background:rgb(...background),
    reason:'الخلفية والمنتج متشابهين أو جزء المنتج غير واضح'
  };
  const choice=[...buckets.values()].sort((a,b)=>b.weight-a.weight)[0];
  const coverage=candidateCount/Math.max(1,nonTransparent);
  const peak=choice.weight/Math.max(1,candidateCount);
  const confidence=coverage>=.10&&peak>=.13?'medium':'low';
  return {
    color:rgb(...choice.sum.map(x=>x/choice.weight)),status:'suggested',confidence,
    method:'background-subtraction-color-histogram',background:rgb(...background),
    foregroundCoverage:Math.round(coverage*100),reason:'تقدير بصري تقريبي، يحتاج تأكيد التاجر'
  };
}
export async function estimateColorFromImageFile(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('صيغة الصورة غير مدعومة');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.decoding='async';img.src=url;await img.decode();
    const max=320;
    const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const width=Math.max(10,Math.round(img.naturalWidth*ratio));
    const height=Math.max(10,Math.round(img.naturalHeight*ratio));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('لا يمكن تحليل الصور بدون Canvas');
    ctx.drawImage(img,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height);
    return estimateForegroundColor(pixels.data,width,height);
  }finally{URL.revokeObjectURL(url);}
}
