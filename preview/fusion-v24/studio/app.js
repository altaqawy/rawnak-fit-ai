import {
  CATEGORIES, classifyProduct, dominantProductColor, planProduct, createRecord, normalizeCategory
} from './engine.js';
import { getCaptureProfile, captureProgress } from './capture-profiles.js';
import { getDemoProduct } from '../demo/catalog.js';

const BUILD = '0.5.1';
const $ = id => document.getElementById(id);
const state = {
  files: [], queue: [], classificationSource: 'unresolved', classification: null,
  viewer: null, viewerLoading: null, model: null, imageRequest: 0, analysisRequest: 0,
  lastBuildKey: null, demo: false, confirmedParts: {}, partsRenderedCategory: null
};
const info = (message, kind = 'info') => {
  const el = $('analysis-status');
  el.textContent = message;
  el.style.color = kind === 'error' ? '#f1a89e' : kind === 'success' ? '#c8ef9d' : '#d3dcc0';
};
function options() {
  const sel = $('category');
  for (const [key, item] of Object.entries(CATEGORIES)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = item.label + ' — ' + item.engine;
    sel.appendChild(opt);
  }
  sel.value = 'unknown';
}
function updateSizeInfo() {
  const item = CATEGORIES[normalizeCategory($('category').value)];
  $('size-label').textContent = item.field + ' · قياس حقيقي';
  $('size-unit').textContent = item.unit;
  $('measurement').placeholder = item.defaultSize ? 'مثال ' + item.defaultSize : 'ادخل القياس';
}
function setCategory(category, method = 'manual', classification = null) {
  $('category').value = normalizeCategory(category);
  state.classificationSource = method;
  state.classification = classification;
  $('measurement').value = '';
  state.partsRenderedCategory = null;
  updateSizeInfo();
  resetPreview();
  updatePlan();
}
function getPlan() {
  return planProduct({
    category: $('category').value,
    measurement: $('measurement').value,
    photos: state.files.length,
    categorySource: state.classificationSource
  });
}
function resetPreview() {
  state.lastBuildKey = null;
  state.demo = false;
  $('preview-placeholder').classList.remove('hidden');
  $('download-glb').disabled = true;
  state.viewer?.clear?.();
}
function updatePlan() {
  const cat = CATEGORIES[normalizeCategory($('category').value)];
  const plan = getPlan();
  $('engine-icon').textContent = cat.icon;
  $('engine-name').textContent = cat.label + ' · ' + cat.engine;
  $('engine-description').textContent = cat.editable
    ? 'قالب 3D هندسي قابل لتعديل الحجم واللون، وليس إعادة بناء دقيقة من الصور'
    : 'المحرك الخاص بهذه الفئة لم يُربط بعد بميزة توليد هندسة ثلاثية الأبعاد';
  $('engine-type').textContent = cat.engine;
  $('engine-status').textContent = plan.canBuild ? 'جاهز لمعاينة قالب تقريبي' : 'يحتاج تجهيز / مراجعة';
  $('routing-source').textContent = {
    vision: 'AI ON DEVICE', filename: 'TEXT HINT', manual: 'MANUAL',
    conflict: 'CONFIRM CATEGORY', unresolved: 'NOT CLASSIFIED'
  }[state.classificationSource] || 'REVIEW';
  const list = $('requirements');
  list.textContent = '';
  for (const description of plan.requirements) {
    const li = document.createElement('li'); li.textContent = description; list.append(li);
  }
  if (!plan.requirements.length) {
    const li = document.createElement('li');
    li.textContent = 'القالب جاهز كعرض توضيحي؛ راجع شكل المنتج الحقيقي قبل النشر.';
    list.append(li);
  }
  $('build-model').disabled = !plan.canBuild;
  $('queue-product').disabled = !state.files.length || $('category').value === 'unknown' ||
    !$('product-name').value.trim() || !$('sku').value.trim() ||
    !(Number($('measurement').value) > 0);
  $('export-json').disabled = $('queue-product').disabled;
  $('items-count').textContent = state.queue.length + ' منتجات';
  $('export-queue').disabled = !state.queue.length;
  updateCaptureRequirements();
  renderMaterialPartsIfNeeded();
  const signature = ['category','measurement','product-color'].map(k => $(k).value).join('|');
  if (!state.demo && state.lastBuildKey !== signature) $('download-glb').disabled = true;
}
function confirmedPartList() {
  const category = $('category').value;
  const profile = getCaptureProfile(category);
  if (!profile) return [];
  return profile.parts.map((part, index) => {
    const key = String($('sku').value || 'unassigned').trim() + ':' + category + ':' + index;
    const saved = state.confirmedParts[key];
    return {
      id: 'part-' + index,
      label: part.name,
      type: saved?.motion || part.motion,
      confirmed: Boolean(saved?.confirmed),
      source: saved?.confirmed ? 'merchant-confirmed' : 'category-template-suggestion',
      hint: part.hint || ''
    };
  });
}
function updateCaptureRequirements() {
  const category = $('category').value;
  const profile = getCaptureProfile(category);
  const hint = $('capture-photo-status');
  const description = $('capture-photo-details');
  const link = $('capture-photo-guide');
  if (!profile) {
    hint.textContent = 'حدد فئة المنتج لمعرفة عدد وزوايا التصوير المطلوبة';
    description.textContent = state.files.length + ' صورة تم إضافتها — التصوير يختلف حسب الفئة';
    link.href = './capture.html';
    return;
  }
  const count = state.files.length;
  const progress = captureProgress(category, count);
  hint.textContent = count + ' / ' + profile.verifiedMin +
    ' صورة للحد المقترح لمراجعة 360° · ' + progress.label;
  description.textContent = 'تجربة أولية من ' + profile.previewMin + ' صور · الأفضل ' +
    profile.verifiedTarget + ' صورة مع القياسات وفحص جودة الصور';
  link.href = './capture.html?category=' + encodeURIComponent(category);
}
function renderMaterialPartsIfNeeded() {
  const category = $('category').value;
  if (state.partsRenderedCategory === category) return;
  state.partsRenderedCategory = category;
  const container = $('material-parts');
  container.textContent = '';
  const parts = confirmedPartList();
  if (!parts.length) {
    const msg = document.createElement('p');
    msg.className = 'note'; msg.textContent = 'اختار فئة المنتج لإظهار قائمة الأجزاء المقترحة.';
    container.append(msg); return;
  }
  for (const [index, part] of parts.entries()) {
    const row = document.createElement('div');row.className = 'material-part';
    const title = document.createElement('span');title.textContent = part.label;
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'طبيعة حركة ' + part.label);
    for (const [value, label] of [
      ['rigid', 'صلب'],['deformable', 'مرن'],['cloth','قماش متحرك'],
      ['hinged','مفصلة'],['linked','سلسلة / حلقات']
    ]) {
      const option = document.createElement('option');
      option.value = value;option.textContent = label;select.append(option);
    }
    select.value = part.type;
    const approval = document.createElement('label');approval.className = 'part-confirm';
    const checkbox = document.createElement('input');checkbox.type = 'checkbox';checkbox.checked = part.confirmed;
    approval.append(checkbox,document.createTextNode('راجعت الخامة'));
    function savePart() {
      state.confirmedParts[String($('sku').value || 'unassigned').trim() + ':' + category + ':' + index] = { motion: select.value, confirmed: checkbox.checked };
    }
    select.addEventListener('change',()=>{checkbox.checked = false;savePart();});
    checkbox.addEventListener('change',savePart);
    row.append(title,select,approval);container.append(row);
  }
}
function imageObject(file) {
  // Retain File handles and object URLs. Decode only the first/current analysis
  // image instead of keeping 48 full-resolution decoded images in memory.
  return Promise.resolve({ file, url: URL.createObjectURL(file), img: null });
}
async function ensureDecoded(photo) {
  if (photo.img) return photo.img;
  const image = new Image();
  image.decoding = 'async';
  image.src = photo.url;
  await image.decode();
  photo.img = image;
  return image;
}
function renderImages() {
  const strip = $('photo-strip');
  strip.textContent = '';
  for (const photo of state.files) {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    const img = document.createElement('img');
    img.src = photo.url; img.alt = photo.file.name; img.loading = 'lazy';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '×'; remove.title = 'حذف الصورة';
    remove.addEventListener('click', () => {
      const index = state.files.indexOf(photo);
      if (index < 0) return;
      state.files.splice(index, 1);
      state.confirmedParts = {};
      state.partsRenderedCategory = null;
      URL.revokeObjectURL(photo.url);
      state.analysisRequest++;
      renderImages();
      resetPreview();
      updatePlan();
      info('تم حذف صورة. التحليل القديم لم يعد معتمدًا.');
    });
    thumb.append(img, remove);
    strip.append(thumb);
  }
}
function autoFill(name) {
  if (!$('product-name').value.trim()) {
    const cleaned = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    $('product-name').value = cleaned.slice(0, 100);
  }
  if (!$('sku').value.trim()) {
    $('sku').value = 'RW-' + String(Date.now()).slice(-7);
  }
}
function extractColor(img) {
  const canvas = document.createElement('canvas');
  canvas.width = 120; canvas.height = 120;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  context.drawImage(img, 0, 0, 120, 120);
  const color = dominantProductColor(context.getImageData(0, 0, 120, 120).data, 120, 120);
  $('product-color').value = color;
  $('color-code').textContent = color;
}
async function handleFiles(incoming) {
  const available = Math.max(0, 48 - state.files.length);
  const raw = [...incoming].filter(f => /^image\/(png|jpeg|webp)$/.test(f.type));
  const valid = raw.filter(f => f.size <= 10 * 1024 * 1024).slice(0, available);
  if (!valid.length) { info('اختار PNG أو JPG أو WEBP، بحد أقصى 48 صورة و10MB للصورة. اعمل رفع على دفعات.', 'error'); return; }
  const added = await Promise.allSettled(valid.map(imageObject));
  const success = added.filter(x => x.status === 'fulfilled').map(x => x.value);
  state.files.push(...success);
  state.confirmedParts = {};
  state.partsRenderedCategory = null;
  renderImages();
  if (success.length === 0) { info('لم نتمكن من قراءة الصور، جرّب صورًا أخرى.', 'error'); return; }
  try {
    await ensureDecoded(state.files[0]);
    extractColor(state.files[0].img);
  } catch {
    info('أول صورة غير قابلة للتحليل؛ جرّب صورة مختلفة أو استخدم التصنيف اليدوي.', 'error');
  }
  autoFill(success[0].file.name);
  const fallback = classifyProduct($('product-name').value + ' ' + success[0].file.name);
  if (state.classificationSource !== 'manual' && fallback.category !== 'unknown') {
    setCategory(fallback.category, fallback.method, fallback);
  } else {
    resetPreview(); updatePlan();
  }
  info(success.length + ' صورة تمت إضافتها. جاري محاولة التصنيف AI تلقائيًا على الجهاز.');
  void analyze();
  if (added.some(x => x.status === 'rejected')) info('بعض الصور لم يمكن قراءتها. الصور المقبولة ما زالت متاحة.', 'error');
}
let mobilenetPromise = null;
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('تعذر تحميل مكتبة التصنيف من CDN'));
    document.head.append(script);
  });
}
async function mobilenetModel() {
  if (!mobilenetPromise) {
    mobilenetPromise = (async () => {
      if (!window.tf) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      if (!window.mobilenet) await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
      if (!window.mobilenet?.load) throw new Error('MobileNet library unavailable');
      // MobileNetV2 0.5 is lower cost than full size; still only ImageNet labels.
      return window.mobilenet.load({ version: 2, alpha: .50 });
    })().catch(error => { mobilenetPromise = null; throw error; });
  }
  return mobilenetPromise;
}
async function analyze() {
  if (!state.files.length) { info('ارفع صورة المنتج الأول.', 'error'); return; }
  const request = ++state.analysisRequest;
  const selectedPhoto = state.files[0];
  const label = $('product-name').value + ' ' + selectedPhoto.file.name;
  $('analyze').disabled = true;
  info('جاري تحميل نموذج MobileNet على جهازك لأول مرة. ده ممكن ياخد وقت حسب الشبكة...');
  try {
    const image = await ensureDecoded(selectedPhoto);
    if (request !== state.analysisRequest) return;
    const model = await mobilenetModel();
    if (request !== state.analysisRequest) return;
    info('جاري تصنيف الصورة محليًا...');
    const predictions = await model.classify(image, 5);
    if (request !== state.analysisRequest) return;
    const result = classifyProduct(label, predictions);
    if (state.classificationSource !== 'manual') {
      setCategory(result.category, result.method, result);
    } else {
      updatePlan();
    }
    if (result.category === 'unknown') {
      info('الذكاء الاصطناعي لم يتعرف على فئة موثوقة. اختار النوع يدويًا.', 'error');
    } else if (result.requiresReview) {
      info('الاقتراح: ' + CATEGORIES[result.category].label +
        '. التصنيف يحتاج تأكيدك' + (result.modelLabel ? ' · MobileNet: ' + result.modelLabel : '') + '.');
    } else {
      info('اكتمل التحليل: ' + CATEGORIES[result.category].label +
        ' · MobileNet: ' + result.modelLabel + '. راجع الفئة قبل البناء.', 'success');
    }
  } catch (error) {
    if (request === state.analysisRequest) info(
      'تعذر التحليل AI: ' + (error.message || error) + '. ما زال التصنيف اليدوي متاحًا.', 'error');
  } finally {
    $('analyze').disabled = false;
  }
}
function currentSignature() {
  return ['category','measurement','product-color'].map(k => $(k).value).join('|');
}
async function ensureViewer() {
  if (state.viewer) return state.viewer;
  if (!state.viewerLoading) {
    state.viewerLoading = import('./viewer.js').then(mod => {
      state.viewer = new mod.ParametricViewer($('viewer'));
      return state.viewer;
    }).catch(error => { state.viewerLoading = null; throw error; });
  }
  return state.viewerLoading;
}
async function showTemplate(category, size, color, demo = false) {
  const button = $('build-model');
  button.disabled = true;
  try {
    const viewer = await ensureViewer();
    viewer.setProduct(category, size, color);
    state.demo = demo;
    state.lastBuildKey = demo ? null : currentSignature();
    $('preview-placeholder').classList.add('hidden');
    $('download-glb').disabled = false;
    info(demo
      ? 'ده قالب توضيحي عام، مش إعادة بناء من صور منتج.'
      : 'تم إنشاء قالب هندسي 3D. راجع تفاصيل المنتج الحقيقية قبل أي اعتماد.', 'success');
  } catch (error) {
    info('محرك 3D غير متاح: ' + (error.message || error) + '. صورك وبياناتك محفوظة مؤقتًا في الصفحة.', 'error');
  } finally {
    updatePlan();
    if (state.demo || state.lastBuildKey === currentSignature()) $('download-glb').disabled = false;
  }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.append(anchor);
  anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
function collect() {
  const category = $('category').value;
  const base = createRecord({
    name: $('product-name').value, sku: $('sku').value,
    category, measurement: $('measurement').value,
    photos: state.files.length, categorySource: state.classificationSource,
    color: $('product-color').value
  });
  const photoStatus = captureProgress(category, state.files.length);
  const parts = confirmedPartList();
  // Never mark the SKU as verified just because an image-count threshold is met.
  return {
    ...base,
    photoRequirements: {
      provided: state.files.length,
      previewMinimum: photoStatus.previewMinimum,
      reviewMinimum: photoStatus.verifiedMinimum,
      target: photoStatus.verifiedTarget,
      level: photoStatus.level,
      photoQualityReviewed: false
    },
    materialParts: parts,
    merchantApproved: false,
    publishStatus: 'needs-merchant-qa'
  };
}
function renderQueue() {
  const node = $('queue'); node.textContent = '';
  if (!state.queue.length) {
    const p = document.createElement('p'); p.className = 'empty-queue';
    p.textContent = 'مافيش منتجات متضافة لسه'; node.append(p);
  } else {
    for (const record of state.queue) {
      const row = document.createElement('div'); row.className = 'queue-card';
      const item = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = record.productName;
      const code = document.createElement('small'); code.textContent = record.sku + ' · ' + record.engine;
      item.append(title, code);
      const badge = document.createElement('span'); badge.className = 'queue-status';
      badge.textContent = record.status === 'preview-ready' ? 'قالب تقريبي' : 'يحتاج تجهيز';
      row.append(item, badge);
      node.append(row);
    }
  }
  updatePlan();
}
function exportJSON(data, filename) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), filename);
}
function wireUI() {
  options(); updateSizeInfo(); updatePlan(); renderQueue();
  const input = $('file-input'), zone = $('dropzone');
  zone.addEventListener('click', e => { if (e.target !== input) input.click(); });
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', async e => { await handleFiles(e.target.files); input.value = ''; });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', async e => {
    e.preventDefault(); zone.classList.remove('dragging');
    await handleFiles(e.dataTransfer?.files || []);
  });
  $('category').addEventListener('change', () => setCategory($('category').value, 'manual'));
  for (const id of ['measurement', 'product-color', 'sku', 'product-name']) {
    $(id).addEventListener('input', () => {
      if (id === 'product-color') $('color-code').textContent = $('product-color').value;
      if (id === 'sku') state.partsRenderedCategory = null;
      if (id === 'measurement' || id === 'product-color') resetPreview();
      updatePlan();
    });
  }
  $('open-library').addEventListener('click',()=>{
    const category=$('category').value;
    const mapped=category==='tee'?'tshirt':category;
    const target=new URL('./library.html',location.href);
    if(['tshirt','watch','bag'].includes(mapped))target.searchParams.set('category',mapped);
    if($('product-name').value.trim())target.searchParams.set('name',$('product-name').value.trim().slice(0,100));
    if($('sku').value.trim())target.searchParams.set('sku',$('sku').value.trim().slice(0,64));
    // Current selected File objects never leave this page or enter a URL.
    location.assign(target.href);
  });
  $('analyze').addEventListener('click', analyze);
  $('build-model').addEventListener('click', async () => {
    if (!getPlan().canBuild) return;
    await showTemplate($('category').value, Number($('measurement').value), $('product-color').value);
  });
  document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', async () => {
    const category = button.dataset.demo;
    await showTemplate(category, CATEGORIES[category].defaultSize, $('product-color').value, true);
  }));
  $('download-glb').addEventListener('click', async () => {
    if (!state.viewer?.group) return;
    try {
      info('جاري تصدير GLB...');
      const blob = await state.viewer.exportGLB();
      downloadBlob(blob, (state.demo ? 'rawnak-demo-' : ($('sku').value || 'rawnak-asset-')) + '.glb');
      info('تم تصدير مجسم تقريبي. لازال يحتاج مراجعة هندسية ومطابقة صور المنتج.', 'success');
    } catch(error) { info('فشل تصدير GLB: ' + (error.message || error), 'error'); }
  });
  $('export-json').addEventListener('click', () => {
    try { const rec = collect(); exportJSON(rec, rec.sku + '.json'); }
    catch(error) { info(error.message, 'error'); }
  });
  $('queue-product').addEventListener('click', () => {
    try {
      const record = collect();
      const index = state.queue.findIndex(item => item.sku === record.sku);
      if (index >= 0) state.queue[index] = record; else state.queue.push(record);
      renderQueue();
      info('اتضاف المنتج للقائمة المحلية، من غير رفع بيانات إلى خادم.', 'success');
    } catch(error) { info(error.message, 'error'); }
  });
  $('export-queue').addEventListener('click', () => exportJSON({
    schemaVersion: 1, appVersion: BUILD, records: state.queue, note: 'No image bytes or real GLB objects included'
  }, 'rawnak-autofit-catalog.json'));
  window.addEventListener('pagehide', () => {
    state.viewer?.dispose?.();
    for (const photo of state.files) URL.revokeObjectURL(photo.url);
  });
}

async function openDemoFixture() {
  const params = new URLSearchParams(window.location.search);
  const product = getDemoProduct(params.get('fixture'));
  if (!product) return;
  const banner = document.getElementById('fixture-message');
  if (banner) {
    banner.hidden = false;
    banner.textContent = 'DATASET DEMO · ' + product.name +
      ' — صورتان AI تجريبيتان، وليستا قياسات أو نموذج 3D معتمد.';
  }
  info('جاري جلب صور المنتج التجريبي من GitHub...');
  try {
    const files = await Promise.all(product.photos.map(async (photo, idx) => {
      const url = new URL('../demo/' + photo.src.replace(/^\.\//,''), window.location.href);
      const result = await fetch(url, { cache: 'no-cache' });
      if (!result.ok) throw new Error('تعذر جلب الصورة ' + (idx + 1) + ' · HTTP ' + result.status);
      const blob = await result.blob();
      if (!blob.type.startsWith('image/')) throw new Error('ملف الصورة غير صالح');
      return new File([blob], product.category + '-' + photo.angle + '.webp', { type: 'image/webp' });
    }));
    $('product-name').value = product.name;
    $('sku').value = product.sku;
    await handleFiles(files);
    setCategory(product.category,'manual');
    $('product-color').value=product.color;
    $('color-code').textContent=product.color;
    updatePlan();
    info('تم استيراد '+files.length+' صورة من GitHub. راجع اللون والخامة والقياسات الحقيقية قبل عمل 3D.', 'success');
  } catch (error) {
    info('تعذر استيراد عينة المنتج: ' + (error.message || error), 'error');
  }
}
wireUI();
void openDemoFixture();
