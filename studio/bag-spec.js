/**
 * RAWNAK FIT — Bag Parts Specification, v0.1.
 * All dimensions here are measured merchant inputs in centimeters.
 * Images are evidence, not a source of exact unseen geometry or cloth physics.
 * Parts and joints define what may move; physical simulation is a later gate.
 */
export const BAG_STYLES = Object.freeze({
  structured: { name: 'Structured / Satchel', shape: 'tailored', family: 'structured' },
  tote: { name: 'Tote / Shopper', shape: 'tapered', family: 'structured' },
  baguette: { name: 'Baguette / Shoulder', shape: 'wide', family: 'structured' },
  hobo: { name: 'Hobo / Crescent', shape: 'soft-curve', family: 'soft' },
  bucket: { name: 'Bucket / Drawstring', shape: 'bucket', family: 'soft' },
  clutch: { name: 'Clutch / Pouch', shape: 'compact', family: 'structured' },
  backpack: { name: 'Mini Backpack', shape: 'domed', family: 'structured' },
  saddle: { name: 'Saddle / Rounded', shape: 'curve', family: 'structured' },
});
export const BAG_MATERIALS = Object.freeze({
  leather: { name: 'جلد طبيعي', behavior: 'semi-rigid', roughness: 0.76 },
  faux_leather: { name: 'جلد صناعي', behavior: 'semi-rigid', roughness: 0.79 },
  canvas: { name: 'قماش Canvas', behavior: 'flexible', roughness: 0.94 },
  suede: { name: 'شمواه', behavior: 'flexible', roughness: 0.95 },
  nylon: { name: 'نايلون', behavior: 'flexible', roughness: 0.61 },
  woven: { name: 'خوص/منسوج', behavior: 'semi-rigid', roughness: 0.9 },
  rigid_case: { name: 'جسم صلب', behavior: 'rigid', roughness: 0.67 },
});
export const BAG_CLOSURES = Object.freeze({
  zipper: { name: 'سوستة', mechanism: 'slider' },
  flap: { name: 'غطاء مفصلي', mechanism: 'hinge' },
  magnetic: { name: 'مغناطيس/كبّاس', mechanism: 'snap' },
  drawstring: { name: 'رباط شد', mechanism: 'pull' },
  open: { name: 'مفتوحة', mechanism: 'none' },
  clasp: { name: 'قفل معدني', mechanism: 'hinge' },
  buckle: { name: 'إبزيم', mechanism: 'hinge' },
  button: { name: 'زر', mechanism: 'snap' },
});
export const VIEW_LABELS = Object.freeze({
  front: 'الأمام',
  back: 'الخلف',
  left: 'الجانب الأيسر',
  right: 'الجانب الأيمن',
  bottom: 'القاعدة',
  top: 'الأعلى/فتحة الشنطة',
  open: 'وهي مفتوحة',
  inside: 'التقسيم الداخلي',
  pockets: 'الجيوب من الداخل',
  strap: 'الحزام/اليد',
  closure: 'القفل أو السوستة',
  logo: 'صورة الشعار/اللوجو',
  detail: 'تفاصيل/خياطة',
  outer: 'الجيوب الخارجية',
  handles: 'الأيدي',
  compartments: 'الفواصل',
  material: 'عينة لون وخامة',
  normal: 'خريطة السطح',
  roughness: 'خريطة الخشونة',
  metalness: 'خريطة المعدن',
  ao: 'خريطة الظلال',
});
const defaults = Object.freeze({
  widthCm: 28,
  heightCm: 20,
  depthCm: 11,
  style: 'structured',
  material: 'faux_leather',
  closure: 'flap',
  strapType: 'shoulder',
  strapCount: 1,
  strapLengthCm: 82,
  strapWidthCm: 2.4,
  handlesCount: 1,
  flexibility: 30,
  mainCompartments: 2,
  innerOpenPockets: 1,
  innerZippedPockets: 1,
  outerPockets: 0,
  lining: 'polyester',
  logoPlacement: 'front',
  logoType: 'print',
  logoText: '',
  bodyColor: '#996247',
  metalColor: '#d9be80',
  panelThicknessMm: 2.2,
  roundness: 50,
  gussetWidth: 100,
  sideTaper: 0,
  openingScale: 100,
  baseCurve: 50,
  handleDropCm: 9,
  flapLength: 42,
  cardSlots: 0,
  accessoryPockets: 0,
  reinforced: true,
  detachable: true,
  adjustable: true,
  brandLicenseConfirmed: false,
});
const inRange = (v, min, max) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;
const bounded = (v, min, max, fallback) => (inRange(v, min, max) ? Number(v) : fallback);
const select = (value, list, fallback) => (Object.hasOwn(list, value) ? value : fallback);
const yes = (v) => v === true;
const color = (v, fallback) => (/^#[a-f\d]{6}$/i.test(String(v || '')) ? v : fallback);
const BOUNDS = Object.freeze({
  widthCm: [8, 85],
  heightCm: [6, 70],
  depthCm: [2, 45],
  panelThicknessMm: [0.5, 6],
  roundness: [0, 100],
  gussetWidth: [45, 100],
  sideTaper: [-60, 60],
  openingScale: [55, 100],
  baseCurve: [0, 90],
  handleDropCm: [2, 40],
  flapLength: [15, 70],
  cardSlots: [0, 5],
  accessoryPockets: [0, 3],
  strapCount: [0, 2],
  strapLengthCm: [0, 210],
  strapWidthCm: [0.4, 12],
  handlesCount: [0, 2],
  flexibility: [0, 100],
  mainCompartments: [1, 5],
  innerOpenPockets: [0, 8],
  innerZippedPockets: [0, 8],
  outerPockets: [0, 8],
});
export const DEFAULT_BAG_SPEC = defaults;
export function createBagSpec(patch = {}) {
  const x = { ...defaults };
  for (const [key, [min, max]] of Object.entries(BOUNDS))
    x[key] = bounded(patch[key], min, max, defaults[key]);
  x.strapCount = Math.round(x.strapCount);
  x.handlesCount = Math.round(x.handlesCount);
  x.mainCompartments = Math.round(x.mainCompartments);
  for (const k of [
    'innerOpenPockets',
    'innerZippedPockets',
    'outerPockets',
    'cardSlots',
    'accessoryPockets',
  ])
    x[k] = Math.round(x[k]);
  x.style = select(patch.style, BAG_STYLES, defaults.style);
  x.material = select(patch.material, BAG_MATERIALS, defaults.material);
  x.closure = select(patch.closure, BAG_CLOSURES, defaults.closure);
  x.strapType = ['shoulder', 'crossbody', 'hand', 'none', 'backpack'].includes(patch.strapType)
    ? patch.strapType
    : defaults.strapType;
  x.lining = ['polyester', 'cotton', 'leather', 'none'].includes(patch.lining)
    ? patch.lining
    : defaults.lining;
  x.logoPlacement = ['front', 'back', 'inside', 'none'].includes(patch.logoPlacement)
    ? patch.logoPlacement
    : defaults.logoPlacement;
  x.logoType = ['print', 'embossed', 'debossed', 'metal', 'patch', 'none'].includes(patch.logoType)
    ? patch.logoType
    : defaults.logoType;
  x.logoText = String(patch.logoText || '').slice(0, 100);
  x.bodyColor = color(patch.bodyColor, defaults.bodyColor);
  x.metalColor = color(patch.metalColor, defaults.metalColor);
  for (const key of ['reinforced', 'detachable', 'adjustable'])
    x[key] = typeof patch[key] === 'boolean' ? patch[key] : defaults[key];
  x.brandLicenseConfirmed = yes(patch.brandLicenseConfirmed);
  // Crossbody is a carrying mode, not a unique geometric body.
  if (x.strapType === 'none') x.strapCount = 0;
  return x;
}
export function requiredBagViews(specInput = {}) {
  const s = createBagSpec(specInput);
  const required = ['front', 'back', 'left', 'right', 'bottom', 'top', 'open', 'inside'];
  if (s.innerOpenPockets + s.innerZippedPockets + s.outerPockets > 0) required.push('pockets');
  if (s.strapCount > 0 || s.handlesCount > 0) required.push('strap');
  if (s.closure !== 'open') required.push('closure');
  if (s.logoPlacement !== 'none' && s.logoType !== 'none') required.push('logo');
  if (s.outerPockets) required.push('outer');
  if (s.handlesCount) required.push('handles');
  if (s.mainCompartments > 1) required.push('compartments');
  if (s.cardSlots + s.accessoryPockets > 0 && !required.includes('pockets'))
    required.push('pockets');
  return required;
}
export function detectViewFromName(name) {
  const str = String(name || '');
  const patterns = {
    outer: /(?:outer.?pocket|external.?pocket|جيب خارجي)/i,
    handles: /(?:handles?|مقبض)/i,
    compartments: /(?:compartments?|divider|فواصل)/i,
    material: /(?:swatch|material|خامة)/i,
    front: /(?:front|واجهة|امام|أمام)/i,
    back: /(?:back|rear|خلف|ظهر)/i,
    left: /(?:left|يسار|شمال)/i,
    right: /(?:right|يمين)/i,
    bottom: /(?:bottom|under|قاعد|اسفل|أسفل)/i,
    top: /(?:top|opening|اعلى|أعلى|فوق)/i,
    open: /(?:open|opened|مفتوح)/i,
    inside: /(?:interior|inside|lining|داخل|بطان)/i,
    pockets: /(?:pockets?|جيوب|جيب)/i,
    strap: /(?:strap|handle|حزام|سير|يد)/i,
    closure: /(?:zipper|zip|clasp|closure|قفل|سوست|مشبك)/i,
    logo: /(?:brand|logo|شعار|لوجو)/i,
    detail: /(?:details?|seam|stitch|تفاصيل|خياط)/i,
  };
  for (const view of [
    'logo',
    'outer',
    'handles',
    'compartments',
    'material',
    'pockets',
    'inside',
    'open',
    'closure',
    'strap',
    'bottom',
    'top',
    'front',
    'back',
    'left',
    'right',
    'detail',
  ]) {
    if (patterns[view].test(str)) return { view, confidence: 'low', source: 'filename' };
  }
  return { view: 'unknown', confidence: 'none', source: 'unresolved' };
}
export function describeBagComponents(specInput = {}) {
  const s = createBagSpec(specInput),
    skin = BAG_MATERIALS[s.material].behavior,
    parts = [];
  const add = (
    id,
    role,
    parent,
    requires,
    material = s.material,
    behavior = skin,
    joint = null,
  ) => {
    parts.push({
      id,
      role,
      type: role,
      parent,
      requires,
      material,
      behavior,
      moving: Boolean(joint),
      joint,
      verifiedFromPhotos: false,
    });
  };
  add('body', 'assembly', null, []);
  for (const [id, role, view] of [
    ['front_panel', 'panel', 'front'],
    ['back_panel', 'panel', 'back'],
    ['left_gusset', 'side', 'left'],
    ['right_gusset', 'side', 'right'],
    ['bottom_panel', 'bottom', 'bottom'],
  ])
    add(id, role, 'body', [view]);
  add('opening', 'opening', 'body', ['top', 'open']);
  add('piping', 'piping', 'body', ['front', 'back', 'detail']);
  for (const [id, views] of [
    ['front_left', ['front', 'left']],
    ['front_right', ['front', 'right']],
    ['back_right', ['back', 'right']],
    ['back_left', ['back', 'left']],
  ])
    add('seam_' + id, 'seam', 'piping', [...views, 'detail']);
  if (s.reinforced) add('base_insert', 'reinforcement', 'bottom_panel', ['bottom', 'inside']);
  if (s.lining !== 'none') add('lining', 'interior', 'body', ['inside'], s.lining, 'flexible');
  const interior = s.lining === 'none' ? 'body' : 'lining';
  for (let i = 1; i <= s.mainCompartments; i++) {
    add('compartment_' + i, 'compartment', interior, ['inside', 'compartments'], 'air', 'fixed');
    if (i < s.mainCompartments)
      add(
        'divider_' + i,
        'interior_partition',
        interior,
        ['inside', 'compartments'],
        s.lining === 'none' ? s.material : s.lining,
        'flexible',
      );
  }
  for (const [prefix, count, role, view] of [
    ['inner_open_pocket', s.innerOpenPockets, 'open_pocket', 'pockets'],
    ['inner_zip_pocket', s.innerZippedPockets, 'zip_pocket', 'pockets'],
    ['outer_pocket', s.outerPockets, 'outer_pocket', 'outer'],
    ['card_slot', s.cardSlots, 'card_slot', 'pockets'],
    ['accessory', s.accessoryPockets, 'accessory_pocket', 'pockets'],
  ]) {
    for (let i = 1; i <= count; i++) {
      const id = prefix + '_' + i,
        outside = role === 'outer_pocket';
      add(
        id,
        role,
        outside ? 'front_panel' : interior,
        [view],
        outside ? s.material : s.lining === 'none' ? s.material : s.lining,
        'flexible',
      );
      if (role === 'zip_pocket')
        add(id + '_slider', 'pocket_slider', id, ['pockets'], 'hardware', 'rigid', 'slider');
    }
  }
  for (const [prefix, count] of [
    ['strap', s.strapCount],
    ['handle', s.handlesCount],
  ]) {
    for (let i = 1; i <= count; i++) {
      const id = prefix + '_' + i;
      const mount =
        prefix === 'handle' && count === 1 && ['flap', 'clasp', 'buckle'].includes(s.closure)
          ? 'closure'
          : 'body';
      for (const side of ['a', 'b']) {
        add(id + '_tab_' + side, 'attachment_loop', mount, ['strap']);
        add(id + '_ring_' + side, 'ring', id + '_tab_' + side, ['strap'], 'hardware', 'rigid');
      }
      add(
        id,
        prefix,
        mount,
        prefix === 'handle' ? ['strap', 'handles'] : ['strap'],
        s.material,
        prefix === 'strap' ? 'flexible' : 'semi-rigid',
        prefix + '_anchor',
      );
      if (prefix === 'strap' && s.adjustable)
        add(id + '_buckle', 'adjuster', id, ['strap'], 'hardware', 'rigid');
      if (prefix === 'strap' && s.detachable)
        add(id + '_clips', 'connector', id, ['strap'], 'hardware', 'rigid');
    }
  }
  if (s.closure !== 'open')
    add(
      'closure',
      s.closure,
      'opening',
      ['closure', 'open'],
      s.closure === 'zipper' ? 'hardware' : s.material,
      'rigid',
      BAG_CLOSURES[s.closure].mechanism,
    );
  if (s.closure === 'zipper')
    add('zip_slider', 'closure_slider', 'closure', ['closure'], 'hardware', 'rigid', 'slider');
  if (s.logoPlacement !== 'none' && s.logoType !== 'none')
    add(
      'brand_mark',
      'logo',
      s.logoPlacement === 'back'
        ? 'back_panel'
        : s.logoPlacement === 'inside'
          ? interior
          : 'front_panel',
      ['logo'],
      s.logoType,
      'surface-attached',
    );
  return parts;
}
export function evaluateBagCapture(specInput = {}, images = []) {
  const spec = createBagSpec(specInput);
  const required = requiredBagViews(spec);
  const records = Array.isArray(images) ? images : [];
  const present = new Set(
    records.filter((v) => Object.hasOwn(VIEW_LABELS, v.view)).map((v) => v.view),
  );
  const missing = required.filter((v) => !present.has(v));
  const geometryViews = ['front', 'back', 'left', 'right', 'bottom', 'top', 'inside'];
  const accuracyLimitations = [];
  if (missing.some((x) => geometryViews.includes(x)))
    accuracyLimitations.push('أجزاء هندسية غير مرئية، لا يمكن اعتماد أبعادها أو شكلها تلقائيًا');
  if (!present.has('open')) accuracyLimitations.push('لا يوجد مرجع يوضح حركة الفتح والقفل');
  if (missing.includes('pockets'))
    accuracyLimitations.push('الجيوب أو تقسيم الداخل غير موثق بالصور');
  if (missing.includes('logo')) accuracyLimitations.push('صورة الشعار غير موجودة أو غير محددة');
  const completeness = Math.round((100 * (required.length - missing.length)) / required.length);
  return {
    viewsRequired: required,
    viewsMissing: missing,
    completeness,
    photosReceived: records.length,
    geometryVerified: false,
    logoVerified: false,
    compartmentsVerified: false,
    mechanicsVerified: false,
    realSizeGuaranteed: false,
    automatedReconstructionConnected: false,
    previewReady: missing.length === 0,
    accuracyLimitations,
    unobservedParts: describeBagComponents(spec)
      .filter((p) => p.requires?.some((k) => !present.has(k)))
      .map((p) => p.id),
  };
}
export function makeBagDraft(specInput = {}, images = []) {
  const spec = createBagSpec(specInput),
    report = evaluateBagCapture(spec, images);
  return {
    schemaVersion: 2,
    kind: 'rawnak-modular-bag',
    units: 'cm',
    spec,
    parts: describeBagComponents(spec),
    capture: report,
    images: (Array.isArray(images) ? images : []).map((p) => ({
      name: String(p.name || '').slice(0, 140),
      view: p.view || 'unknown',
      width: Number(p.width) || 0,
      height: Number(p.height) || 0,
      bytes: Number(p.bytes) || 0,
    })),
    output: {
      generatedGeometry: 'parametric-preview-only',
      photoTo3DFaithful: false,
      articulatedParts: true,
      physicalSimulation: false,
      insideMode: 'bounded-parametric-cavity',
      brandImageEmbedded: false,
      commerciallyApproved: false,
      retailARReady: false,
    },
    provenance: {
      merchantMeasurementsProvided: true,
      photoClaimsUnverified: true,
      inferenceMayBeWrong: true,
    },
  };
}
