/**
 * RAWNAK FIT — Bag Parts Specification, v0.1.
 * All dimensions here are measured merchant inputs in centimeters.
 * Images are evidence, not a source of exact unseen geometry or cloth physics.
 * Parts and joints define what may move; physical simulation is a later gate.
 */
export const BAG_STYLES=Object.freeze({
  structured:{name:'Structured / Satchel',shape:'box',family:'structured'},
  tote:{name:'Tote / Shopper',shape:'tapered',family:'structured'},
  baguette:{name:'Baguette / Shoulder',shape:'wide',family:'structured'},
  hobo:{name:'Hobo / Crescent',shape:'soft-curve',family:'soft'},
  bucket:{name:'Bucket / Drawstring',shape:'bucket',family:'soft'},
  clutch:{name:'Clutch / Pouch',shape:'compact',family:'structured'},
  backpack:{name:'Backpack',shape:'box',family:'structured'},
  saddle:{name:'Saddle / Rounded',shape:'curve',family:'structured'}
});
export const BAG_MATERIALS=Object.freeze({
 leather:{name:'جلد طبيعي',behavior:'semi-rigid',roughness:.76},
 faux_leather:{name:'جلد صناعي',behavior:'semi-rigid',roughness:.79},
 canvas:{name:'قماش Canvas',behavior:'flexible',roughness:.94},
 suede:{name:'شمواه',behavior:'flexible',roughness:.95},
 nylon:{name:'نايلون',behavior:'flexible',roughness:.61},
 woven:{name:'خوص/منسوج',behavior:'semi-rigid',roughness:.9},
 rigid_case:{name:'جسم صلب',behavior:'rigid',roughness:.67}
});
export const BAG_CLOSURES=Object.freeze({
 zipper:{name:'سوستة',mechanism:'slider'},
 flap:{name:'غطاء مفصلي',mechanism:'hinge'},
 magnetic:{name:'مغناطيس/كبّاس',mechanism:'snap'},
 drawstring:{name:'رباط شد',mechanism:'pull'},
 open:{name:'مفتوحة',mechanism:'none'},
 clasp:{name:'قفل معدني',mechanism:'hinge'}
});
export const VIEW_LABELS=Object.freeze({
 front:'الأمام',back:'الخلف',left:'الجانب الأيسر',right:'الجانب الأيمن',
 bottom:'القاعدة',top:'الأعلى/فتحة الشنطة',open:'وهي مفتوحة',inside:'التقسيم الداخلي',
 pockets:'الجيوب من الداخل',strap:'الحزام/اليد',closure:'القفل أو السوستة',
 logo:'صورة الشعار/اللوجو',detail:'تفاصيل/خياطة'
});
const defaults=Object.freeze({
 widthCm:28,heightCm:20,depthCm:11,
 style:'structured',material:'faux_leather',closure:'flap',
 strapType:'shoulder',strapCount:1,strapLengthCm:82,strapWidthCm:2.4,
 handlesCount:1,flexibility:30,
 mainCompartments:2,innerOpenPockets:1,innerZippedPockets:1,outerPockets:0,
 lining:'polyester',logoPlacement:'front',logoType:'print',logoText:'',
 bodyColor:'#996247',metalColor:'#d9be80',
 brandLicenseConfirmed:false
});
const inRange=(v,min,max)=>Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max;
const bounded=(v,min,max,fallback)=>inRange(v,min,max)?Number(v):fallback;
const select=(value,list,fallback)=>Object.hasOwn(list,value)?value:fallback;
const yes=(v)=>v===true;
const color=(v,fallback)=>/^#[a-f\d]{6}$/i.test(String(v||''))?v:fallback;
const BOUNDS=Object.freeze({
 widthCm:[8,85],heightCm:[6,70],depthCm:[2,45],
 strapCount:[0,2],strapLengthCm:[0,210],strapWidthCm:[.4,12],
 handlesCount:[0,2],flexibility:[0,100],
 mainCompartments:[1,5],innerOpenPockets:[0,8],innerZippedPockets:[0,8],outerPockets:[0,8]
});
export const DEFAULT_BAG_SPEC=defaults;
export function createBagSpec(patch={}){
 const x={...defaults};
 for(const [key,[min,max]] of Object.entries(BOUNDS))
   x[key]=bounded(patch[key],min,max,defaults[key]);
 x.strapCount=Math.round(x.strapCount);
 x.handlesCount=Math.round(x.handlesCount);
 x.mainCompartments=Math.round(x.mainCompartments);
 for(const k of ['innerOpenPockets','innerZippedPockets','outerPockets'])x[k]=Math.round(x[k]);
 x.style=select(patch.style,BAG_STYLES,defaults.style);
 x.material=select(patch.material,BAG_MATERIALS,defaults.material);
 x.closure=select(patch.closure,BAG_CLOSURES,defaults.closure);
 x.strapType=['shoulder','crossbody','hand','none','backpack'].includes(patch.strapType)?patch.strapType:defaults.strapType;
 x.lining=['polyester','cotton','leather','none'].includes(patch.lining)?patch.lining:defaults.lining;
 x.logoPlacement=['front','back','inside','none'].includes(patch.logoPlacement)?patch.logoPlacement:defaults.logoPlacement;
 x.logoType=['print','embossed','metal','patch','none'].includes(patch.logoType)?patch.logoType:defaults.logoType;
 x.logoText=String(patch.logoText||'').slice(0,100);
 x.bodyColor=color(patch.bodyColor,defaults.bodyColor);
 x.metalColor=color(patch.metalColor,defaults.metalColor);
 x.brandLicenseConfirmed=yes(patch.brandLicenseConfirmed);
 // Crossbody is a carrying mode, not a unique geometric body.
 if(x.strapType==='none')x.strapCount=0;
 return x;
}
export function requiredBagViews(specInput={}){
 const s=createBagSpec(specInput);
 const required=['front','back','left','right','bottom','top','open','inside'];
 if(s.innerOpenPockets+s.innerZippedPockets+s.outerPockets>0)required.push('pockets');
 if(s.strapCount>0 || s.handlesCount>0)required.push('strap');
 if(s.closure!=='open')required.push('closure');
 if(s.logoPlacement!=='none')required.push('logo');
 return required;
}
export function detectViewFromName(name){
 const str=String(name||'');
 const patterns={
  front:/(?:front|واجهة|امام|أمام)/i,back:/(?:back|rear|خلف|ظهر)/i,
  left:/(?:left|يسار|شمال)/i,right:/(?:right|يمين)/i,
  bottom:/(?:bottom|under|قاعد|اسفل|أسفل)/i,top:/(?:top|opening|اعلى|أعلى|فوق)/i,
  open:/(?:open|opened|مفتوح)/i,inside:/(?:interior|inside|lining|داخل|بطان)/i,
  pockets:/(?:pockets?|جيوب|جيب)/i,strap:/(?:strap|handle|حزام|سير|يد)/i,
  closure:/(?:zipper|zip|clasp|closure|قفل|سوست|مشبك)/i,
  logo:/(?:brand|logo|شعار|لوجو)/i,
  detail:/(?:details?|seam|stitch|تفاصيل|خياط)/i
 };
 for(const view of ['logo','pockets','inside','open','closure','strap','bottom','top','front','back','left','right','detail']){
   if(patterns[view].test(str))return {view,confidence:'low',source:'filename'};
 }
 return {view:'unknown',confidence:'none',source:'unresolved'};
}
export function describeBagComponents(specInput={}){
 const s=createBagSpec(specInput),kind=BAG_MATERIALS[s.material].behavior;
 const components=[
  {id:'front_panel',role:'panel',behavior:kind,moving:false,material:s.material,requires:['front']},
  {id:'back_panel',role:'panel',behavior:kind,moving:false,material:s.material,requires:['back']},
  {id:'left_gusset',role:'side',behavior:kind,moving:false,requires:['left']},
  {id:'right_gusset',role:'side',behavior:kind,moving:false,requires:['right']},
  {id:'bottom_panel',role:'bottom',behavior:'semi-rigid',moving:false,requires:['bottom']},
  {id:'lining',role:'interior',behavior:'flexible',moving:false,requires:['inside']},
  {id:'opening',role:'opening',behavior:'rigid',moving:false,requires:['open']}
 ];
 for(let i=0;i<s.mainCompartments-1;i++)
   components.push({id:'divider_'+(i+1),role:'interior_partition',behavior:'flexible',
     moving:false,requires:['inside']});
 for(let i=0;i<s.innerOpenPockets;i++)
   components.push({id:'inner_open_pocket_'+(i+1),role:'open_pocket',behavior:'flexible',moving:false,requires:['pockets']});
 for(let i=0;i<s.innerZippedPockets;i++)
   components.push({id:'inner_zip_pocket_'+(i+1),role:'zip_pocket',behavior:'flexible',moving:false,requires:['pockets']});
 for(let i=0;i<s.outerPockets;i++)
   components.push({id:'outer_pocket_'+(i+1),role:'outer_pocket',behavior:kind,moving:false,requires:['front']});
 for(let i=0;i<s.strapCount;i++)
   components.push({id:'strap_'+(i+1),role:'strap',behavior:'flexible',moving:true,
     joint:'strap_anchor',degreesOfFreedom:['swing'],requires:['strap']});
 for(let i=0;i<s.handlesCount;i++)
   components.push({id:'handle_'+(i+1),role:'handle',behavior:'semi-rigid',moving:true,
     joint:'handle_anchor',degreesOfFreedom:['swing'],requires:['strap']});
 if(s.closure!=='open')components.push({id:'closure',role:s.closure,
   behavior:'rigid',moving:true,joint:BAG_CLOSURES[s.closure].mechanism,
   degreesOfFreedom:[BAG_CLOSURES[s.closure].mechanism==='hinge'?'rotation':'translation'],
   requires:['closure','open']});
 if(s.logoPlacement!=='none')components.push({id:'brand_mark',role:'logo',behavior:'surface-attached',
   moving:false,requires:['logo']});
 return components;
}
export function evaluateBagCapture(specInput={},images=[]){
 const spec=createBagSpec(specInput);
 const required=requiredBagViews(spec);
 const records=Array.isArray(images)?images:[];
 const present=new Set(records.filter(v=>Object.hasOwn(VIEW_LABELS,v.view)).map(v=>v.view));
 const missing=required.filter(v=>!present.has(v));
 const geometryViews=['front','back','left','right','bottom','top','inside'];
 const accuracyLimitations=[];
 if(missing.some(x=>geometryViews.includes(x)))
   accuracyLimitations.push('أجزاء هندسية غير مرئية، لا يمكن اعتماد أبعادها أو شكلها تلقائيًا');
 if(!present.has('open'))accuracyLimitations.push('لا يوجد مرجع يوضح حركة الفتح والقفل');
 if(missing.includes('pockets'))accuracyLimitations.push('الجيوب أو تقسيم الداخل غير موثق بالصور');
 if(missing.includes('logo'))accuracyLimitations.push('صورة الشعار غير موجودة أو غير محددة');
 const completeness=Math.round(100*(required.length-missing.length)/required.length);
 return {viewsRequired:required,viewsMissing:missing,completeness,
  photosReceived:records.length,geometryVerified:false,logoVerified:false,
  compartmentsVerified:false,mechanicsVerified:false,realSizeGuaranteed:false,
  automatedReconstructionConnected:false,previewReady:missing.length===0,
  accuracyLimitations,unobservedParts:describeBagComponents(spec).filter(
    p=>p.requires?.some(k=>!present.has(k))).map(p=>p.id)};
}
export function makeBagDraft(specInput={},images=[]){
 const spec=createBagSpec(specInput),report=evaluateBagCapture(spec,images);
 return {schemaVersion:1,kind:'rawnak-modular-bag',units:'cm',spec,
  parts:describeBagComponents(spec),capture:report,
  images:(Array.isArray(images)?images:[]).map(p=>({
    name:String(p.name||'').slice(0,140),view:p.view||'unknown',
    width:Number(p.width)||0,height:Number(p.height)||0,bytes:Number(p.bytes)||0
  })),
  output:{generatedGeometry:'parametric-preview-only',photoTo3DFaithful:false,
    articulatedParts:true,physicalSimulation:false,insideMode:'schematic',
    brandImageEmbedded:false,commerciallyApproved:false,retailARReady:false},
  provenance:{merchantMeasurementsProvided:true,photoClaimsUnverified:true,
    inferenceMayBeWrong:true}
 };
}
