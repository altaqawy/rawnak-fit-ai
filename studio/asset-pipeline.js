// RAWNAK FIT Asset Pipeline v0.1 — pure data logic, no uploads or AI API calls.
// Category capture recommendations are not a proof of authentic 3D geometry.
import { getCaptureProfile } from './capture-profiles.js';

export const PILOTS=Object.freeze({
  tshirt:{label:'تيشيرت',family:'garment',model:'pattern-and-rig',primary:'GarmentCode',secondary:'SwiftTailor',
    requiredViews:['front','back','left','right','detail'],
    measures:[['chest','عرض الصدر','cm'],['shoulder','عرض الكتف','cm'],['length','طول القطعة','cm'],['sleeve','طول الكم','cm']],
    recommendedTemplate:'crew-neck-set-in-sleeve',templateVersion:'pattern-v0',liveEngine:'pose-garment'},
  watch:{label:'ساعة',family:'rigid-hybrid',model:'parametric-and-multiview',primary:'Parametric Watch',secondary:'Meshy Multi-Image',
    requiredViews:['front','back','left','right','top','detail'],
    measures:[['case','قطر جسم الساعة','mm'],['thickness','سُمك الساعة','mm'],['strap','عرض السوار','mm']],
    recommendedTemplate:'round-case-two-part-strap',templateVersion:'watch-v0',liveEngine:'hand-watch'},
  bag:{label:'شنطة',family:'hybrid',model:'multiview-and-structured-strap',primary:'Multi-view/Photogrammetry',secondary:'Meshy Multi-Image',
    requiredViews:['front','back','left','right','top','inside','detail'],
    measures:[['width','العرض','cm'],['height','الارتفاع','cm'],['depth','العمق','cm'],['strap','طول الحزام','cm']],
    recommendedTemplate:'structured-shoulder-bag',templateVersion:'bag-v0',liveEngine:'pose-bag'}
});
export const VIEW_LABELS=Object.freeze({
  front:'أمام',back:'خلف',left:'جانب أيسر',right:'جانب أيمن',top:'أعلى',
  bottom:'أسفل',inside:'الداخل',detail:'تفاصيل/خياطة',angle:'زاوية مائلة'
});
const allowedExt=/\.(jpg|jpeg|png|webp)$/i;
export function validatePhotoMetadata(photo){
  const problems=[];
  if(!photo || typeof photo.name!=='string' || !allowedExt.test(photo.name))problems.push('unsupported-format');
  const bytes=Number(photo?.bytes);
  if(!Number.isFinite(bytes)||bytes<=0||bytes>10*1024*1024)problems.push('file-size');
  const w=Number(photo?.width),h=Number(photo?.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)problems.push('missing-resolution');
  else if(Math.max(w,h)<2000)problems.push('low-resolution');
  if(!Object.hasOwn(VIEW_LABELS,photo?.view))problems.push('unassigned-view');
  return problems;
}
export function getPilot(category){return Object.hasOwn(PILOTS,category)?PILOTS[category]:null;}
export function evaluatePilot(input){
  const plan=getPilot(input?.category);
  if(!plan)throw new Error('الفئة غير مدعومة في التجربة الأولى');
  const photos=Array.isArray(input.photos)?input.photos:[];
  const profile=getCaptureProfile(input.category);
  const counts={};
  const photoProblems=[];
  for(const [index,p] of photos.entries()){
    if(Object.hasOwn(VIEW_LABELS,p.view)) counts[p.view]=(counts[p.view]||0)+1;
    const issues=validatePhotoMetadata(p);
    if(issues.length)photoProblems.push({index,name:String(p.name||'').slice(0,150),issues});
  }
  const missingViews=plan.requiredViews.filter(view=>!counts[view]);
  const measurements={};
  const missingMeasurements=[];
  for(const [key,label,unit] of plan.measures){
    const raw=input?.measurements?.[key];
    const value=raw===''||raw==null?null:Number(raw);
    if(!Number.isFinite(value)||value<=0||value>5000){missingMeasurements.push(key);continue;}
    measurements[key]={value,unit,label};
  }
  const photosEnough=photos.length>=profile.previewMin;
  const angleCoverage=missingViews.length===0;
  const imagesValid=photoProblems.length===0;
  const measurementsComplete=missingMeasurements.length===0;
  const rightsConfirmed=input.rightsConfirmed===true;
  const categoryConfirmed=input.categoryConfirmed===true;
  const intakeReady=photosEnough && angleCoverage && imagesValid && measurementsComplete && rightsConfirmed && categoryConfirmed;
  const score=Math.round(100*(
    .25*Math.min(1,photos.length/profile.previewMin)+
    .25*(1-missingViews.length/plan.requiredViews.length)+
    .20*(1-missingMeasurements.length/plan.measures.length)+
    .15*(imagesValid?(photos.length?1:0):0)+
    .075*(rightsConfirmed?1:0)+
    .075*(categoryConfirmed?1:0)
  ));
  const blockers=[];
  if(!photosEnough)blockers.push('الصور أقل من حد التجربة المبدئية: '+photos.length+'/'+profile.previewMin);
  if(missingViews.length)blockers.push('زوايا ناقصة: '+missingViews.map(x=>VIEW_LABELS[x]).join('، '));
  if(missingMeasurements.length)blockers.push('مقاسات ناقصة: '+missingMeasurements.map(x=>plan.measures.find(m=>m[0]===x)[1]).join('، '));
  if(photoProblems.length)blockers.push('صور تحتاج مراجعة الدقة/النوع/الزاوية: '+photoProblems.length);
  if(!rightsConfirmed)blockers.push('يلزم تأكيد حق استخدام الصور');
  if(!categoryConfirmed)blockers.push('يلزم تأكيد الفئة يدويًا');
  return {
    category:input.category,qualityScore:Math.max(0,Math.min(100,score)),
    totalPhotos:photos.length,previewMin:profile.previewMin,
    verifiedMin:profile.verifiedMin,verifiedTarget:profile.verifiedTarget,
    viewCounts:counts,missingViews,missingMeasurements,measurements,
    photoProblems,rightsConfirmed,categoryConfirmed,
    intakeReady,blockers,
    reconstructionStatus:'not-connected',modelVerification:'unverified',
    merchantApproved:false,physicalFitVerified:false,
    publicationAllowed:false,verified360:false
  };
}
export function createAssetDraft(input){
  const plan=getPilot(input?.category);
  if(!plan)throw new Error('الفئة غير متاحة');
  const report=evaluatePilot(input);
  const sku=String(input.sku||'').trim().slice(0,64);
  const title=String(input.name||'').trim().slice(0,100);
  if(!title||!sku)throw new Error('اسم المنتج والـSKU مطلوبان لتصدير الملف');
  return {
    schemaVersion:1,source:'RAWNAK FIT AutoFit Studio Asset Library Pilot',
    product:{name:title,sku,category:input.category,family:plan.family,variant:String(input.variant||'').slice(0,80)},
    proposal:{templateId:plan.recommendedTemplate,templateVersion:plan.templateVersion,
      processing:plan.model,primary:plan.primary,secondary:plan.secondary,liveEngine:plan.liveEngine},
    images:(input.photos||[]).map(p=>({name:String(p.name||'').slice(0,150),view:p.view,width:Number(p.width),height:Number(p.height),bytes:Number(p.bytes),issues:validatePhotoMetadata(p)})),
    dimensions:report.measurements,
    visualHint: input.visualEstimate && /^#[0-9a-f]{6}$/i.test(input.visualEstimate.color||'')
      ? {baseColor:input.visualEstimate.color,
          source:'approximate-photo-histogram',approved:false,
          confidence:input.visualEstimate.confidence==='medium'?'medium':'low'}
      : null,
    quality:{...report,blockers:[...report.blockers, 'يلزم إنشاء/استيراد GLB مطابق ثم التحقق البصري والموافقة']},
    uploadedGlb: input.localGlb ? {name:String(input.localGlb.name||'').slice(0,150),
      bytes:Number(input.localGlb.bytes)||0,previewOnly:true,includedInExport:false}:null,
    approval:{sellerRightsConfirmed:report.rightsConfirmed,merchantApproved:false,geometryApproved:false,
      licenseVerified:false,sizeVerified:false,readyForPublication:false},
    stage:report.intakeReady?'ready-for-reconstruction':'needs-intake',
    privacy:'image bytes, previews and local GLB bytes are NOT included in this JSON',
    expectedCosts:'cost is determined only after external reconstruction provider connection'
  };
}
export function selectRecommendedRoute(category){
 const p=getPilot(category);if(!p)return null;
 return {category,template:p.recommendedTemplate,primary:p.primary,secondary:p.secondary,engine:p.liveEngine,
   generationEnabled:false,requiresReview:true};
}
