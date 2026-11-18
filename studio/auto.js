// RAWNAK FIT photo-only merchant preview. No upload API, no form fields.
import {inferTemplate,createAutoDraft,PHOTO_TEMPLATES} from './auto-template-registry.js';
import {estimateColorFromImageFile} from './photo-style.js';
const $=id=>document.getElementById(id);
const state={photos:[],result:null,color:null,viewer:null,modelRequest:0,analysisRequest:0,angle:0,tilt:0,scale:1,renderRAF:0,modelReady:false,classification:null};
let modelPromise=null,scriptPromise=null,frameObserver=null;
const set=(id,txt)=>{$(id).textContent=txt;};
const sanitize=(name)=>String(name||'').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,48);
const pick=(file)=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size>0&&file.size<=10*1024*1024;
function revokePhotos(){
  for(const item of state.photos)URL.revokeObjectURL(item.url);
  state.photos=[];
}
function reset(){
  state.analysisRequest++;
  state.modelRequest++;
  revokePhotos();
  state.result=null;state.color=null;state.modelReady=false;state.angle=0;
  $('photos').textContent='';$('product-photos').value='';
  $('viewer-empty').hidden=false;
  $('analysis').hidden=true;$('notice').hidden=true;$('reset').hidden=true;$('export').disabled=true;
  set('image-status','اختار الصور علشان يبدأ التحليل تلقائيًا');
  set('result-status','لسه مفيش منتج للتحليل');
  set('step1','لم يبدأ');set('step2','لم يبدأ');set('step3','لم يبدأ');
  if(state.viewer){state.viewer.clear();state.viewer.preview('tee');state.viewer.clear();}
}
function script(url,test){
  if(test())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=url;el.async=true;
    el.onload=()=>test()?resolve():reject(new Error('تعذر تهيئة نموذج التصنيف'));
    el.onerror=()=>reject(new Error('تعذر تنزيل نموذج التصنيف'));
    document.head.append(el);
  });
}
async function mobilenet(){
  if(!modelPromise){
    modelPromise=(async()=>{
      await script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',()=>Boolean(window.tf));
      await script('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',()=>Boolean(window.mobilenet?.load));
      return await window.mobilenet.load({version:2,alpha:.50});
    })().catch(err=>{modelPromise=null;throw err;});
  }
  return modelPromise;
}
function showThumbs(){
  const strip=$('photos');strip.textContent='';
  for(const [i,p] of state.photos.entries()){
    const el=document.createElement('div');el.className='thumb';
    const img=document.createElement('img');img.src=p.url;img.alt=p.file.name;img.loading='lazy';
    const num=document.createElement('span');num.className='index';num.textContent=String(i+1);
    el.append(img,num);strip.append(el);
  }
}
async function loadPhotos(files){
  if(!files?.length)return;
  const current=++state.analysisRequest;
  revokePhotos();
  state.result=null;state.color=null;state.modelReady=false;
  $('viewer-empty').hidden=false;$('analysis').hidden=true;$('notice').hidden=true;
  $('export').disabled=true;
  if(state.viewer)state.viewer.clear();
  const accepted=[...files].filter(pick).slice(0,24);
  const ignored=files.length-accepted.length;
  for(const file of accepted){
    if(current!==state.analysisRequest)return;
    const url=URL.createObjectURL(file);
    state.photos.push({file,url,width:0,height:0});
  }
  $('reset').hidden=!state.photos.length;
  showThumbs();
  if(!state.photos.length){
    set('image-status','مفيش صور مقبولة. الصور لازم تكون JPG / PNG / WEBP وأقل من 10MB للصورة.');
    return;
  }
  set('image-status',state.photos.length+' صورة جاهزة · بدأ التحليل تلقائيًا'+
    (ignored?' · تم تجاهل '+ignored+' ملف':''));
  set('step1','جاري التعرف…');set('step2','في الانتظار');set('step3','في الانتظار');
  for(const p of state.photos){
    await new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>{p.width=image.naturalWidth;p.height=image.naturalHeight;resolve();};
      image.onerror=()=>resolve();
      image.src=p.url;
    });
  }
  void runAnalysis(current);
}
async function classifyImages(request){
  const names=state.photos.map(p=>p.file.name);
  let predictions=[];
  try{
    set('image-status','جاري التعرف على نوع المنتج من الصور محليًا…');
    const model=await mobilenet();
    if(request!==state.analysisRequest)return null;
    const examined=state.photos.slice(0,Math.min(3,state.photos.length));
    const groups=[];
    for(const item of examined){
      if(request!==state.analysisRequest)return null;
      const img=new Image();img.src=item.url;await img.decode();
      groups.push(await model.classify(img,5));
    }
    const merged=new Map();
    for(const group of groups)for(const p of group){
      const label=String(p.className||''),value=Number(p.probability)||0;
      merged.set(label,(merged.get(label)||0)+value/groups.length);
    }
    predictions=[...merged].map(([className,probability])=>({className,probability}))
      .sort((a,b)=>b.probability-a.probability);
  }catch(e){
    // A visible filename-based fallback is better than inventing a confident class.
    set('image-status','نموذج التصنيف غير متاح حاليًا؛ هنحاول استخدام أسماء الصور فقط.');
  }
  if(request!==state.analysisRequest)return null;
  return inferTemplate(names.map(name=>({name})),predictions);
}
function updateResult(result){
  state.result=result;
  $('analysis').hidden=false;
  set('category-label',result.label+(result.uncertain?' · غير مؤكد':''));
  set('template-label',result.templateId||'غير متاح');
  set('color-label',state.color?.color||'غير معروف');
  $('color-swatch').style.background=state.color?.color||'transparent';
  $('notice').hidden=false;
  const pending=!result.previewAvailable;
  set('notice',pending
    ? 'لم يتوفر نموذج 3D مناسب وموثوق لهذه الفئة بعد. الصور معروضة، لكن مش هنستخدم مجسمًا من فئة تانية وندعي إنه منتجك.'
    : 'ده قالب ثلاثي الأبعاد توضيحي وتم تعديل لونه تقريبًا فقط. التفاصيل والخياطة والمقاسات ومشهد الـ360 الحقيقي للمنتج لسه غير مستخرجة من الصور.');
  set('step1',result.category?'تم: '+result.label:'غير محسوم');
  set('step2',result.templateId?'اختير قالب: '+result.templateId:'مفيش قالب مؤكد');
  set('result-status',pending?'الصور جاهزة؛ معاينة 3D لم تتوفر لهذه الفئة':'جاري تجهيز المعاينة من قالب 3D…');
  $('export').disabled=false;
}
async function ensureRenderer(){
  if(state.viewer)return state.viewer;
  if(!scriptPromise){
    scriptPromise=import('../src/fit-3d-renderer.js?v=20261118-alpha110')
      .then(module=>{
        const renderer=new module.Fit3DRenderer($('viewer'));
        state.viewer=renderer;
        frameObserver=new ResizeObserver(()=>scheduleDraw());
        frameObserver.observe($('viewer'));
        return renderer;
      }).catch(err=>{scriptPromise=null;throw err;});
  }
  return scriptPromise;
}
function tintTemplate(category,color){
  if(!state.viewer||!/^#[0-9a-f]{6}$/i.test(color||''))return;
  const group=state.viewer.getActiveModel(category);
  if(!group)return;
  group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.material)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const part=(mesh.name||'').toLowerCase();
    for(const mat of materials){
      if(!mat.color)continue;
      const name=(mat.name||'').toLowerCase();
      const shouldTint=category==='tee'||category==='jacket'
        ? /cotton|jersey|fabric|torso|sleeve|cloth|cotton_sage|reference/i.test(part+' '+name)
        : category==='watch'?/leather|band|strap/i.test(part+' '+name)
        : category==='bag'?/bag|leather|body|flap/i.test(part+' '+name)
        : category==='shoes'?/upper|shoe|fabric/i.test(part+' '+name)
        : category==='bracelet'?/bracelet|band/i.test(part+' '+name)
        : category==='glasses'?/frame/i.test(part+' '+name):false;
      if(shouldTint){mat.color.set(color);mat.needsUpdate=true;}
    }
  });
}
function scheduleDraw(){
  if(state.renderRAF)cancelAnimationFrame(state.renderRAF);
  state.renderRAF=requestAnimationFrame(()=>{
    state.renderRAF=0;
    const cat=state.result?.renderer;
    if(!cat||!state.viewer||!state.modelReady)return;
    const ok=state.viewer.preview(cat,{yaw:state.angle,tilt:state.tilt,scale:state.scale});
    if(!ok)set('result-status','المجسم غير متاح على الجهاز');
  });
}
async function show3D(request){
  const result=state.result;
  if(!result?.previewAvailable||!result.renderer)return;
  try{
    const viewer=await ensureRenderer();
    if(request!==state.analysisRequest)return;
    if(result.renderer==='tee'){
      const model=await viewer.ensureReferenceGarment();
      if(!model)set('notice','ملف التيشيرت المرجعي مش متاح، هيظهر قالب التيشيرت القديم للتجربة فقط.');
    }
    if(request!==state.analysisRequest)return;
    state.modelReady=true;
    tintTemplate(result.renderer,state.color?.color);
    $('viewer-empty').hidden=true;
    scheduleDraw();
    set('step3','قالب 3D جاهز');
    set('result-status','قالب 3D تجريبي · اسحب لتدويره · لون تقريبي من الصورة');
  }catch(error){
    $('viewer-empty').hidden=false;
    set('step3','المعاينة غير متاحة');
    set('result-status','تعذر تشغيل WebGL أو تحميل النموذج: '+(error?.message||error));
  }
}
async function runAnalysis(request){
  const categoryPromise=classifyImages(request);
  let material=null;
  try{material=await estimateColorFromImageFile(state.photos[0].file);}
  catch{material=null;}
  if(request!==state.analysisRequest)return;
  state.color=material;
  const match=await categoryPromise;
  if(!match||request!==state.analysisRequest)return;
  updateResult(match);
  if(!match.category){
    set('step3','الصور متاحة للمراجعة');
    set('image-status','ماقدرتش أحدد الفئة تلقائيًا من الصور بدقة كافية. مش هختار قالبًا عشوائيًا.');
    return;
  }
  set('image-status','تم تحليل '+state.photos.length+' صورة · تصنيف '+
    (match.uncertain?'مبدئي يحتاج تحسين':'مبدئي'));
  await show3D(request);
}
function saveDraft(){
  if(!state.result||!state.photos.length)return;
  const draft=createAutoDraft(state.photos.map(p=>({
    name:p.file.name,width:p.width,height:p.height,bytes:p.file.size
  })),state.result,state.color);
  const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='rawnak-photo-template-'+sanitize(state.result.category||'unknown')+'.json';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$('product-photos').addEventListener('change',async e=>{
  await loadPhotos([...e.target.files]);e.target.value='';
});
$('reset').addEventListener('click',reset);
$('export').addEventListener('click',saveDraft);
const drop=$('dropzone');
for(const eventName of ['dragenter','dragover'])drop.addEventListener(eventName,event=>{
  event.preventDefault();drop.classList.add('dragging');
});
for(const eventName of ['dragleave','drop'])drop.addEventListener(eventName,event=>{
  event.preventDefault();drop.classList.remove('dragging');
});
drop.addEventListener('drop',event=>void loadPhotos([...event.dataTransfer.files]));
let dragging=null;
const view=$('viewer');
view.addEventListener('pointerdown',event=>{
  if(!state.modelReady)return;
  dragging={id:event.pointerId,x:event.clientX,y:event.clientY,a:state.angle,t:state.tilt};
  view.setPointerCapture?.(event.pointerId);
});
view.addEventListener('pointermove',event=>{
  if(!dragging||dragging.id!==event.pointerId)return;
  state.angle=dragging.a+(event.clientX-dragging.x)*.009;
  state.tilt=Math.max(-.5,Math.min(.5,dragging.t+(event.clientY-dragging.y)*.006));
  scheduleDraw();
});
view.addEventListener('pointerup',event=>{if(dragging?.id===event.pointerId)dragging=null;});
view.addEventListener('pointercancel',()=>{dragging=null;});
window.addEventListener('pagehide',()=>{
  state.analysisRequest++;revokePhotos();frameObserver?.disconnect();
  if(state.renderRAF)cancelAnimationFrame(state.renderRAF);
  state.viewer?.dispose?.();
});
