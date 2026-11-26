import {BAG_STYLES,BAG_MATERIALS,BAG_CLOSURES,VIEW_LABELS,createBagSpec,detectViewFromName} from './bag-spec.js';
import {FAMILY_PRESETS} from './bag-patterns.js';
import {readLocalPhoto,analysePixels,fitFromEvidence,sourceMetadata} from './bag-evidence.js';
import {recommendBag,selectedPatch} from './bag-recommendations.js';
import {newProject} from './bag-editor.js';
import {isolateProduct} from './fusion-mask.mjs';
const $=id=>document.getElementById(id);
const say=(id,text)=>{$(id).textContent=text;};
const keys=['widthCm','heightCm','depthCm','bodyColor','material','closure','strapCount','handlesCount','mainCompartments','innerOpenPockets'];
const numeric=new Set(keys.filter(k=>!['bodyColor','material','closure'].includes(k)));
let photos=[],selected='',report=null,viewer=null,model=null,project=null,buildRevision=0,photoRevision=0,maskBusy=false,uploadBusy=false,exportBusy=false,disposed=false,viewerModule=null;
const options=(node,entries,value)=>{node.replaceChildren(...entries.map(([k,v])=>new Option(v,k)));if(value!=null)node.value=value;};
options($('family'),Object.entries(BAG_STYLES).map(([k,v])=>[k,v.name]),'structured');
options($('material'),Object.entries(BAG_MATERIALS).map(([k,v])=>[k,v.name]),'faux_leather');
options($('closure'),Object.entries(BAG_CLOSURES).map(([k,v])=>[k,v.name]),'flap');
const profile=()=>matchMedia('(max-width:670px)').matches?'mobile':'detail';
function spec(){
 const p={...FAMILY_PRESETS[$('family').value],style:$('family').value};
 for(const k of keys){const input=$(k);if(!input.checkValidity()||input.value===''){input.reportValidity();throw Error('راجع قيمة '+k);}p[k]=numeric.has(k)?Number(input.value):input.value;}
 return createBagSpec(p);
}
function refs(){return photos.map(p=>({...sourceMetadata(p),linked:true}));}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function currentPhoto(){return photos.find(p=>p.id===selected);}
function syncMask(){
 const p=currentPhoto(),cut=p?.cut;
 $('active-photo').disabled=!photos.length;$('mask').disabled=!p||maskBusy;$('use-mask').disabled=!cut||maskBusy||p.usedMask;$('mask-download').disabled=!cut;
 $('cutout').hidden=!cut;$('cutout-placeholder').hidden=Boolean(cut);
 if(cut)$('cutout').src=cut.url;else $('cutout').removeAttribute('src');
}
function stale(){report=null;$('apply-suggestion').disabled=true;say('ranking','اضغط تحليل الصور بعد تأكيد زوايا التصوير.');}
function invalidateModel(){++buildRevision;project=null;$('export').disabled=true;say('model-status','تعديلات غير مطبقة — اضغط تحديث المجسم.');}
function renderPhotos(){
 const list=$('photo-list');list.replaceChildren();
 for(const p of photos){
  const row=document.createElement('div');row.className='photo';
  const img=document.createElement('img');img.src=p.url;img.alt='';
  const info=document.createElement('div'),name=document.createElement('div');name.className='name';name.textContent=p.name;
  const select=document.createElement('select');select.setAttribute('aria-label','زاوية '+p.name);
  options(select,[['unknown','زاوية غير مؤكدة'],...Object.entries(VIEW_LABELS)],p.view);
  select.onchange=()=>{p.view=select.value;p.source='merchant';stale();invalidateModel();renderPhotos();};
  const confirm=document.createElement('button');confirm.type='button';confirm.textContent=p.source==='merchant'?'✓ زاوية مؤكدة':'تأكيد الزاوية';confirm.disabled=p.source==='merchant'||p.view==='unknown';
  confirm.onclick=()=>{p.source='merchant';stale();invalidateModel();renderPhotos();};
  info.append(name,select,confirm);
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','إزالة '+p.name);
  remove.onclick=()=>{photoRevision++;URL.revokeObjectURL(p.url);if(p.cut)URL.revokeObjectURL(p.cut.url);photos=photos.filter(x=>x!==p);if(selected===p.id)selected=photos[0]?.id||'';stale();invalidateModel();renderPhotos();};
  row.append(img,info,remove);list.append(row);
 }
 if(!photos.some(p=>p.id===selected))selected=photos[0]?.id||'';
 options($('active-photo'),photos.map(p=>[p.id,p.name]),selected);syncMask();
}
$('photos').onchange=async()=>{
 if(uploadBusy)return;const files=[...$('photos').files];$('photos').value='';uploadBusy=true;$('photos').disabled=true;
 let added=0,skipped=0;const token=photoRevision;
 try{
 for(const file of files){
  if(photos.length>=8){skipped++;continue;}
  try{const p=await readLocalPhoto(file);if(disposed||token!==photoRevision){URL.revokeObjectURL(p.url);break;}if(photos.some(x=>x.id===p.id)){URL.revokeObjectURL(p.url);skipped++;continue;}photos.push({...p,...detectViewFromName(file.name),file,cut:null});added++;}
  catch(_){skipped++;}
 }
 if(added){stale();invalidateModel();}renderPhotos();say('photo-status','مضافة '+added+' · متجاهلة '+skipped+' · أكّد الزوايا قبل التحليل.');
 }finally{uploadBusy=false;$('photos').disabled=false;}
};
$('active-photo').onchange=()=>{selected=$('active-photo').value;syncMask();};
$('mask').onclick=async()=>{
 const p=currentPhoto();if(!p||maskBusy)return;maskBusy=true;syncMask();say('photo-status','جاري تحميل النموذج عند الحاجة وتحليل الصورة محليًا…');
 try{
  const result=await isolateProduct(p.file,{threshold:Number($('threshold').value)/100});
  if(disposed||!photos.includes(p))return;
  if(p.cut)URL.revokeObjectURL(p.cut.url);
  p.cut={...result,url:URL.createObjectURL(result.blob)};p.usedMask=false;
  say('photo-status','اكتمل العزل · تغطية '+Math.round(result.coverage*100)+'%. راجع المعاينة قبل استخدامها.');
 }catch(e){say('photo-status','تعذر العزل: '+e.message+' — التحليل الهندسي ما زال متاحًا.');}
 finally{maskBusy=false;syncMask();}
};
$('mask-download').onclick=()=>{const cut=currentPhoto()?.cut;if(cut)download(cut.blob,'rawnak-cutout.png');};
$('use-mask').onclick=()=>{
 const p=currentPhoto();if(!p?.cut)return;
 const image=p.cut.canvas,scale=Math.min(1,160/Math.max(image.width,image.height)),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(image.width*scale));c.height=Math.max(1,Math.round(image.height*scale));
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,c.width,c.height);
 const analysis=analysePixels(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height);
 if(analysis.status!=='candidate'){say('photo-status','الحدود بعد العزل غير واضحة: '+analysis.reason+'؛ لم يتم استبدال التحليل السابق.');return;}
 p.analysis={...analysis,method:'u2netp-confirmed-mask'};p.usedMask=true;stale();invalidateModel();syncMask();say('photo-status','تم استخدام العزل بعد مراجعتك. حلل الصور من لوحة المواصفات.');
};
$('suggest').onclick=()=>{
 try{report=recommendBag(spec(),refs());const r=report;
 say('ranking',[r.ranking.map(x=>BAG_STYLES[x.style].name+' · '+x.error.toFixed(3)).join('\n')||'لا توجد صور مؤكدة كافية.',r.conflicts.length?'تعارض: '+r.conflicts.join(', '):'',r.proposals.map(x=>x.key+' → '+x.value).join('\n')].filter(Boolean).join('\n'));
 $('apply-suggestion').disabled=!r.proposals.length;
 }catch(e){say('ranking',e.message);}
};
$('apply-suggestion').onclick=()=>{
 if(!report)return;const {patch}=selectedPatch(report,['style','bodyColor']);
 if(patch.style)$('family').value=patch.style;
 if(patch.bodyColor)$('bodyColor').value=patch.bodyColor;
 stale();void build();
};
function changeFamily(style){
 $('family').value=style;const preset=createBagSpec({...FAMILY_PRESETS[style],style});
 // Measurements and chosen color stay unchanged; the family sets construction defaults.
 for(const k of ['material','closure','strapCount','handlesCount','mainCompartments','innerOpenPockets'])$(k).value=preset[k];
}
$('family').onchange=()=>{changeFamily($('family').value);stale();invalidateModel();};
for(const k of keys)$(k).addEventListener('change',()=>{stale();invalidateModel();});
async function api(){return viewerModule||=await import('./bag-viewer.js');}
async function build(){
 const id=++buildRevision;project=null;$('export').disabled=true;say('model-status','جاري بناء المجسم…');
 try{
  const s=spec(),r=fitFromEvidence(refs()),p=newProject(s,{fit:r.fit||null}),a=await api();
  if(disposed||id!==buildRevision)return;
  if(!viewer)viewer=new a.BagViewer($('stage'),part=>{say('part-status',part||'جزء من المجسم');viewer.highlight(part);viewer.draw();},code=>{say('model-status',code==='restored'?'تم استعادة الرسوميات.':'انقطع اتصال WebGL.');});
  const next=await a.assemble(p,photos.map(p=>({...sourceMetadata(p),url:p.url})),profile());
  if(disposed||id!==buildRevision){next.dispose();return;}
  model=next;viewer.replace(next,true);project=p;
  model.setOpening(Number($('opening').value)/100);model.setSwing(Number($('swing').value)/100);viewer.draw();
  $('stage-message').hidden=true;$('export').disabled=exportBusy;
  say('model-status','تم البناء · '+next.parts.length+' جزء · '+(r.fit?'حدود مستفادة من الصور':'قالب هندسي بالمقاسات المدخلة')+' · غير معتمد تجاريًا');
 }catch(e){if(id!==buildRevision)return;$('stage-message').hidden=false;say('stage-message','تعذر عرض المجسم: '+e.message);say('model-status','راجع WebGL والمقاسات.');}
}
$('build').onclick=()=>void build();
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{if(!viewer||!model)return;const inside=button.dataset.view==='inside';viewer.inspect(inside);if(inside){$('opening').value=100;model.setOpening(1);}viewer.frame(button.dataset.view);viewer.draw();};
$('opening').oninput=()=>{model?.setOpening(Number($('opening').value)/100);viewer?.draw();};
$('swing').oninput=()=>{model?.setSwing(Number($('swing').value)/100);viewer?.draw();};
$('report').onclick=()=>{try{const p=newProject(spec(),{fit:fitFromEvidence(refs()).fit||null});download(new Blob([JSON.stringify({kind:'rawnak-modular-bag',schemaVersion:2,units:'cm',project:p,images:refs().map(({url,...r})=>r),privacy:{imageBytesIncluded:false,trainingConsent:false},output:{photoTo3DFaithful:false,retailARReady:false}},null,2)],{type:'application/json'}),'fusion-bag.json');}catch(e){say('model-status',e.message);}};
$('export').onclick=async()=>{
 if(!project||exportBusy)return;const p=project,id=buildRevision;exportBusy=true;$('export').disabled=true;
 try{const {data}=await (await api()).exportAsset(p,photos.map(p=>({...sourceMetadata(p),url:p.url})),profile());if(id!==buildRevision||disposed)return;download(new Blob([data],{type:'model/gltf-binary'}),'fusion-bag.glb');say('model-status','تم تجهيز GLB محليًا؛ يحتاج مراجعة قبل الاستخدام التجاري.');}
 catch(e){say('model-status','تعذر التصدير: '+e.message);}finally{exportBusy=false;$('export').disabled=!project;}
};
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;buildRevision++;photoRevision++;viewer?.dispose();for(const p of photos){URL.revokeObjectURL(p.url);if(p.cut)URL.revokeObjectURL(p.cut.url);}});
renderPhotos();void build();
