// RAWNAK FIT — zero-form upload-only asset router.
// User uploads photos; all category, template and material hypotheses are inferred.
// No product dimension or approved-geometry claim may originate from these guesses.
import {classifyProduct} from './engine.js';

export const PHOTO_TEMPLATES=Object.freeze({
 watch:{id:'watch-round',renderer:'watch',family:'rigid-hybrid',label:'ساعة',tracking:'wrist',
   preview:'ساعة دائرية بقالب عام',approach:'frame-and-strap',ready:true},
 ring:{id:'ring-band',renderer:'ring',family:'rigid',label:'خاتم',tracking:'finger',
   preview:'قالب خاتم عام بحلقة وفص',approach:'ring-parametric',ready:true},
 bangle:{id:'bracelet-loop',renderer:'bracelet',family:'linked',label:'أسورة أو غويشة',tracking:'wrist',
   preview:'قالب أسورة تقريبي',approach:'linked-or-rigid',ready:true},
 glasses:{id:'glasses-frame',renderer:'glasses',family:'hinged',label:'نظارة',tracking:'face',
   preview:'إطار نظارة عام',approach:'frame-lenses',ready:true},
 earrings:{id:'earring-pair',renderer:'earrings',family:'rigid-hybrid',label:'حلق',tracking:'ear',
   preview:'زوج حلقات عام للتجربة',approach:'ear-attachment',ready:true},
 bag:{id:'bag-strap',renderer:'bag',family:'hybrid',label:'شنطة',tracking:'torso',
   preview:'شنطة عامة بحزام',approach:'bag-body-strap',ready:true},
 shoes:{id:'shoes-pair',renderer:'shoes',family:'hybrid',label:'حذاء',tracking:'foot',
   preview:'حذاء عام',approach:'sole-upper',ready:true},
 tshirt:{id:'tee-pattern',renderer:'tee',family:'cloth',label:'تيشيرت',tracking:'body',
   preview:'تيشيرت مرجعي بعظام، غير مطابق للمنتج',approach:'pattern-skinning',ready:true},
 hoodie:{id:'hoodie-pattern',renderer:'tee',family:'cloth',label:'هودي',tracking:'body',
   preview:'قالب تيشيرت مؤقت، وليس هودي مطابقًا',approach:'hood-pattern',ready:false},
 jacket:{id:'jacket-pattern',renderer:'jacket',family:'cloth',label:'جاكيت',tracking:'body',
   preview:'جاكيت هندسي تجريبي',approach:'jacket-pattern',ready:true},
 dress:{id:'dress-pattern',renderer:null,family:'cloth',label:'فستان',tracking:'body',
   preview:'قالب الفستان لم يُربط بعد',approach:'dress-simulation',ready:false}
});
export const PHOTO_VIEWS=Object.freeze(['front','back','left','right','top','bottom','detail','unknown']);
const viewHint=[
 ['front',/(?:front|face|أمام|امام|واجهة)/i],
 ['back',/(?:back|rear|خلف|ظهر)/i],
 ['left',/(?:left|يسار|شمال)/i],
 ['right',/(?:right|يمين)/i],
 ['top',/(?:top|upper|فوق|أعلى)/i],
 ['bottom',/(?:bottom|under|أسفل)/i],
 ['detail',/(?:detail|macro|closeup|texture|تفاصيل|ملمس)/i]
];
export function inferViewFromFilename(filename=''){
 const value=String(filename||'');
 const found=viewHint.find(([,rx])=>rx.test(value));
 return found?{view:found[0],source:'filename-hint',confidence:'low'}:
   {view:'unknown',source:'unresolved',confidence:'none'};
}
export function inferTemplate(images,predictions=[]){
 const first=images?.[0];
 const names=(images||[]).map(x=>String(x?.name||'')).join(' ');
 const results=classifyProduct(names,predictions);
 const category=Object.hasOwn(PHOTO_TEMPLATES,results.category)?results.category:null;
 const template=category?PHOTO_TEMPLATES[category]:null;
 const uncertain=!template||results.method==='filename'||results.method==='conflict'||
   results.requiresReview===true;
 return {
   category,templateId:template?.id||null,renderer:template?.renderer||null,
   family:template?.family||null,label:template?.label||'لم يتم تحديد نوع المنتج',
   tracking:template?.tracking||null,recognitionSource:results.method,
   modelLabel:results.modelLabel||null,confidence:results.confidence||null,
   uncertain,previewAvailable:Boolean(template?.ready&&template?.renderer),
   previewOnly:true,reconstructionConnected:false,
   expectedSizeMeasured:false,merchantApproved:false,
   needsPhotoReconstruction:true,sourcePhotoCount:images?.length||0,
   evidence: first ? {filenameHint:inferViewFromFilename(first.name)} : null
 };
}
export function createAutoDraft(files,match,colorHint=null){
 return {
  schemaVersion:2,mode:'photo-only',createdBy:'RAWNAK FIT Automatic Template Pilot',
  input:{photos:(files||[]).map(p=>({
    name:String(p.name||'').slice(0,120),width:Number(p.width)||0,
    height:Number(p.height)||0,bytes:Number(p.bytes)||0,
    estimatedView:inferViewFromFilename(p.name)
  }))},
  selection:match,
  materialHint:colorHint?.color?{color:colorHint.color,
    confidence:colorHint.confidence||'low',approved:false}:null,
  model:{templateId:match.templateId,status:match.previewAvailable?'template-preview':'no-template-preview',
    reconstructedFromPhotos:false,actualDimensionsKnown:false,
    accurate360:false,liveFitAccurate:false},
  permissions:{merchantRightsNotYetVerified:true,merchantApproved:false,
    readyForPublication:false},
  privacy:{imageBytesIncluded:false,generatorApiConnected:false,
    note:'Photos remain in browser; export contains only metadata'}
 };
}
