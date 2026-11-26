(function fitApp() {
  'use strict';
  const BUILD_ID = '2026.11.27.SWAP-B7';
  const fitGeometry = window.RawnakFitCalibration;
  const threePose = window.RawnakFit3DPose;
  const SYNC_INTERVAL_MS = 45; // 22 Hz target, actual rate depends on device speed
  const LIVE_INTERVAL_MS = 65; // 15 Hz target, avoids overloading slow phones
  const $ = (selector) => document.querySelector(selector);
  const video = $('#camera-video');
  const canvas = $('#ar-canvas');
  const syncCanvas = $('#sync-canvas');
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { alpha: false });
  const stage = $('#stage');
  const layers = $('#camera-layers');
  const indicator = $('#stream-indicator');
  const trackChip = $('#track-chip');
  const errorBox = $('#camera-error');
  const productsNode = $('#products');
  const cameraToggle = $('#camera-toggle');
  const mainStart = $('#start-main');
  const retryButton = $('#retry-tracking');
  const captureButton = $('#capture');

  const items = [
    { id: 'tee', name: 'تيشيرت كلاسيك', description: 'ملابس · جسم علوي', icon: '👕', engine: 'pose', color: '#c5ed99' },
    { id: 'jacket', name: 'جاكيت', description: 'ملابس · جسم علوي', icon: '🧥', engine: 'pose', color: '#90bfc0' },
    { id: 'watch', name: 'ساعة يد', description: 'إكسسوارات · معصم', icon: '⌚', engine: 'hand', color: '#e7d39d' },
    { id: 'bracelet', name: 'غويشة', description: 'إكسسوارات · معصم', icon: '💍', engine: 'hand', color: '#d9a86f' },
    { id: 'glasses', name: 'نظارة', description: 'إكسسوارات · وجه', icon: '🕶️', engine: 'face', color: '#c7dbea' },
    { id: 'bag', name: 'شنطة كتف', description: 'إكسسوارات · كتف', icon: '👜', engine: 'pose', color: '#cd956f' },
    { id: 'shoes', name: 'أحذية', description: 'ملابس · قدم', icon: '👟', engine: 'pose', color: '#e8e9df' }
  ];

  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get('embed') === '1';
  const requestedItem = params.get('item');
  const initialItem = isEmbedded ? items.find(item => item.id === requestedItem) : null;
  const demoAssetPaths = Object.freeze({
    'WATCH-DEMO-01': { item:'watch', path:'./demo/assets/watch-cutout.webp' },
    'TEE-DEMO-02': { item:'tee', path:'./demo/assets/tshirt-cutout.webp' },
    'GLASSES-DEMO-03': { item:'glasses', path:'./demo/assets/glasses-cutout.webp' },
    'BAG-DEMO-04': { item:'bag', path:'./demo/assets/bag-cutout.webp' }
  });
  const demoSKU = String(params.get('sku') || '');
  const demoAsset = isEmbedded && Object.hasOwn(demoAssetPaths, demoSKU)
    ? demoAssetPaths[demoSKU] : null;
  const state = {
    stream: null, starting: false, epoch: 0, engineRequest: 0,
    selected: initialItem || items[0], engine: 'idle', models: {}, loading: {},
    vision: null, visionLoading: null, raf: 0, landmarks: null,
    fps: 0, frameCount: 0, inferenceFrames: 0, inferenceFPS: 0, lastFps: 0, lastInference: 0, detected: false,
    mirror: true, diagnostic: '', loadingStage: 'idle', lastType: null, lastPoints: null,
    viewMode: 'sync', syncFrameReady: false, processingMs: 0, lastVideoTime: -1,
    demoImage: null, demoImageReady: false, demoCrop: null, worldLandmarks: null,
    fitHint: '', sizeScale: 1, assetMode: '3d', three: null, threeLoading: null, threeError: '',
    garmentMotion: true, armOcclusion: true, occlusionCount: 0, swapStrength: .9, clothMaterial: 'cotton', lightStrength: .45, segmenter: null, segmentLoading: null, segmentStatus: 'idle', segmentHint: '', segmentWorker: null, segmentRequest: 0, segmentBackend: '', segmentPreference: 'cpu', segmentForceMain: false, swapJob: null, swapRevision: 0, swapLastPresented: 0, swapDropped: 0, swapPanels: {}, swapPanelMode: false, swapPanelRequest: 0, swapPanelMessage: '', cutoutEditorAsset: null, cutoutEditorAnchor: '', cutoutEditorFit: null
  };

  if (isEmbedded) {
    document.documentElement.classList.add('fit-embed');
    const info = $('#embed-product');
    if (info) {
      info.classList.remove('hidden');
      const safeName = String(params.get('title') || state.selected.name).slice(0, 130);
      const safeSku = String(params.get('sku') || '').slice(0, 96);
      const safeVariant = String(params.get('variant') || '').slice(0, 96);
      info.textContent = '✳ ' + safeName + (safeSku ? ' · ' + safeSku : '') +
        (safeVariant ? ' · ' + safeVariant : '') +
        ' — مجسم 3D تجريبي غير مطابق بالكامل للمنتج';
    }
  }
  function updatePhotoControl() {
    const root = $('#demo-asset-switch');
    if (!root) return;
    const compatible = demoAsset && state.selected.id === demoAsset.item;
    root.classList.toggle('hidden', !compatible);
    const ready = state.demoImageReady;
    const photoBtn = $('#asset-photo');
    const genericBtn = $('#asset-generic');
    const threeBtn = $('#asset-3d');
    if (threeBtn) {
      threeBtn.classList.toggle('selected', state.assetMode === '3d');
      threeBtn.setAttribute('aria-pressed', String(state.assetMode === '3d'));
    }
    if (photoBtn) {
      photoBtn.disabled = !ready;
      photoBtn.classList.toggle('selected', state.assetMode === 'photo');
      photoBtn.setAttribute('aria-pressed', String(state.assetMode === 'photo'));
    }
    if (genericBtn) {
      genericBtn.classList.toggle('selected', state.assetMode === 'generic');
      genericBtn.setAttribute('aria-pressed', String(state.assetMode === 'generic'));
    }
    const label = $('#asset-status');
    if (label) label.textContent = state.assetMode === '3d'
      ? (state.threeError
          ? 'محرك 3D غير متاح · افتح تفاصيل الخطأ أو اختار الوضع 2D'
          : state.three ? (state.selected.id==='tee'
            ? 'المجسم المرجعي GLB منفصل وبعظام للكتف، وغير مطابق للمنتج أو لمقاسه المعتمد'
            : 'مجسم 3D هندسي تجريبي، مش موديل منتج معتمد') : 'جاري تحميل محرك المجسمات 3D…')
      : ready ? 'الصورة 2D للتجربة القديمة فقط، بدون عمق حقيقي'
      : 'جاري تجهيز صورة المنتج للتجربة';
  }
  function prepareDemoImage() {
    if (!demoAsset || typeof Image === 'undefined') return;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      state.demoImage = image;
      state.demoCrop = fitGeometry?.alphaBounds(image) || {x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
      state.demoImageReady = true;
      updatePhotoControl();
    };
    image.onerror = () => {
      state.demoImageReady = false;
      updatePhotoControl();
      const label = $('#asset-status');
      if (label) label.textContent = 'تعذر تحميل قصاصة المنتج · متاح الرسم التوضيحي';
    };
    image.src = demoAsset.path;
    $('#asset-3d')?.addEventListener('click', () => {
      state.assetMode = '3d';state.fitHint = '';
      void ensureThree();
      updatePhotoControl();updateUI();
    });
    $('#asset-photo')?.addEventListener('click', () => {
      if (!state.demoImageReady) return;
      state.assetMode = 'photo';state.fitHint = '';
      state.three?.clear();
      updatePhotoControl();updateUI();
    });
    $('#asset-generic')?.addEventListener('click', () => {
      state.assetMode = 'generic';state.fitHint = '';
      state.three?.clear();
      updatePhotoControl();updateUI();
    });
    updatePhotoControl();
  }
  prepareDemoImage();
  async function ensureThree() {
    if (state.three || state.threeLoading) return state.threeLoading || state.three;
    state.threeError = '';
    state.threeLoading = (async () => {
      const moduleUrl = new URL('./src/fit-3d-renderer.js?v=20261118-alpha110', document.baseURI).href;
      const mod = await import(moduleUrl);
      const renderer = new mod.Fit3DRenderer(layers);
      state.three = renderer;
      // Load fixed first-party reference only. Never treat user SKU/URL params
      // as permission to fetch an arbitrary GLB or approve commercial geometry.
      if(state.selected.id==='tee')void renderer.ensureReferenceGarment().then(()=>{
        updateUI();
        updatePhotoControl();
      });
      return renderer;
    })().catch(error => {
      state.threeError = error?.message || String(error);
      console.warn('[RAWNAK FIT] 3D renderer unavailable, webcam remains live',error);
      state.fitHint = 'فشل تحميل 3D. تأكد من دعم WebGL ثم اضغط إعادة تجربة 3D.';
      return null;
    }).finally(() => {
      state.threeLoading = null;
      updatePhotoControl();
      updateUI();
    });
    return state.threeLoading;
  }
  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  };
  const clearError = () => {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  };
  const stageLabels = {
    library: 'جاري تحميل مكتبة MediaPipe',
    wasm: 'جاري تهيئة WebAssembly',
    model: 'جاري تحميل نموذج التتبع'
  };
  function recordTrackingError(error, stage, type) {
    const message = error?.message || String(error);
    state.diagnostic = [
      'RAWNAK FIT AI — tracking error',
      'Stage: ' + stage,
      'Tracker: ' + type,
      'MediaPipe version: 0.10.21',
      'Error: ' + (error?.name || 'Error') + ' — ' + message,
      'UTC: ' + new Date().toISOString(),
      'Camera still live: ' + Boolean(state.stream)
    ].join('\n');
    const area = $('#debug-output');
    const panel = $('#tracking-debug');
    if (area && panel) {
      area.textContent = state.diagnostic;
      panel.classList.remove('hidden');
    }
  }
  const drawCatalog = () => {
    productsNode.textContent = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'product' + (item.id === state.selected.id ? ' selected' : '');
      button.setAttribute('aria-pressed', String(item.id === state.selected.id));
      const icon = document.createElement('span');
      icon.className = 'product-icon';
      icon.textContent = item.icon;
      const info = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = item.name;
      const subtitle = document.createElement('small');
      subtitle.textContent = item.description;
      info.append(title, subtitle);
      const selectedMark = document.createElement('span');
      selectedMark.className = 'product-indicator';
      selectedMark.textContent = item.id === state.selected.id ? '✓' : '○';
      button.append(icon, info, selectedMark);
      button.addEventListener('click', () => {
        invalidateSwap();
        if(state.selected.id!==item.id){++state.swapPanelRequest;state.swapPanelMessage='';state.swapPanelMode=Boolean(state.swapPanels[item.id]);}
        state.selected = item;
        if (state.assetMode === 'swap' && !['tee','jacket'].includes(item.id)) state.assetMode = '3d';
        state.landmarks = null;
        state.lastType = null;
        state.lastPoints = null;
        state.detected = false;
        state.fitHint = '';
        state.three?.clear();
        state.worldLandmarks = null;
        state.syncFrameReady = false;
        state.lastInference = 0;
        drawCatalog();
        updatePhotoControl();
        if (state.stream) {
          if (state.assetMode === '3d' && !state.three) void ensureThree();
          if (state.assetMode === '3d' && state.three && item.id==='tee')
            void state.three.ensureReferenceGarment().then(updateUI);
          void loadEngine(item.engine);
        }
        updateUI();
      });
      productsNode.append(button);
    }
  };
  function updateCutoutEditor(asset,force=false){
    const wrap=$('#swap-cutout-editor'),editor=$('#swap-cutout-preview'),select=$('#swap-cutout-anchor');
    if(wrap)wrap.classList.toggle('hidden',!asset);
    if(!asset||!editor||!select){state.cutoutEditorAsset=null;state.cutoutEditorFit=null;return;}
    if(!force&&state.cutoutEditorAsset===asset&&state.cutoutEditorAnchor===select.value)return;
    const ctx=editor.getContext('2d');if(!ctx)return;
    const w=editor.width,h=editor.height,tex=asset.canvas;
    const scale=Math.min((w-24)/tex.width,(h-24)/tex.height);
    const dw=tex.width*scale,dh=tex.height*scale,x=(w-dw)/2,y=(h-dh)/2;
    state.cutoutEditorAsset=asset;state.cutoutEditorAnchor=select.value;state.cutoutEditorFit={x,y,w:dw,h:dh};
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#17222e';ctx.fillRect(0,0,w,h);
    ctx.drawImage(tex,x,y,dw,dh);
    for(const [key,p] of Object.entries(asset.anchors)){
      const active=key===select.value;
      ctx.beginPath();ctx.arc(x+p.x*dw,y+p.y*dh,active?5:3,0,2*Math.PI);
      ctx.fillStyle=active?'#f2c46b':'#64e0c2';ctx.fill();
      ctx.strokeStyle='#081017';ctx.lineWidth=1.5;ctx.stroke();
    }
  }
  const updateUI = () => {
    const live = Boolean(state.stream);
    $('#stage-placeholder').classList.toggle('hidden', live);
    $('#live-chip').classList.toggle('hidden', !live);
    trackChip.classList.toggle('hidden', !live);
    captureButton.disabled = !live;
    // Keep showing live preview until a fully processed synchronized frame exists.
    layers.classList.toggle('synced', live && state.viewMode === 'sync' && state.engine === 'ready' && state.syncFrameReady);
    layers.classList.toggle('three-fast', live && state.assetMode === '3d' && Boolean(state.three) &&
      state.viewMode === 'fast' && state.engine === 'ready' && state.detected);
    const modeFast = $('#mode-fast');
    const modeSync = $('#mode-sync');
    if (modeFast) {
      modeFast.disabled = state.assetMode === 'swap';
      modeFast.title = state.assetMode === 'swap' ? 'تغيير اللون يحتاج الوضع المتزامن مع الفريم الأصلي' : '';
    }
    if (modeFast && modeSync) {
      modeFast.classList.toggle('active', state.viewMode === 'fast');
      modeSync.classList.toggle('active', state.viewMode === 'sync');
      modeFast.setAttribute('aria-pressed', String(state.viewMode === 'fast'));
      modeSync.setAttribute('aria-pressed', String(state.viewMode === 'sync'));
    }
    mainStart.disabled = state.starting;
    mainStart.textContent = state.starting ? 'جاري فتح الكاميرا…' : 'فتح الكاميرا';
    cameraToggle.textContent = live ? 'إيقاف الكاميرا' : state.starting ? 'إلغاء التشغيل' : 'تشغيل الكاميرا';
    indicator.textContent = live ? '● CAMERA LIVE' : state.starting ? 'CONNECTING…' : 'CAMERA OFF';
    indicator.style.color = live ? '#c8ee9b' : '#a5bdac';
    const swapControls=$('#clothing-swap-controls');
    const garmentSelected=['tee','jacket'].includes(state.selected.id);
    if (swapControls) swapControls.classList.toggle('hidden', !garmentSelected);
    const swapOn=garmentSelected && state.assetMode==='swap';
    const swapToggle=$('#swap-toggle'),swapBack=$('#swap-back');
    if (swapToggle) {
      swapToggle.classList.toggle('selected',swapOn);
      swapToggle.setAttribute('aria-pressed',String(swapOn));
      swapToggle.textContent=swapOn?'✓ تجربة الملابس مفعّلة':'جرّب المنتج على لبسك';
    }
    if (swapBack) swapBack.classList.toggle('hidden',!swapOn);
    const panel=state.swapPanels[state.selected.id];
    updateCutoutEditor(panel?.asset);
    $('#swap-light-controls')?.classList.toggle('hidden',!panel);
    $('#swap-cloth-controls')?.classList.toggle('hidden',!panel?.asset);
    const panelMode=$('#swap-panel-mode'),panelDemo=$('#swap-panel-demo'),panelInfo=$('#swap-panel-info');
    if(panelMode){panelMode.disabled=!panel;panelMode.textContent=state.swapPanelMode&&panel?(panel.asset?'✓ شكل القطعة مفعّل':'✓ نقشة المنتج مفعّلة'):'تطبيق صورة المنتج';panelMode.setAttribute('aria-pressed',String(Boolean(state.swapPanelMode&&panel)));}
    if(panelDemo)panelDemo.classList.toggle('hidden',state.selected.id!=='tee');
    if(panelInfo)panelInfo.textContent=state.swapPanelMessage||(panel?'الصورة جاهزة محليًا · '+panel.name:'ارفع صورة الجزء الأمامي للقماش أو استخدم عينة التيشيرت.');

    const backendStatus=$('#swap-runtime');
    if(backendStatus)backendStatus.textContent=state.segmentBackend?state.segmentBackend+' · discarded '+state.swapDropped+' · '+state.processingMs+' ms':'محرك الفصل غير متصل';
    const swapStatus=$('#swap-status');
    if(swapStatus) swapStatus.textContent=swapOn
      ? (state.segmentStatus==='loading'?'جاري تحميل نموذج فصل الملابس… الكاميرا مستمرة':
         state.segmentStatus==='error'?'تعذر فصل الملابس. اضغط إعادة التتبع أو ارجع إلى 3D':
         state.segmentStatus==='ready'?(state.swapPanelMode&&panel?(panel.asset?'AI MASK + ARTICULATED CUTOUT · معاينة الشكل والأكمام':'AI MASK + PRODUCT PANEL · نقل نقشة الجزء الأمامي'):'AI MASK · تغيير اللون فقط'):
         'افتح الكاميرا لبدء فصل الملابس')
      : 'وضع AI تجريبي لنقل اللون أو النقشة. يفضل لبس قطعة من نفس النوع.';
    const garmentControls=$('#garment-controls');
    if (garmentControls) garmentControls.classList.toggle('hidden',
      state.assetMode!=='3d'||!['tee','jacket'].includes(state.selected.id));
    const modelInfo=$('#garment-source-status');
    if(modelInfo){
      const active=state.assetMode==='3d'&&state.selected.id==='tee';
      modelInfo.classList.toggle('hidden',!active);
      const m=state.three?.referenceStatus;
      modelInfo.textContent=!state.three ? 'جارٍ تجهيز محرك 3D' :
        m?.status==='ready' ? 'GLB Reference ✓ · SkinnedMesh + Shoulder Rig · غير معتمد للمقاسات' :
        m?.status==='error' ? 'تعذر تحميل GLB · النموذج الهندسي القديم ظاهر للمقارنة: '+m.message :
        m?.status==='loading' ? 'جاري تحميل GLB مرجعي مكوّن من شبكة وعظام…' :
        'الموديل الهندسي القديم ظاهر مؤقتًا لحين تحميل مرجع GLB';
    }
    const hint = $('#fit-guide');
    if (hint) {
      hint.textContent = state.fitHint;
      hint.classList.toggle('hidden', !live || !state.fitHint);
    }
    if (live) {
      trackChip.textContent = state.engine === 'loading'
        ? 'الكاميرا مستمرة · ' + (stageLabels[state.loadingStage] || 'جاري تجهيز التتبع')
        : state.engine === 'error'
          ? 'الكاميرا مستمرة · نموذج التتبع غير متاح'
          : state.detected
            ? '✓ تم تتبع ' + (state.selected.engine === 'hand' ? 'اليد' : state.selected.engine === 'face' ? 'الوجه' : 'الجسم')
            : (state.selected.engine === 'hand' ? 'اظهر يدك ومعصمك أمام الكاميرا' : state.selected.engine === 'face' ? 'اظهر وجهك أمام الكاميرا' : 'اظهر جسمك أمام الكاميرا');
    }
    $('#tracking-status').textContent = 'Tracking ' + state.engine;
    $('#fps').textContent = live ? (state.viewMode === 'sync' ? 'Synced ' : 'Render ') + state.fps + ' FPS / AI ' + state.inferenceFPS + ' Hz' : 'Render FPS —';
    const processing = $('#processing-time');
    if (processing) processing.textContent = live && state.engine === 'ready' ? 'Analysis ' + state.processingMs + ' ms' : 'Analysis —';
    const version = $('#runtime-version');
    if (version) version.textContent = 'JS ' + BUILD_ID;
    retryButton.disabled = !live || state.engine === 'loading';
  };

  const sourceType = (category) => category;
  const modelURLs = {
    pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
  };

  const MEDIAPIPE_VERSION = '0.10.21';
  const mediaPipeSources = [
    { name: 'jsDelivr', base: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION },
    { name: 'unpkg', base: 'https://unpkg.com/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION }
  ];
  async function getVision() {
    if (!state.visionLoading) {
      state.visionLoading = (async () => {
        const failures = [];
        for (const source of mediaPipeSources) {
          try {
            state.loadingStage = 'library';
            updateUI();
            // Official MediaPipe web setup uses vision_bundle.mjs, not jsDelivr's +esm endpoint.
            const mod = await import(source.base + '/vision_bundle.mjs');
            if (!mod.FilesetResolver || !mod.HandLandmarker || !mod.FaceLandmarker || !mod.PoseLandmarker) {
              throw new Error('MediaPipe ESM exports are missing');
            }
            state.loadingStage = 'wasm';
            updateUI();
            const wasm = await mod.FilesetResolver.forVisionTasks(source.base + '/wasm');
            console.info('[RAWNAK FIT] MediaPipe ready from ' + source.name + ' (' + MEDIAPIPE_VERSION + ')');
            return { mod, wasm };
          } catch (error) {
            const reason = error?.message || String(error);
            failures.push(source.name + ': ' + reason);
            console.warn('[RAWNAK FIT] MediaPipe source failed:', source.name, error);
          }
        }
        throw new Error('تعذر تحميل MediaPipe من المصدرين. ' + failures.join(' | '));
      })().catch((error) => {
        state.visionLoading = null; // allow a retry without reopening the camera
        throw error;
      });
    }
    return state.visionLoading;
  }

  function invalidateSwap(){
    ++state.swapRevision;state.swapLastPresented=0;state.syncFrameReady=false;state.segmenter?.resetMotion?.();
    if(state.assetMode==='swap'){state.lastPoints=null;state.lastType=null;}
  }
  function resetSegmenter(){
    ++state.segmentRequest;invalidateSwap();
    try{state.segmentWorker?.close();}catch(_){}
    try{state.segmenter?.close();}catch(_){}
    state.segmentWorker=null;state.segmenter=null;state.segmentLoading=null;state.swapJob=null;
    state.segmentStatus='idle';state.segmentBackend='';
  }
  async function ensureSegmenter() {
    if(!state.stream||state.assetMode!=='swap')return null;
    if(state.segmenter)return state.segmenter;
    if(state.segmentLoading)return state.segmentLoading;
    const epoch=state.epoch,request=++state.segmentRequest;
    const current=()=>epoch===state.epoch&&request===state.segmentRequest&&Boolean(state.stream);
    state.segmentStatus='loading';invalidateSwap();updateUI();
    const pending=(async()=>{
      const engine=window.RawnakFitGarmentSegmentation?.GarmentSegmenter;
      if(!engine)throw Error('Garment compositor unavailable');
      let segmenter=null;
      const Client=window.RawnakFitSegmentWorker?.SegmentWorkerClient;
      if(!state.segmentForceMain&&Client&&typeof Worker==='function'&&typeof OffscreenCanvas==='function'&&typeof createImageBitmap==='function'){
        let client=null;
        try{
          const url=new URL('./src/fit-segment-worker.js?v=20261127-clothing-swap-b7',document.baseURI);
          client=new Client(new Worker(url));
          state.segmentWorker=client;
          const delegate=await client.init(state.segmentPreference);
          if(!current()){client.close();return null;}
          segmenter=new engine(null,()=>document.createElement('canvas'));
          state.segmentBackend='WORKER '+delegate;
        }catch(error){
          client?.close();
          if(!current())return null;
          state.segmentWorker=null;
          console.warn('[RAWNAK FIT] Worker unavailable; trying main CPU',error);
        }
      }
      if(!segmenter){
        const {mod,wasm}=await getVision();
        if(!current())return null;
        if(!mod.ImageSegmenter)throw Error('ImageSegmenter unavailable');
        segmenter=await engine.create(mod,wasm);
        if(!current()){segmenter.close();return null;}
        state.segmentBackend='MAIN CPU';
      }
      if(!current()){segmenter.close();return null;}
      state.segmenter=segmenter;state.segmentStatus='ready';state.fitHint='';
      state.lastInference=0;state.lastVideoTime=-1;updateUI();
      return segmenter;
    })().catch(error=>{
      if(current()){
        state.segmentWorker?.close();state.segmentWorker=null;
        console.warn('[RAWNAK FIT] Garment segmentation unavailable; camera remains live',error);
        state.segmentStatus='error';state.syncFrameReady=false;updateUI();
      }
      return null;
    }).finally(()=>{if(state.segmentLoading===pending)state.segmentLoading=null;});
    state.segmentLoading=pending;
    return pending;
  }

  async function loadEngine(type) {
    if (!state.stream) return;
    const epoch = state.epoch;
    const request = ++state.engineRequest;
    state.detected = false;
    state.landmarks = null;
    state.worldLandmarks = null;
    state.fitHint = '';
    state.three?.clear();
    state.engine = 'loading';
    state.syncFrameReady = false;
    state.loadingStage = state.visionLoading ? 'model' : 'library';
    clearError();
    updateUI();
    if (state.models[type]) {
      if (epoch === state.epoch && request === state.engineRequest) state.engine = 'ready';
      updateUI();
      return;
    }
    if (!state.loading[type]) {
      state.loading[type] = (async () => {
        const { mod, wasm } = await getVision();
        state.loadingStage = 'model';
        updateUI();
        const common = { baseOptions: { modelAssetPath: modelURLs[type], delegate: 'CPU' }, runningMode: 'VIDEO' };
        const klass = type === 'pose' ? mod.PoseLandmarker : type === 'face' ? mod.FaceLandmarker : mod.HandLandmarker;
        const options = type === 'pose' ? { ...common, numPoses: 1 }
          : type === 'face' ? { ...common, numFaces: 1 }
            : { ...common, numHands: 1 };
        const instance = await klass.createFromOptions(wasm, options);
        if (epoch !== state.epoch || !state.stream) {
          instance.close();
          return null;
        }
        state.models[type] = instance;
        return instance;
      })().finally(() => { delete state.loading[type]; });
    }
    try {
      const model = await state.loading[type];
      if (model && request === state.engineRequest && epoch === state.epoch) {
        state.engine = 'ready';
        state.lastInference = 0;
        state.lastPoints = null;
        state.syncFrameReady = false;
        state.lastVideoTime = -1;
        clearError();
      }
    } catch (error) {
      console.error('[RAWNAK FIT] Tracking model error; camera is still running.', error);
      if (request === state.engineRequest && epoch === state.epoch) {
        state.engine = 'error';
        recordTrackingError(error, state.loadingStage, type);
        showError('الكاميرا شغالة، لكن التتبع فشل. اضغط «تفاصيل الخطأ» أسفل الفيديو لمعرفة السبب أو جرّب إعادة التتبع.');
      }
    }
    updateUI();
  }

  function closeModels() {
    for (const model of Object.values(state.models)) {
      try { model.close(); } catch (error) { console.warn('Model disposal warning:', error); }
    }
    state.models = {};
    state.loading = {};
  }
  function stopCamera() {
    ++state.epoch;
    ++state.engineRequest;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
    const stream = state.stream;
    state.stream = null;
    if (stream) stream.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    video.pause();
    video.srcObject = null;
    closeModels();
    resetSegmenter();state.segmentHint='';state.segmentForceMain=false;state.swapDropped=0;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const syncContext = syncCanvas.getContext('2d');
    if (syncContext) syncContext.clearRect(0, 0, syncCanvas.width, syncCanvas.height);
    state.starting = false;
    state.engine = 'idle';
    state.loadingStage = 'idle';
    state.landmarks = null;
    state.worldLandmarks = null;
    state.fitHint = '';
    state.three?.clear();
    state.lastPoints = null;
    state.fps = 0;
    state.syncFrameReady = false;
    state.processingMs = 0;
    state.lastVideoTime = -1;
    state.inferenceFPS = 0;
    state.inferenceFrames = 0;
    state.detected = false;
    clearError();
    updateUI();
  }

  function friendlyCameraError(error) {
    switch (error && error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError': return 'إذن الكاميرا مرفوض. اسمح للموقع بالكاميرا من إعدادات المتصفح.';
      case 'NotReadableError':
      case 'TrackStartError': return 'الكاميرا مشغولة بواسطة تطبيق آخر، اقفله وحاول مرة ثانية.';
      case 'NotFoundError':
      case 'DevicesNotFoundError': return 'لا توجد كاميرا متاحة على هذا الجهاز.';
      case 'OverconstrainedError': return 'الكاميرا لا تدعم الإعدادات المطلوبة. جرّب إعادة تشغيلها.';
      case 'AbortError': return 'المتصفح ألغى فتح الكاميرا. حاول مرة ثانية.';
      default: return 'تعذر تشغيل الكاميرا. تأكد من HTTPS وصلاحيات المتصفح.';
    }
  }

  async function startCamera() {
    if (state.stream || state.starting) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      showError('الكاميرا تحتاج HTTPS أو localhost، ومتصفح حديث.');
      return;
    }
    const epoch = ++state.epoch;
    state.starting = true;
    state.engine = 'idle';
    clearError();
    updateUI();
    let stream = null;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } },
          audio: false
        });
      } catch (error) {
        if (error.name !== 'OverconstrainedError') throw error;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (epoch !== state.epoch) { stream.getTracks().forEach((t) => t.stop()); return; }
      state.stream = stream; // camera is independent of any AI model
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      if (epoch !== state.epoch) { stream.getTracks().forEach((t) => t.stop()); return; }
      state.starting = false;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (epoch !== state.epoch) return;
          stopCamera();
          showError('الكاميرا اتفصلت من النظام أو تم استخدامها بواسطة تطبيق آخر.');
        };
      });
      state.lastFps = performance.now();
      state.frameCount = 0;
      state.inferenceFrames = 0;
      state.inferenceFPS = 0;
      state.syncFrameReady = false;
      state.processingMs = 0;
      state.lastVideoTime = -1;
      state.lastInference = 0;
      updateUI();
      state.raf = requestAnimationFrame(renderLoop);
      if (state.assetMode === '3d') void ensureThree();
      void loadEngine(sourceType(state.selected.engine)); // model failures do not close stream
      if(state.assetMode==='swap')void ensureSegmenter();
    } catch (error) {
      if (epoch !== state.epoch) return;
      console.error('[RAWNAK FIT] Camera error:', error);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
      video.srcObject = null;
      state.starting = false;
      state.engine = 'error';
      showError(friendlyCameraError(error));
      updateUI();
    }
  }

  function smoothing(type, coords) {
    if (!coords) {
      if(type==='pose'&&state.assetMode==='swap'){state.lastPoints=null;state.lastType=null;}
      return null;
    }
    if (state.lastType !== type || !state.lastPoints || state.lastPoints.length !== coords.length) {
      state.lastType = type;
      state.lastPoints = coords.map((p) => ({ x:p.x, y:p.y, z:p.z, visibility:p.visibility, presence:p.presence }));
    } else {
      coords.forEach((point, i) => {
        // Faster response in both modes; in synchronized mode only tiny jitter is filtered.
        let alpha = state.viewMode === 'sync' ? 0.92 : 0.76;
        if(type==='pose'&&state.assetMode==='swap'){
          // Smooth sub-percent jitter, but follow deliberate motion quickly.
          const old=state.lastPoints[i],motion=Math.hypot(point.x-old.x,point.y-old.y);
          const confidenceLost=(old.visibility??1)<.55||(point.visibility??1)<.55;
          alpha=confidenceLost?1:Math.max(.38,Math.min(1,.38+motion*25));
        }
        state.lastPoints[i].x += (point.x - state.lastPoints[i].x) * alpha;
        state.lastPoints[i].y += (point.y - state.lastPoints[i].y) * alpha;
        if(Number.isFinite(point.z)) state.lastPoints[i].z = (state.lastPoints[i].z || 0) * (1-alpha) + point.z * alpha;
        state.lastPoints[i].visibility = point.visibility;
        state.lastPoints[i].presence = point.presence;
      });
    }
    return state.lastPoints;
  }
  function detect(frameTime) {
    const type = state.selected.engine;
    const model = state.models[type];
    if (!model || state.engine !== 'ready' || video.readyState < 2 || frameTime - state.lastInference < LIVE_INTERVAL_MS) return;
    state.lastInference = frameTime;
    try {
      const t0 = performance.now();
      const result = model.detectForVideo(video, frameTime);
      state.processingMs = Math.round(performance.now() - t0);
      state.inferenceFrames += 1;
      const raw = (type === 'face' ? result.faceLandmarks?.[0] : result.landmarks?.[0]) || null;
      state.landmarks = smoothing(type, raw);
      state.worldLandmarks = result.worldLandmarks?.[0] || null;
      state.detected = !!state.landmarks;
    } catch (error) {
      console.error('[RAWNAK FIT] Inference error; preserving camera', error);
      state.engine = 'error';
      state.detected = false;
      state.landmarks = null;
      state.syncFrameReady = false;
      recordTrackingError(error, 'inference', type);
      showError('تعطّل تحليل الفيديو، لكن الكاميرا مستمرة. افتح «تفاصيل الخطأ» ثم جرّب إعادة التتبع.');
    }
  }

  function setupCanvas() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return null;
    const pixelW = Math.round(w * ratio), pixelH = Math.round(h * ratio);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function project(point, width, height) {
    if (!point || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    return {
      x: (width - video.videoWidth * scale) / 2 + point.x * video.videoWidth * scale,
      y: (height - video.videoHeight * scale) / 2 + point.y * video.videoHeight * scale
    };
  }
  function polygon(ctx, points, fill, outline) {
    if (points.some((p) => !p)) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.fill();
    ctx.stroke();
  }
  function drawGarment(ctx, pose, w, h, item) {
    const a = project(pose[11], w, h), b = project(pose[12], w, h);
    const hipA = project(pose[23], w, h), hipB = project(pose[24], w, h);
    if (![a, b, hipA, hipB].every(Boolean)) return;
    const width = Math.hypot(b.x - a.x, b.y - a.y);
    if (width < 30) return;
    const shoulderY = (a.y + b.y) / 2;
    const hipY = (hipA.y + hipB.y) / 2;
    const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
    const extra = item.id === 'jacket' ? .19 : .12;
    const fill = item.color + 'd9';
    const points = [
      { x: left, y: shoulderY - width * .12 },
      { x: left - width * .25, y: shoulderY + width * .12 },
      { x: left - width * .22, y: shoulderY + width * .45 },
      { x: left - width * .07, y: shoulderY + width * .44 },
      { x: left - width * extra, y: hipY },
      { x: right + width * extra, y: hipY },
      { x: right + width * .07, y: shoulderY + width * .44 },
      { x: right + width * .22, y: shoulderY + width * .45 },
      { x: right + width * .25, y: shoulderY + width * .12 },
      { x: right, y: shoulderY - width * .12 }
    ];
    ctx.save();
    ctx.shadowColor = '#0008'; ctx.shadowBlur = 16;
    polygon(ctx, points, fill, '#173b2ddd');
    ctx.restore();
    ctx.strokeStyle = '#173b2d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((left + right) / 2, shoulderY + 9);
    ctx.lineTo((left + right) / 2, hipY - 4);
    if (item.id === 'jacket') ctx.stroke();
    ctx.fillStyle = '#233828cc';
    ctx.font = '600 ' + Math.max(9, width / 11) + 'px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('RAWNAK FIT', (left + right) / 2, hipY - 17);
  }
  function drawGlasses(ctx, face, w, h) {
    const leftEye = project(face[33], w, h), rightEye = project(face[263], w, h);
    if (!leftEye || !rightEye) return;
    const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    if (eyeDistance < 14) return;
    ctx.save();
    ctx.translate((leftEye.x + rightEye.x) / 2, (leftEye.y + rightEye.y) / 2);
    ctx.rotate(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x));
    ctx.strokeStyle = '#222b30'; ctx.fillStyle = '#253b48b9'; ctx.lineWidth = Math.max(2, eyeDistance * .07);
    const radius = eyeDistance * .40;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * eyeDistance * .48, 0, radius, radius * .62, 0, 0, 2 * Math.PI);
      ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-eyeDistance * .13, -radius * .15);
    ctx.quadraticCurveTo(0, -radius * .55, eyeDistance * .13, -radius * .15); ctx.stroke();
    ctx.restore();
  }
  function drawWrist(ctx, hand, w, h, item) {
    const wrist = project(hand[0], w, h), middle = project(hand[9], w, h);
    if (!wrist || !middle) return;
    const dist = Math.max(16, Math.hypot(wrist.x - middle.x, wrist.y - middle.y));
    ctx.save();
    // Wrist accessory sits just behind the base of the palm, toward the forearm.
    ctx.translate(wrist.x - (middle.x - wrist.x) * 0.16, wrist.y - (middle.y - wrist.y) * 0.16);
    ctx.rotate(Math.atan2(middle.y - wrist.y, middle.x - wrist.x) - Math.PI / 2);
    ctx.lineWidth = Math.max(3, dist * .17);
    ctx.strokeStyle = item.id === 'watch' ? '#3d4c46' : '#e3b664';
    ctx.beginPath(); ctx.moveTo(-dist * .36, 0); ctx.lineTo(dist * .36, 0); ctx.stroke();
    if (item.id === 'watch') {
      ctx.fillStyle = '#202e2a'; ctx.strokeStyle = '#e7d39d'; ctx.lineWidth = Math.max(2, dist * .05);
      const radius = dist * .28;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#c9f198'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -radius * .6); ctx.moveTo(0, 0); ctx.lineTo(radius * .5, radius * .15); ctx.stroke();
    } else {
      ctx.lineWidth = Math.max(4, dist * .11);
      ctx.strokeStyle = '#f4d08c'; ctx.beginPath(); ctx.ellipse(0, 0, dist * .33, dist * .19, 0, 0, 2 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBag(ctx, pose, w, h) {
    const shoulder = project(pose[12], w, h), hip = project(pose[24], w, h), other = project(pose[11], w, h);
    if (!shoulder || !hip || !other) return;
    const width = Math.hypot(other.x - shoulder.x, other.y - shoulder.y);
    const bagW = width * .53, bagH = width * .57;
    const centerX = shoulder.x + (shoulder.x - other.x) * .40;
    const centerY = hip.y - bagH * .25;
    ctx.save();
    ctx.strokeStyle = '#d4ac87'; ctx.lineWidth = Math.max(3, width * .05);
    ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(centerX, centerY - bagH / 2); ctx.stroke();
    ctx.fillStyle = '#b77e55ec'; ctx.strokeStyle = '#f0c594'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(centerX - bagW / 2, centerY - bagH / 2, bagW, bagH, bagW * .13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8cd9a'; ctx.fillRect(centerX - bagW * .08, centerY - bagH * .45, bagW * .16, bagH * .11);
    ctx.restore();
  }
  function drawShoes(ctx, pose, w, h) {
    for (const index of [27, 28]) {
      const ankle = project(pose[index], w, h);
      if (!ankle) continue;
      const width = Math.max(30, w * .075), height = width * .42;
      ctx.fillStyle = '#e4e9e2ef'; ctx.strokeStyle = '#45574a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(ankle.x - width * .5, ankle.y - height * .1, width, height, height / 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#9aac9b'; ctx.beginPath(); ctx.moveTo(ankle.x - width * .21, ankle.y + height * .12); ctx.lineTo(ankle.x + width * .16, ankle.y + height * .12); ctx.stroke();
    }
  }
  function drawDemoPhoto(ctx, landmarks, w, h) {
    const image=state.demoImage;
    if (!image || !state.demoImageReady || !demoAsset || !fitGeometry || !state.demoCrop) return false;
    const layout=fitGeometry.createPlacement(demoAsset.item,landmarks,{
      width:w,height:h,project,crop:state.demoCrop,
      scale:state.sizeScale,worldLandmarks:state.worldLandmarks
    });
    if (!layout.ok) {
      state.fitHint=layout.reason;
      return false;
    }
    state.fitHint='';
    const {x,y,width,height,angle}=layout;
    const crop=state.demoCrop;
    ctx.save();
    try {
      ctx.translate(x,y);
      ctx.rotate(angle);
      ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,
        -width/2,-height/2,width,height);
      return true;
    } finally {ctx.restore();}
  }
  function drawOverlayTo(ctx, w, h, frameTime) {
    if (!state.detected || !state.landmarks) {
      state.three?.clear();
      return;
    }
    try {
      if (state.assetMode === 'swap' && ['tee','jacket'].includes(state.selected.id)) {
        state.three?.clear();
        if (state.viewMode !== 'sync') {
          state.fitHint = 'تغيير اللون متاح فقط في الوضع المتزامن';
          return;
        }
        if(!state.segmenter||!Number.isFinite(frameTime))return;
        try{
          const output=state.segmenter.apply(ctx,sampleCanvas,state.landmarks,{
            width:w,height:h,color:state.selected.color,strength:state.swapStrength,timestamp:frameTime,clothMaterial:state.clothMaterial,lightStrength:state.lightStrength,
            texture:state.swapPanelMode&&!state.swapPanels[state.selected.id]?.asset?(state.swapPanels[state.selected.id]?.canvas||null):null,
            cutout:state.swapPanelMode?(state.swapPanels[state.selected.id]?.asset||null):null
          });
          state.fitHint=output.ok?'':output.reason;
        }catch(error){
          console.warn('[RAWNAK FIT] semantic mask failed, preserving raw camera',error);
          try{state.segmenter?.close();}catch(_){}
          state.segmenter=null;state.segmentStatus='error';state.syncFrameReady=false;
          state.fitHint='تعذر تحليل الملابس — جرّب إعادة التتبع أو ارجع إلى 3D';
        }
        return;
      }
      if (state.assetMode === '3d') {
        if (!state.three) {
          state.fitHint = state.threeError
            ? 'تعذر تحميل 3D — جرّب تشغيله مجددًا أو افتح وضع 2D'
            : 'جاري تحميل مجسمات 3D…';
          return;
        }
        const output = state.three.render(state.selected.id, state.landmarks, {
          width:w,height:h,project,worldLandmarks:state.worldLandmarks,scale:state.sizeScale,
          garmentMotion:state.garmentMotion
        });
        state.fitHint = output.ok ? (output.placement?.approximate ? output.placement.reason : '') : output.reason;
        if (output.ok && state.viewMode === 'sync') {
          // Same analyzed camera frame + its 3D output on the same composed canvas.
          ctx.drawImage(output.canvas,0,0,w,h);
        }
        return;
      }
      state.three?.clear();
      if (demoAsset && state.assetMode === 'photo' && state.selected.id === demoAsset.item) {
        // If anchor quality is insufficient, NEVER replace the failed photo with the
        // old oversized schematic overlay. Show a positioning hint instead.
        if (state.demoImageReady) drawDemoPhoto(ctx, state.landmarks, w, h);
        return;
      }
      if (state.selected.id === 'tee' || state.selected.id === 'jacket') drawGarment(ctx, state.landmarks, w, h, state.selected);
      else if (state.selected.id === 'glasses') drawGlasses(ctx, state.landmarks, w, h);
      else if (state.selected.id === 'watch' || state.selected.id === 'bracelet') drawWrist(ctx, state.landmarks, w, h, state.selected);
      else if (state.selected.id === 'bag') drawBag(ctx, state.landmarks, w, h);
      else if (state.selected.id === 'shoes') drawShoes(ctx, state.landmarks, w, h);
    } catch (error) {
      console.warn('[RAWNAK FIT] AR overlay skipped this frame', error);
      if (state.assetMode === '3d') {
        state.threeError = error?.message || String(error);
        state.fitHint = 'تعذر عرض المجسم 3D — التتبع والكاميرا مازالوا شغالين';
        state.three?.clear();
      }
    }
  }
  function drawOverlay() {
    const info = setupCanvas();
    if (info) drawOverlayTo(info.ctx, info.w, info.h);
  }
  function setupSyncCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return null;
    const pixelW = Math.max(1, Math.round(w * ratio));
    const pixelH = Math.max(1, Math.round(h * ratio));
    if (syncCanvas.width !== pixelW || syncCanvas.height !== pixelH) {
      syncCanvas.width = pixelW;
      syncCanvas.height = pixelH;
    }
    const ctx = syncCanvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, w, h };
  }
  // The video frame used as the detector input is also the displayed frame.
  // This prevents an old landmark result being drawn on a newer camera image.
  function swapOptions(w,h,frameTime){
    const panel=state.swapPanels[state.selected.id];
    return {width:w,height:h,color:state.selected.color,strength:state.swapStrength,timestamp:frameTime,clothMaterial:state.clothMaterial,lightStrength:state.lightStrength,
      texture:state.swapPanelMode&&!panel?.asset?(panel?.canvas||null):null,
      cutout:state.swapPanelMode?(panel?.asset||null):null};
  }
  function renderWorkerSwap(frameTime,t0){
    const worker=state.segmentWorker;
    if(!worker||state.swapJob||!state.landmarks)return false;
    const source=document.createElement('canvas'),ratio=Math.min(1,640/Math.max(sampleCanvas.width,sampleCanvas.height));
    source.width=Math.max(1,Math.round(sampleCanvas.width*ratio));source.height=Math.max(1,Math.round(sampleCanvas.height*ratio));
    const sourceCtx=source.getContext('2d');if(!sourceCtx)return false;
    sourceCtx.drawImage(sampleCanvas,0,0,source.width,source.height);
    const input=document.createElement('canvas'),down=Math.min(1,320/Math.max(source.width,source.height));
    input.width=Math.max(1,Math.round(source.width*down));input.height=Math.max(1,Math.round(source.height*down));
    const inputCtx=input.getContext('2d');if(!inputCtx)return false;
    inputCtx.drawImage(source,0,0,input.width,input.height);
    const pose=state.landmarks.map(p=>({...p})),job={worker,epoch:state.epoch,request:state.engineRequest,revision:state.swapRevision,started:t0};
    state.swapJob=job;
    const valid=()=>state.swapJob===job&&state.segmentWorker===worker&&state.epoch===job.epoch&&state.engineRequest===job.request&&state.swapRevision===job.revision&&state.assetMode==='swap'&&state.viewMode==='sync'&&state.engine==='ready'&&Boolean(state.stream);
    worker.request(input,frameTime).then(mask=>{
      if(!valid())return;
      const elapsed=Math.round(performance.now()-t0);state.processingMs=elapsed;
      if(elapsed>500){state.swapDropped++;state.syncFrameReady=false;state.fitHint='المعالجة بطيئة؛ الكاميرا الأصلية مستمرة';updateUI();return;}
      const target=setupSyncCanvas();if(!target)return;
      const {ctx,w,h}=target,scale=Math.max(w/source.width,h/source.height),dw=source.width*scale,dh=source.height*scale;
      ctx.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);
      const output=state.segmenter.applyMask(ctx,source,pose,swapOptions(w,h,frameTime),mask);
      state.fitHint=output.ok?'':output.reason;
      state.swapLastPresented=performance.now();state.syncFrameReady=true;state.frameCount++;updateUI();
    }).catch(error=>{
      // A rejected old-session request must not reset the new session.
      if(state.segmentWorker!==worker||state.epoch!==job.epoch)return;
      console.warn('[RAWNAK FIT] Worker failed; preserving camera and using CPU fallback',error);
      resetSegmenter();state.segmentForceMain=true;
      if(state.stream&&state.assetMode==='swap')void ensureSegmenter();else updateUI();
    }).finally(()=>{
      source.width=source.height=input.width=input.height=1;
      if(state.swapJob===job)state.swapJob=null;
    });
    return false;
  }
  function renderSynchronizedFrame(frameTime) {
    const type = state.selected.engine;
    const model = state.models[type];
    if (!model || state.engine !== 'ready' || video.readyState < 2 ||
        !video.videoWidth || !video.videoHeight || !sampleContext ||
        frameTime - state.lastInference < SYNC_INTERVAL_MS) return false;
    // Semantic inference is opt-in and slower; never reuse a mask from an older image.
    const swapInterval=Math.max(100,Math.min(300,Math.ceil((state.processingMs||0)*1.8)));
    if(state.assetMode==='swap'){
      if(!state.segmenter||state.segmentStatus!=='ready')return false;
      if(state.segmentWorker&&state.swapJob){
        if(state.syncFrameReady&&frameTime-state.swapLastPresented>500){state.syncFrameReady=false;updateUI();}
        return false;
      }
      if(frameTime-state.lastInference<swapInterval)return false;
    }
    // Avoid recalculating identical camera frames. The camera timestamp is media time.
    if (video.currentTime === state.lastVideoTime) return false;
    state.lastVideoTime = video.currentTime;
    state.lastInference = frameTime;
    const sourceWidth = video.videoWidth, sourceHeight = video.videoHeight;
    if (sampleCanvas.width !== sourceWidth || sampleCanvas.height !== sourceHeight) {
      sampleCanvas.width = sourceWidth;
      sampleCanvas.height = sourceHeight;
    }
    try {
      sampleContext.drawImage(video, 0, 0, sourceWidth, sourceHeight);
      const t0 = performance.now();
      const result = model.detectForVideo(sampleCanvas, frameTime);
      state.processingMs = Math.round(performance.now() - t0);
      state.inferenceFrames++;
      const raw = (type === 'face' ? result.faceLandmarks?.[0] : result.landmarks?.[0]) || null;
      state.landmarks = smoothing(type, raw);
      state.worldLandmarks = result.worldLandmarks?.[0] || null;
      state.detected = Boolean(state.landmarks);
      if(state.assetMode==='swap'&&state.segmentWorker&&state.landmarks)return renderWorkerSwap(frameTime,t0);
      const target = setupSyncCanvas();
      if (!target) return false;
      const { ctx, w, h } = target;
      const scale = Math.max(w / sourceWidth, h / sourceHeight);
      const displayWidth = sourceWidth * scale;
      const displayHeight = sourceHeight * scale;
      // Object-fit cover, exactly matching the coordinates used in project().
      ctx.drawImage(sampleCanvas, (w - displayWidth) / 2, (h - displayHeight) / 2, displayWidth, displayHeight);
      drawOverlayTo(ctx, w, h, frameTime);
      if(state.assetMode==='swap'){
        state.swapLastPresented=performance.now();
        state.processingMs=Math.round(performance.now()-t0);
        if(state.segmentStatus==='error'){state.syncFrameReady=false;updateUI();return false;}
      }
      // Same-frame forearm pixels may be composited over shirt geometry. This
      // approximate overlap mask is explicitly opt-in and is NOT segmentation.
      state.occlusionCount=0;
      if(state.assetMode==='3d' && (state.selected.id==='tee'||state.selected.id==='jacket') &&
         state.armOcclusion && state.detected && state.three && window.RawnakFitArmOcclusion) {
        state.occlusionCount=window.RawnakFitArmOcclusion.restoreArms(ctx,sampleCanvas,
          state.landmarks,{width:w,height:h,project,worldLandmarks:state.worldLandmarks,
          sourceWidth,sourceHeight});
      }
      if (!state.syncFrameReady) {
        state.syncFrameReady = true;
        updateUI();
      }
      return true;
    } catch (error) {
      console.error('[RAWNAK FIT] Synchronized frame processing failed', error);
      state.engine = 'error';
      state.syncFrameReady = false;
      state.detected = false;
      state.landmarks = null;
      recordTrackingError(error, 'synchronized-frame', type);
      showError('تعذرت معالجة الفريم المتزامن. الكاميرا هتفضل شغالة؛ افتح تفاصيل الخطأ أو اختار اللايف السريع.');
      updateUI(); // shows camera immediately because syncFrameReady is now false
      return false;
    }
  }
  function renderLoop(now) {
    if (!state.stream) return;
    if (state.viewMode === 'sync' && state.engine === 'ready') {
      if (renderSynchronizedFrame(now)) state.frameCount++;
    } else {
      detect(now);
      drawOverlay();
      state.frameCount++;
    }
    if (now - state.lastFps > 1000) {
      const elapsed = Math.max(1, now - state.lastFps);
      state.fps = Math.round(state.frameCount * 1000 / elapsed);
      state.inferenceFPS = Math.round(state.inferenceFrames * 1000 / elapsed);
      state.frameCount = 0;
      state.inferenceFrames = 0;
      state.lastFps = now;
      updateUI();
    }
    state.raf = requestAnimationFrame(renderLoop);
  }
  function saveSnapshot() {
    if (!state.stream || !video.videoWidth || !video.videoHeight) return;
    const result = document.createElement('canvas');
    const synced = state.viewMode === 'sync' && state.syncFrameReady && state.engine === 'ready';
    const preview = synced ? syncCanvas : canvas;
    result.width = preview.width || stage.clientWidth;
    result.height = preview.height || stage.clientHeight;
    const ctx = result.getContext('2d');
    const scale = Math.max(result.width / video.videoWidth, result.height / video.videoHeight);
    const width = video.videoWidth * scale, height = video.videoHeight * scale;
    if (state.mirror) { ctx.translate(result.width, 0); ctx.scale(-1, 1); }
    if (synced) {
      // Screenshot the exact synchronized image displayed in the mirror.
      ctx.drawImage(syncCanvas, 0, 0, result.width, result.height);
    } else {
      ctx.drawImage(video, (result.width - width) / 2, (result.height - height) / 2, width, height);
      ctx.drawImage(canvas, 0, 0, result.width, result.height);
      if (state.assetMode === '3d' && state.three?.canvas)
        ctx.drawImage(state.three.canvas,0,0,result.width,result.height);
    }
    const link = document.createElement('a');
    link.download = 'rawnak-fit-' + Date.now() + '.png';
    link.href = result.toDataURL('image/png');
    link.click();
  }

  function changeViewMode(nextMode) {
    if (!['sync', 'fast'].includes(nextMode) || state.viewMode === nextMode) return;
    if (nextMode === 'fast' && state.assetMode === 'swap') {
      state.fitHint='تغيير اللون يحتاج الفريم المتزامن، ارجع لوضع 3D للايف السريع';
      updateUI();
      return;
    }
    invalidateSwap();
    state.viewMode = nextMode;
    state.lastInference = 0;
    state.lastVideoTime = -1;
    state.lastPoints = null;
    state.lastType = null;
    state.syncFrameReady = false;
    state.three?.clear();
    state.frameCount = 0;
    state.inferenceFrames = 0;
    state.lastFps = performance.now();
    updateUI();
  }
  function activatePanel(){
    invalidateSwap();state.swapPanelMode=true;state.assetMode='swap';changeViewMode('sync');
    state.syncFrameReady=false;state.lastInference=0;state.lastVideoTime=-1;state.three?.clear();
    if(state.stream)void ensureSegmenter();updatePhotoControl();updateUI();
  }
  async function loadProductPanel(source,{centralCrop=false,cutoutSleeves=null,name='صورة المنتج'}={}){
    const item=state.selected.id;if(!['tee','jacket'].includes(item))return;
    const request=++state.swapPanelRequest;
    state.swapPanelMessage='جاري تجهيز الصورة محليًا…';updateUI();
    let image=null,url=null;
    try{
      if(typeof source==='string'){url=source;}
      else{
        if(!source||!['image/png','image/jpeg','image/webp'].includes(source.type)||source.size>10*1024*1024)throw Error('اختر صورة PNG أو JPEG أو WebP بحجم لا يتجاوز 10 MB');
        url=URL.createObjectURL(source);
      }
      image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('تعذر قراءة صورة المنتج'));i.src=url;});
      if(request!==state.swapPanelRequest||item!==state.selected.id)return;
      const engine=window.RawnakFitProductTransfer;if(!engine)throw Error('محرك نقل النقشة غير متاح');
      const asset=cutoutSleeves?window.RawnakFitGarmentCutout?.prepareCutout(image,{sleeves:cutoutSleeves}):null;
      if(cutoutSleeves&&!asset)throw Error('محرك شكل القطعة غير متاح');
      const panel=asset?.canvas||engine.preparePanel(image,{centralCrop});
      const previous=state.swapPanels[item]?.canvas;if(previous){previous.width=1;previous.height=1;}
      state.swapPanels[item]={canvas:panel,asset,name:String(name).slice(0,80)};
      state.swapPanelMessage=asset?'الصورة جاهزة · اضبط نقاط الياقة والكتفين والأكمام عند الحاجة':'الصورة جاهزة · معاينة تقريبية للجزء الأمامي فقط';
      activatePanel();
    }catch(error){
      if(request===state.swapPanelRequest){state.swapPanelMessage=error?.message||'تعذر تجهيز النقشة';updateUI();}
    }finally{if(url&&typeof source!=='string')URL.revokeObjectURL(url);}
  }
  $('#swap-panel-upload')?.addEventListener('change',event=>{
    const file=event.target.files?.[0];if(!file)return;
    const kind=$('#swap-panel-crop')?.value;
    const cutoutSleeves=kind==='cutout-long'?'long':kind==='cutout-short'?'short':null;
    void loadProductPanel(file,{centralCrop:kind==='center',cutoutSleeves,name:file.name});event.target.value='';
  });
  $('#swap-panel-demo')?.addEventListener('click',()=>{
    if(state.selected.id==='tee'){
      const kind=$('#swap-panel-crop')?.value,full=kind==='cutout-short'||kind==='cutout-long';
      void loadProductPanel('./demo/assets/tshirt-cutout.webp',{centralCrop:!full,cutoutSleeves:full?'short':null,name:'عينة تيشيرت تجريبية'});
    }
  });
  $('#swap-cutout-anchor')?.addEventListener('change',()=>updateCutoutEditor(state.swapPanels[state.selected.id]?.asset,true));
  $('#swap-cutout-preview')?.addEventListener('click',event=>{
    const asset=state.swapPanels[state.selected.id]?.asset,editor=$('#swap-cutout-preview'),key=$('#swap-cutout-anchor')?.value,fit=state.cutoutEditorFit;
    if(!asset||!editor||!key||!fit||!Object.hasOwn(asset.anchors,key))return;
    const rect=editor.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const x=((event.clientX-rect.left)*editor.width/rect.width-fit.x)/fit.w;
    const y=((event.clientY-rect.top)*editor.height/rect.height-fit.y)/fit.h;
    const proposed={...asset.anchors,[key]:{x:Math.max(0,Math.min(1,x)),y:Math.max(0,Math.min(1,y))}};
    if(!window.RawnakFitGarmentCutout?.validAnchors(proposed)){state.swapPanelMessage='النقطة خارج ترتيب القطعة الصحيح؛ اختر موضعًا آخر';updateUI();return;}
    invalidateSwap();asset.anchors=proposed;state.swapPanelMessage='تم تحديث نقطة شكل القطعة';state.syncFrameReady=false;state.lastVideoTime=-1;
    updateCutoutEditor(asset,true);updateUI();
  });
  $('#swap-cutout-reset')?.addEventListener('click',()=>{
    const asset=state.swapPanels[state.selected.id]?.asset;if(!asset)return;
    invalidateSwap();asset.anchors=window.RawnakFitGarmentCutout.defaultAnchors(asset.sleeves);
    state.swapPanelMessage='تمت إعادة النقاط الافتراضية';state.syncFrameReady=false;state.lastVideoTime=-1;
    updateCutoutEditor(asset,true);updateUI();
  });
  $('#swap-panel-mode')?.addEventListener('click',()=>{
    if(!state.swapPanels[state.selected.id])return;
    if(state.swapPanelMode&&state.assetMode==='swap'){invalidateSwap();state.swapPanelMode=false;state.syncFrameReady=false;state.lastVideoTime=-1;updateUI();}
    else activatePanel();
  });
  $('#swap-panel-clear')?.addEventListener('click',()=>{
    invalidateSwap();++state.swapPanelRequest;const item=state.selected.id,old=state.swapPanels[item]?.canvas;
    if(old){old.width=1;old.height=1;}delete state.swapPanels[item];state.swapPanelMode=false;
    state.swapPanelMessage='تم حذف الصورة المحلية';state.syncFrameReady=false;state.lastVideoTime=-1;updateUI();
  });
  $('#swap-toggle')?.addEventListener('click',()=>{
    if (!['tee','jacket'].includes(state.selected.id)) return;
    invalidateSwap();state.assetMode = state.assetMode === 'swap' ? '3d' : 'swap';
    if (state.assetMode === 'swap') {
      changeViewMode('sync');
      if(state.stream)void ensureSegmenter();
    }
    state.three?.clear();
    state.fitHint='';
    state.syncFrameReady=false;
    state.lastInference=0;
    if (state.assetMode === '3d' && state.stream) void ensureThree();
    updatePhotoControl(); updateUI();
  });
  $('#swap-back')?.addEventListener('click',()=>{
    invalidateSwap();state.assetMode='3d';state.fitHint='';state.syncFrameReady=false;state.lastInference=0;
    if (state.stream) void ensureThree();
    updatePhotoControl();updateUI();
  });
  $('#swap-light-strength')?.addEventListener('input',event=>{
    state.lightStrength=Math.max(0,Math.min(1,Number(event.target.value)/100||0));
    invalidateSwap();state.lastVideoTime=-1;
    const out=$('#swap-light-value');if(out)out.textContent=Math.round(state.lightStrength*100)+'%';updateUI();
  });
  $('#swap-cloth-material')?.addEventListener('change',event=>{
    state.clothMaterial=['off','cotton','silk','denim'].includes(event.target.value)?event.target.value:'cotton';
    invalidateSwap();state.lastVideoTime=-1;updateUI();
  });
  $('#swap-backend')?.addEventListener('change',event=>{
    state.segmentPreference=event.target.value==='gpu'?'gpu':'cpu';
    state.segmentForceMain=false;resetSegmenter();
    if(state.stream&&state.assetMode==='swap')void ensureSegmenter();else updateUI();
  });
  $('#swap-strength')?.addEventListener('input',event=>{
    invalidateSwap();state.swapStrength=Math.max(.4,Math.min(1,Number(event.target.value)/100||.9));
    state.lastVideoTime=-1;updateUI();
    const output=$('#swap-strength-value');
    if(output) output.textContent=Math.round(state.swapStrength*100)+'%';
  });
  $('#mode-fast')?.addEventListener('click', () => changeViewMode('fast'));
  $('#mode-sync')?.addEventListener('click', () => changeViewMode('sync'));
  $('#garment-motion')?.addEventListener('change',event=>{
    state.garmentMotion=Boolean(event.target.checked);
  });
  $('#arm-occlusion')?.addEventListener('change',event=>{
    state.armOcclusion=Boolean(event.target.checked);
    state.occlusionCount=0;
  });
  $('#fit-scale')?.addEventListener('input', event => {
    const number=Number(event.target.value);
    state.sizeScale=Math.max(.7,Math.min(1.3,number/100 || 1));
    const label=$('#fit-scale-value');
    if(label)label.textContent=Math.round(state.sizeScale*100)+'%';
  });
  mainStart.addEventListener('click', startCamera);
  cameraToggle.addEventListener('click', () => { if (state.stream || state.starting) stopCamera(); else void startCamera(); });
  retryButton.addEventListener('click', () => {
    if (state.stream) {
      if (state.assetMode === '3d' && !state.three) void ensureThree();
      state.engine = 'idle';
      void loadEngine(state.selected.engine);
      if(state.assetMode==='swap'){
        state.segmentForceMain=false;resetSegmenter();void ensureSegmenter();
      }
    }
  });
  captureButton.addEventListener('click', saveSnapshot);
  $('#copy-debug')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.diagnostic);
      $('#copy-debug').textContent = 'تم نسخ التقرير';
    } catch {
      $('#debug-output')?.focus();
      $('#debug-output')?.select?.();
    }
  });
  $('#mirror-toggle').addEventListener('click', () => {
    state.mirror = !state.mirror;
    layers.classList.toggle('flipped', state.mirror);
  });
  window.addEventListener('pagehide', () => {
    stopCamera();
    state.three?.dispose();
    state.three = null;
  });
  drawCatalog();
  updateUI();
})();
