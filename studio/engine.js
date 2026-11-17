// RAWNAK AutoFit Studio — local-first product asset router.
// This file deliberately does not claim photorealistic image-to-3D reconstruction.
export const CATEGORIES = Object.freeze({
  watch: { label: 'ساعة', icon: '⌚', engine: 'parametric-watch', editable: true, unit: 'mm', defaultSize: 42, field: 'قطر جسم الساعة' },
  ring: { label: 'خاتم', icon: '💍', engine: 'parametric-ring', editable: true, unit: 'mm', defaultSize: 18, field: 'القطر الداخلي' },
  bangle: { label: 'غويشة / أسورة', icon: '◯', engine: 'parametric-bangle', editable: true, unit: 'mm', defaultSize: 62, field: 'القطر الداخلي' },
  glasses: { label: 'نظارة', icon: '◉', engine: 'parametric-glasses', editable: false, unit: 'mm', defaultSize: 140, field: 'عرض الإطار' },
  earrings: { label: 'حلق', icon: '✦', engine: 'earring-3d', editable: false, unit: 'mm', defaultSize: 30, field: 'الطول' },
  bag: { label: 'شنطة', icon: '▣', engine: 'bag-image-to-3d', editable: false, unit: 'cm', defaultSize: 30, field: 'العرض' },
  shoes: { label: 'حذاء', icon: '⌁', engine: 'shoe-image-to-3d', editable: false, unit: 'cm', defaultSize: 27, field: 'طول النعل' },
  tshirt: { label: 'تيشيرت', icon: '▥', engine: 'garment-pattern', editable: false, unit: 'cm', defaultSize: 50, field: 'عرض الصدر' },
  hoodie: { label: 'هودي', icon: '▧', engine: 'garment-pattern', editable: false, unit: 'cm', defaultSize: 56, field: 'عرض الصدر' },
  jacket: { label: 'جاكيت', icon: '▤', engine: 'garment-pattern', editable: false, unit: 'cm', defaultSize: 54, field: 'عرض الصدر' },
  dress: { label: 'فستان', icon: '♢', engine: 'garment-pattern', editable: false, unit: 'cm', defaultSize: 45, field: 'عرض الصدر' },
  unknown: { label: 'غير محدد', icon: '?', engine: 'needs-categorization', editable: false, unit: 'cm', defaultSize: 0, field: 'القياس' }
});

const KEYWORDS = [
  ['watch', /(?:watch|wristwatch|timepiece|chronograph|wrist watch|ساعة|ساعه)/i],
  ['ring', /(?:^ring| rings?|خاتم|خواتم|دبلة|دبله)/i],
  ['bangle', /(?:bracelet|bangle|cuff|غويش|اسور|إسوار|أسوار)/i],
  ['glasses', /(?:sunglasses|eyeglasses|spectacles|glasses|نظارة|نظاره|نظارات)/i],
  ['earrings', /(?:earring|earstud|حلق|اقراط|أقراط)/i],
  ['bag', /(?:handbag|backpack|purse|tote bag|shoulder bag|bag|شنط|حقيبة|حقيبه)/i],
  ['shoes', /(?:sneaker|shoe|footwear|boot|loafer|sandal|حذاء|جزمة|جزمه|كوتشي)/i],
  ['hoodie', /(?:hoodie|hooded sweatshirt|هودي|سويت شيرت)/i],
  ['jacket', /(?:jacket|blazer|coat|جاكيت|بليزر|معطف)/i],
  ['dress', /(?:dress|gown|فستان|فساتين)/i],
  ['tshirt', /(?:t[\s-]?shirt|tee|shirt|jersey|تيشيرت|تي شيرت|قميص)/i]
];

const MODEL_KEYWORDS = [
  ['watch', /(?:analog clock|digital watch|wristwatch)/i],
  ['ring', /(?:ring|jewelry|jewellery)/i],
  ['bangle', /(?:bracelet|bangle)/i],
  ['glasses', /(?:sunglasses|spectacles)/i],
  ['earrings', /(?:earring)/i],
  ['bag', /(?:handbag|purse|backpack|shopping bag)/i],
  ['shoes', /(?:running shoe|sneaker|loafer|sandal|boot|shoe)/i],
  ['hoodie', /(?:hoodie|sweatshirt)/i],
  ['jacket', /(?:coat|jacket)/i],
  ['dress', /(?:gown|dress)/i],
  ['tshirt', /(?:jersey|t-shirt|shirt)/i]
];
export const isCategory = (id) => Object.prototype.hasOwnProperty.call(CATEGORIES, id);
export const normalizeCategory = (id) => isCategory(id) ? id : 'unknown';

export function classifyProduct(name = '', predictions = []) {
  const text = String(name || '').trim();
  const nameHit = KEYWORDS.find(([, regex]) => regex.test(text));
  const ranked = [...predictions]
    .map((entry) => ({ className: String(entry.className ?? ''), probability: Number(entry.probability) || 0 }))
    .sort((a, b) => b.probability - a.probability);
  const mapped = ranked.flatMap((item) => {
    const matching = MODEL_KEYWORDS.find(([, regex]) => regex.test(item.className));
    return matching ? [{ category: matching[0], confidence: item.probability, label: item.className }] : [];
  });
  // MobileNet is ImageNet-specific. Never present a prediction as certain.
  const modelHit = mapped[0] && mapped[0].confidence >= 0.20 ? mapped[0] : null;
  if (modelHit) {
    // When filename and image disagree, request human confirmation instead of asserting.
    const conflict = Boolean(nameHit && nameHit[0] !== modelHit.category);
    return { category: conflict ? nameHit[0] : modelHit.category, method: conflict ? 'conflict' : 'vision', confidence: modelHit.confidence, modelLabel: modelHit.label, requiresReview: conflict || modelHit.confidence < 0.50 };
  }
  if (nameHit) return { category: nameHit[0], method: 'filename', confidence: null, modelLabel: '', requiresReview: true };
  return { category: 'unknown', method: 'unresolved', confidence: null, modelLabel: '', requiresReview: true };
}

export function dominantProductColor(data, width, height) {
  if (!data || !width || !height) return '#c2d9b0';
  const counts = new Map();
  const stride = Math.max(1, Math.floor(Math.sqrt(width * height / 2500)));
  for (let y = Math.floor(height * 0.12); y < height * 0.88; y += stride) {
    for (let x = Math.floor(width * 0.12); x < width * 0.88; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 180) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 235 && g > 235 && b > 235) continue;
      if (r < 24 && g < 24 && b < 24) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      if (max - min < 12 && max > 190) continue;
      const qr = Math.floor(r / 32), qg = Math.floor(g / 32), qb = Math.floor(b / 32);
      const key = [qr, qg, qb].join(',');
      const centerWeight = x > width * 0.28 && x < width * 0.72 && y > height * 0.25 && y < height * 0.76 ? 2 : 1;
      const weight = centerWeight * (1 + (max - min) / 255);
      counts.set(key, (counts.get(key) || 0) + weight);
    }
  }
  const winner = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!winner) return '#c2d9b0';
  return '#' + winner[0].split(',').map(x => Math.min(255, Number(x) * 32 + 16).toString(16).padStart(2, '0')).join('');
}

export function planProduct({ category = 'unknown', measurement, photos = 0, categorySource = 'unresolved' } = {}) {
  const id = normalizeCategory(category);
  const item = CATEGORIES[id];
  const value = Number(measurement);
  const scaled = Number.isFinite(value) && value > 0 && value <= 999;
  const requirements = [];
  if (id === 'unknown') requirements.push('اختار نوع المنتج أولًا');
  if (!photos) requirements.push('ارفع صورة واحدة على الأقل');
  if (!scaled && id !== 'unknown') requirements.push('أدخل مقاس المنتج الحقيقي');
  if (!item.editable) {
    requirements.push(id === 'bag' || id === 'shoes'
      ? 'إضافة محرك إعادة بناء 3D وتأكيد الجوانب غير المصورة'
      : id === 'glasses' || id === 'earrings'
        ? 'تجهيز قالب/مجسم مناسب وتأكيد نقاط التثبيت'
        : 'بناء قالب قصّة قابل للحركة ومراجعة تفاصيل الظهر والخامة');
  }
  if (categorySource === 'conflict') requirements.push('تأكيد التصنيف بعد اختلاف الاسم وتوقعات الصورة');
  const canBuild = item.editable && scaled && photos > 0;
  return {
    engine: item.engine,
    canBuild,
    assetType: canBuild ? 'editable-parametric-template' : 'requires-specialized-engine',
    status: canBuild ? 'preview-ready' : 'needs-review',
    requirements,
    fidelity: 'illustrative-only',
    verified360: false
  };
}

export function createRecord({ name, sku, category, measurement, photos, categorySource, color }) {
  const normalized = normalizeCategory(category);
  const size = Number(measurement);
  if (!String(name || '').trim()) throw new Error('اسم المنتج مطلوب');
  if (!String(sku || '').trim()) throw new Error('رمز SKU مطلوب');
  if (!/^[#][0-9A-Fa-f]{6}$/.test(color || '')) throw new Error('اللون غير صالح');
  if (!Number.isFinite(size) || size <= 0 || size > 999) throw new Error('القياس غير صالح');
  const plan = planProduct({ category: normalized, measurement: size, photos, categorySource });
  return {
    schemaVersion: 1, productName: String(name).trim(), sku: String(sku).trim(),
    category: normalized, engine: plan.engine, measuredSize: size,
    measuredUnit: CATEGORIES[normalized].unit, color, photosCount: photos,
    source: categorySource || 'manual', status: plan.status, fidelity: plan.fidelity,
    verified360: false, assetType: plan.assetType, requirements: plan.requirements,
    generatedAt: new Date().toISOString()
  };
}
