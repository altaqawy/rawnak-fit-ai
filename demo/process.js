import { DEMO_PRODUCTS, getDemoProduct } from './catalog.js';
import { getCaptureProfile } from '../studio/capture-profiles.js';
import { classifyProduct, dominantProductColor } from '../studio/engine.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let product = null;
let requestId = 0;
let modelPromise = null;
const initial = getDemoProduct(params.get('sku')) ? params.get('sku') : 'WATCH-DEMO-01';
const categories = { watch:'ساعة',tshirt:'تيشيرت',glasses:'نظارة',bag:'شنطة' };
const previewCategory = {tshirt:'tshirt',watch:'watch',glasses:'glasses',bag:'bag'};

function setStatus(id, text, type='off') {
  const element = $(id);
  element.textContent = text;
  element.className = 'status ' + type;
}
function message(text,error=false) {
  $('analysis-message').textContent = text;
  $('analysis-message').style.color = error?'#ffbdb2':'#d5e8c2';
}
function photo(src, label) {
  const wrap=document.createElement('div');wrap.className='photo';
  const img=new Image();img.src=src;img.alt=product.name+' — '+label;img.loading='lazy';
  const badge=document.createElement('label');badge.textContent=label;
  wrap.append(img,badge);
  return wrap;
}
function render() {
  requestId++;
  product=getDemoProduct($('product-select').value);
  if(!product)return;
  const profile=getCaptureProfile(product.category);
  $('product-title').textContent=product.name;
  $('photo-grid').replaceChildren(...product.photos.map(p=>photo(p.src,p.view)));
  $('photos-count').textContent=product.photos.length;
  $('minimum-count').textContent=profile?.previewMin || '—';
  $('coverage-count').textContent=profile
    ? Math.round(product.photos.length/profile.verifiedMin*100)+'%*' : '—';
  $('result-category').textContent=categories[product.category] || product.category;
  $('result-engine').textContent=product.engine;
  $('result-tryon').textContent='مجسم هندسي 3D لايف (تقريبي) · صورة 2D اختيارية';
  $('cutout-image').src=product.cutoutSrc||'';
  setStatus('status-tryon','3D DEMO MESH','done');
  $('result-color').textContent='اضغط تحليل';
  $('result-ai').textContent='لم يتم تشغيله';
  const parts=$('parts');parts.replaceChildren();
  for(const p of product.materialParts) {
    const tag=document.createElement('span');tag.className='part';
    tag.textContent=p.name+' · '+p.motion;tag.title=p.material;
    parts.append(tag);
  }
  $('quality-warning').textContent=
    'مراجعة الجودة: '+product.photoQA+'. مجسم 3D الهندسي موجود للعرض والدوران، لكنه ليس إعادة بناء دقيقة من الصور. قصاصة 2D القديمة مازالت متاحة للمقارنة. لازم GLB موثوق وأبعاد المورد قبل اعتماد تجربة المنتج الحقيقي.';
  $('studio-link').href='../studio/?fixture='+encodeURIComponent(product.sku);
  $('capture-link').href='../studio/capture.html?category='+encodeURIComponent(product.category);
  $('inspect-3d-link').href='../diagnostics/3d-preview.html?product='+
    encodeURIComponent(product.category==='tshirt'?'tee':product.category);
  const slot=$('tryon-slot');slot.replaceChildren();
  const widget=document.createElement('rawnak-fit');
  for(const [key,value] of Object.entries({
    'store-id':'demo-merchant',
    'product-id':product.sku,
    'variant-id':product.variant,
    'category':previewCategory[product.category],
    'product-name':product.name,
    'button-text':'جرّب مجسم 3D بالكاميرا'
  })) widget.setAttribute(key,value);
  slot.append(widget);
  setStatus('status-photos','جارٍ التحقق','off');
  setStatus('status-analysis','لم يبدأ','off');
  setStatus('status-parts','قالب فئة','done');
  message('دي صور AI تجريبية. اضغط تحليل علشان نشغّل استخراج اللون وMobileNet محليًا.');
  // This verifies that the actual files are reachable; it does not claim view-quality validation.
  const currently=requestId;
  Promise.all(product.photos.map(p=>new Promise((resolve,reject)=>{
    const img=new Image();img.onload=resolve;img.onerror=reject;img.src=p.src;
  }))).then(()=>{
    if(currently===requestId)setStatus('status-photos','تم التحميل','done');
  }).catch(()=>{
    if(currently===requestId){setStatus('status-photos','صورة مفقودة','pending');message('تعذر تحميل صورة من GitHub. تحقق من نشر الأصول على Pages.',true);}
  });
}

async function getModel() {
  if(!modelPromise) modelPromise=(async()=>{
    const load=src=>new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=src;script.async=true;
      script.onload=resolve;script.onerror=()=>reject(new Error('تعذر تحميل المكتبة'));
      document.head.append(script);
    });
    if(!window.tf)await load('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
    if(!window.mobilenet)await load('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
    return window.mobilenet.load({version:2,alpha:.5});
  })().catch(error=>{modelPromise=null;throw error;});
  return modelPromise;
}

async function analyze() {
  if(!product)return;
  const now=++requestId;
  const button=$('analyze-button');button.disabled=true;
  setStatus('status-analysis','جاري التحليل','pending');
  message('جاري قراءة البكسلات وتحليل اللون...');
  try {
    const image=new Image();image.src=product.photos[0].src;
    await image.decode();
    if(now!==requestId)return;
    const c=document.createElement('canvas');c.width=220;c.height=220;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('المتصفح لا يدعم Canvas 2D');
    ctx.drawImage(image,0,0,220,220);
    const data=ctx.getImageData(0,0,220,220);
    const color=dominantProductColor(data.data,220,220);
    $('result-color').textContent=color.toUpperCase();
    $('result-color').style.color=color;
    setStatus('status-analysis','لون ✓ · AI...','pending');
    message('اللون اتسحب من الصورة. جاري تحميل نموذج التصنيف على جهازك...');
    const model=await getModel();
    if(now!==requestId)return;
    const predictions=await model.classify(image,5);
    const prediction=classifyProduct('',predictions);
    if(now!==requestId)return;
    const top=predictions[0];
    $('result-ai').textContent=prediction.category!=='unknown'
      ? (categories[prediction.category]||prediction.category)+' · '+Math.round((prediction.confidence||0)*100)+'%'
      : (top?.className||'غير مؤكد')+' · يحتاج مراجعة';
    setStatus('status-analysis','تم التحليل','done');
    message('اكتمل تحليل اللون وMobileNet على الجهاز. الفئة المعتمدة في التجربة مأخوذة من كتالوج المنتج وليست نتيجة تلقائية ملزمة.');
  } catch(error) {
    if(now!==requestId)return;
    setStatus('status-analysis','فشل AI','pending');
    $('result-ai').textContent='غير متاح · يمكن تحديد الفئة من كتالوج المتجر';
    message('تحليل AI لم يكتمل: '+String(error.message||error)+'. اللون ربما اتستخرج بالفعل، وبيانات الفئة تظل من كتالوج التجربة.',true);
  } finally {
    if(now===requestId)button.disabled=false;
  }
}

for(const p of Object.values(DEMO_PRODUCTS)) {
  const opt=document.createElement('option');opt.value=p.sku;opt.textContent=p.name;
  $('product-select').append(opt);
}
$('product-select').value=initial;
$('product-select').addEventListener('change',()=>{
  const url=new URL(location.href);url.searchParams.set('sku',$('product-select').value);
  history.replaceState({},'',url);
  render();
});
$('analyze-button').addEventListener('click',analyze);
$('reset-button').addEventListener('click',render);
render();
