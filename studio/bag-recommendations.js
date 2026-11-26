// Evidence-driven recommendations; never infer hidden construction from pixels.
// The merchant confirms views and any structural observations before applying.
import {PATTERNS,FAMILY_PRESETS} from './bag-patterns.js';
import {BAG_MATERIALS,BAG_CLOSURES} from './bag-spec.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rms=(a,b)=>Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0)/a.length);
const validProfile=p=>Array.isArray(p)&&p.length===5&&p.every(v=>Number.isFinite(v)&&v>=.35&&v<=1);
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const hex=a=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const isConfirmed=p=>p&&p.linked===true&&p.source==='merchant'&&typeof p.id==='string'&&p.id.length>0;
export const OBSERVATIONS=Object.freeze({
 material:{label:'الخامة',views:['material','detail'],values:Object.keys(BAG_MATERIALS)},
 closure:{label:'التقفيل',views:['closure','top','open'],values:Object.keys(BAG_CLOSURES)},
 handlesCount:{label:'عدد الأيدي',views:['front','back','handles'],min:0,max:2},
 strapCount:{label:'عدد الأحزمة',views:['strap','front','back'],min:0,max:2},
 mainCompartments:{label:'عدد الأقسام الرئيسية',views:['inside','open','compartments'],min:1,max:5},
 innerOpenPockets:{label:'الجيوب الداخلية المفتوحة',views:['inside','pockets'],min:0,max:8},
 innerZippedPockets:{label:'الجيوب الداخلية بسوستة',views:['inside','pockets'],min:0,max:8},
 outerPockets:{label:'الجيوب الخارجية',views:['front','back','outer'],min:0,max:8},
});
export function validObservation(key,value,photo){
 const rule=Object.hasOwn(OBSERVATIONS,key)?OBSERVATIONS[key]:null;if(!rule||!isConfirmed(photo)||!rule.views.includes(photo.view))return false;
 return rule.values?rule.values.includes(value):Number.isInteger(value)&&value>=rule.min&&value<=rule.max;
}
export function recommendBag(spec,images,observations=[]){
 const byId=new Map(images.filter(isConfirmed).map(p=>[p.id,p])),confirmed=[...byId.values()];
 const front=confirmed.filter(p=>['front','back'].includes(p.view)&&p.analysis?.status==='candidate'&&validProfile(p.analysis.widthProfile));
 const proposals=[],conflicts=[],ranking=[];
 const add=(key,value,sources,method)=>{if(spec[key]!==value)proposals.push({key,value,sources:[...new Set(sources)],method});};
 if(front.length){
  const conflict=front.some(a=>front.some(b=>Math.max(...a.analysis.widthProfile.map((v,i)=>Math.abs(v-b.analysis.widthProfile[i])))>.24));
  if(conflict)conflicts.push('silhouette');
  else{
   const avg=Array.from({length:5},(_,i)=>front.reduce((s,p)=>s+p.analysis.widthProfile[i],0)/front.length);
   // Rank by envelope and a weak aspect cue. No absolute dimensions inferred.
   const aspects=front.map(p=>p.analysis.bodyAspect).filter(v=>Number.isFinite(v)&&v>.3&&v<6);
   const ratio=aspects.length?median(aspects):null;
   for(const [style,p] of Object.entries(PATTERNS)){
    const preset=FAMILY_PRESETS[style],profile=p.width.map(v=>v/Math.max(...p.width));
    const shape=rms(avg,profile);
    const aspect=ratio?Math.min(.4,Math.abs(Math.log(ratio/(preset.widthCm/preset.heightCm)))):0;
    ranking.push({style,error:shape+.15*aspect});
   }
   ranking.sort((a,b)=>a.error-b.error);
   if(ranking[0].error<=.20&&ranking[1].error-ranking[0].error>=.025)add('style',ranking[0].style,front.map(p=>p.id),'silhouette');
  }
  const colors=front.filter(p=>/^#[a-f0-9]{6}$/i.test(p.analysis.color||''));
  if(colors.length){
   const values=colors.map(p=>rgb(p.analysis.color));
   const disagree=values.some(a=>values.some(b=>Math.hypot(...a.map((v,i)=>v-b[i]))>70));
   if(disagree)conflicts.push('bodyColor');else add('bodyColor',hex([0,1,2].map(i=>median(values.map(v=>v[i])))),colors.map(p=>p.id),'foreground-color');
  }
 }
 for(const key of Object.keys(OBSERVATIONS)){
  const entries=observations.filter(o=>o?.key===key&&validObservation(key,o.value,byId.get(o.photoId)));
  if(!entries.length)continue;
  if(new Set(entries.map(o=>o.value)).size>1){conflicts.push(key);continue;}
  add(key,entries[0].value,entries.map(o=>o.photoId),'merchant-observation');
 }
 return {proposals,conflicts,ranking:ranking.slice(0,3),confirmedViews:[...new Set(confirmed.map(p=>p.view))],limitations:['No material classification from RGB','No hidden geometry or absolute measurements inferred','All proposals require review']};
}
export function selectedPatch(report,selected){
 const patch={},sources=[];
 for(const p of report.proposals){if(!selected.includes(p.key))continue;patch[p.key]=p.value;sources.push(...p.sources);}
 return {patch,sources:[...new Set(sources)]};
}
