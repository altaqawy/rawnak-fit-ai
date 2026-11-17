import { CATEGORIES } from './engine.js';
import { COMMON_RULES, PROFILES, getCaptureProfile, captureProgress } from './capture-profiles.js';
const $=id=>document.getElementById(id);
const categories = Object.keys(PROFILES);
for(const id of categories) {
  const option=document.createElement('option');option.value=id;option.textContent=CATEGORIES[id]?.label || PROFILES[id].title;
  $('capture-category').append(option);
}
for(const text of COMMON_RULES) {
  const li=document.createElement('li');li.textContent=text;$('rules').append(li);
}
function setText(id,value){$(id).textContent=value;}
function show() {
  const cat=$('capture-category').value;
  const p=getCaptureProfile(cat);
  if(!p)return;
  const stats=captureProgress(cat,$('capture-count').value);
  setText('preview-number',p.previewMin);
  setText('verified-number',p.verifiedMin);
  setText('recommended-number',p.verifiedTarget);
  $('capture-progress').style.width=Math.min(100,Math.round(100*stats.count/p.verifiedTarget))+'%';
  setText('capture-status',stats.count+' صورة · '+stats.label);
  const steps=$('shots');steps.textContent='';
  for(const [name,count] of p.shots) {
    const row=document.createElement('div');row.className='shot-step';
    const b=document.createElement('strong');b.textContent=name;
    const n=document.createElement('span');n.textContent=count+' صور';
    row.append(b,n);steps.append(row);
  }
  setText('photo-extra',p.extra + (p.needsMotion ? ' · يفضّل فيديو حركة منفصل لاختبار المفاصل/الانسيابية، بدون تغيير شكل المنتج في مجموعة الصور الأساسية.' : ''));
  setText('required-size',p.sizing);
  const parts=$('parts');parts.textContent='';
  for(const item of p.parts) {
    const tag=document.createElement('span');tag.className='part-label';
    const title=document.createTextNode(item.name+' ');
    const detail=document.createElement('small');detail.textContent=item.motion;
    tag.append(title,detail);tag.title=item.hint || 'يُراجع التاجر خامة القطعة';parts.append(tag);
  }
  const list=$('materials');list.textContent='';
  for(const material of p.materials) {
    const li=document.createElement('li');li.textContent=material;list.append(li);
  }
}
function plainGuide() {
 const p=getCaptureProfile($('capture-category').value);
 return [
  'RAWNAK FIT AI · دليل تصوير منتج '+p.title,
  'الحد المبدئي: '+p.previewMin+' صور',
  'الحد الأدنى للمراجعة 360°: '+p.verifiedMin+' صور',
  'الحزمة المقترحة: '+p.verifiedTarget+' صورة',
  'اللقطات:',...p.shots.map(([n,c])=>'• '+n+' — '+c+' صور'),
  'القياسات: '+p.sizing,'تعليمات إضافية: '+p.extra,
  'الخامات/الأجزاء:',...p.parts.map(x=>'• '+x.name+' ('+x.motion+')'),
  'معلومات الخامة:',...p.materials.map(x=>'• '+x),
  'الشروط العامة:',...COMMON_RULES.map((s,i)=>(i+1)+'. '+s),
  'العدد المقترح لا يضمن جودة المجسم أو دقة المقاسات. مطلوب مراجعة التاجر.'
 ].join('\n');
}
$('capture-category').value='watch';
const requested = new URLSearchParams(location.search).get('category');
if (requested && categories.includes(requested)) $('capture-category').value=requested;
$('capture-category').addEventListener('change',show);
$('capture-count').addEventListener('input',show);
$('copy-guide').addEventListener('click',async()=>{
 try {await navigator.clipboard.writeText(plainGuide());setText('copy-result','تم نسخ تعليمات التصوير');}
 catch(error){setText('copy-result','تعذر النسخ، استخدم خيار الطباعة');}
});
$('print-guide').addEventListener('click',()=>window.print());
show();
