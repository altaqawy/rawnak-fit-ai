import {
  createBagSpec,
  describeBagComponents,
  requiredBagViews,
  evaluateBagCapture,
  detectViewFromName,
} from './bag-spec.js';
import { FAMILY_PRESETS } from './bag-patterns.js';
import {
  newProject,
  EditHistory,
  changeStructure,
  correctPart,
  editLimits,
  approveProject,
  interpretCommand,
} from './bag-editor.js';
import {
  fitFromEvidence,
  reconstructDraft,
  readLocalPhoto,
  sourceMetadata,
  STAGES,
} from './bag-evidence.js';
import {
  steps,
  families,
  views,
  cameras,
  fields,
  roles,
  editLabels,
  behaviors,
  commands,
} from './bag-fields.js';

const $ = (id) => document.getElementById(id);
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const stored = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k, v) => {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
};
let lang = stored('bag-language') === 'en' ? 'en' : 'ar',
  theme = stored('bag-theme') === 'dark' ? 'dark' : 'light';
const tr = (ar, en) => (lang === 'ar' ? ar : en);
const label = (pair) => (pair ? tr(...pair) : '');
let history = new EditHistory(newProject(FAMILY_PRESETS.structured));
const current = () => history.present;
let photos = [],
  selection = 'front_panel',
  step = 0,
  version = 0,
  photoEpoch = 0,
  viewer = null,
  viewerModule = null,
  model = null;
let reconstruction = null;
let dirtyFields = new Set(),
  rebuildTimer = 0,
  busy = false,
  uploadQueue = Promise.resolve();
const note = (ar, en) => {
  $('notice').textContent = tr(ar, en);
};
const native = new Map([...document.querySelectorAll('[data-en]')].map((n) => [n, n.textContent]));
const setOptions = (select, dict, value) => {
  select.replaceChildren(...Object.entries(dict).map(([k, word]) => new Option(label(word), k)));
  if (value !== undefined) select.value = value;
};
function pretty(p) {
  const title = label(roles[p.id] || roles[p.role]) || p.id;
  if (roles[p.id]) return title;
  const number = p.id.match(/\d+/)?.[0] || '';
  const suffix = p.id.endsWith('_a') ? ' A' : p.id.endsWith('_b') ? ' B' : '';
  const family =
    p.id.startsWith('handle_') && p.role !== 'handle'
      ? label(roles.handle) + ' '
      : p.id.startsWith('strap_') && p.role !== 'strap'
        ? label(roles.strap) + ' '
        : '';
  return family + title + ' ' + number + suffix;
}
function formFields() {
  const spec = current().spec;
  setOptions($('style'), families, spec.style);
  for (const [container, definitions] of Object.entries(fields)) {
    const host = $(container);
    host.replaceChildren();
    for (const [key, ar, en, kind, max, stepSize] of definitions) {
      const l = el('label'),
        name = el('span', tr(ar, en)),
        input = el(typeof kind === 'object' ? 'select' : 'input');
      input.id = key;
      if (typeof kind === 'object') setOptions(input, kind, spec[key]);
      else if (kind === 'check') {
        input.type = 'checkbox';
        input.checked = spec[key];
        l.className = 'check wide';
      } else {
        input.type = typeof kind === 'number' ? 'number' : kind;
        if (typeof kind === 'number') {
          input.min = kind;
          input.max = max;
          input.step = stepSize;
          input.inputMode = 'decimal';
        }
        if (kind === 'text') input.maxLength = 100;
        input.value = spec[key];
      }
      if (kind === 'check') l.append(input, name);
      else l.append(name, input);
      host.append(l);
      input.addEventListener('change', () => {
        if (!input.checkValidity() || (input.type === 'number' && input.value === '')) {
          input.reportValidity();
          input.value = current().spec[key];
          return;
        }
        apply(
          changeStructure(
            current(),
            { [key]: kind === 'check' ? input.checked : input.value },
            references().map((r) => r.id),
          ),
          true,
        );
      });
    }
  }
}
function references() {
  return photos.filter((p) => p.url).map(sourceMetadata);
}
function syncInputs() {
  const s = current().spec;
  $('style').value = s.style;
  for (const defs of Object.values(fields))
    for (const [key] of defs) {
      const input = $(key);
      if (input.type === 'checkbox') input.checked = s[key];
      else input.value = s[key];
    }
  $('family-name').textContent = label(families[s.style]);
  $('measure-summary').textContent = [s.widthCm, s.heightCm, s.depthCm].join(' × ') + ' cm';
}
function setStep(i) {
  if (i < 0 || i > 4) return;
  step = i;
  document.querySelectorAll('.page').forEach((n) => {
    n.hidden = Number(n.dataset.page) !== i;
  });
  [...$('steps').children].forEach((b, j) => {
    if (i === j) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  $('step-count').textContent = String(i + 1).padStart(2, '0') + ' / 05';
  $('next').hidden = i === 4;
  $('next').textContent =
    i === 2
      ? tr('ابدأ المراجعة', 'Start review')
      : tr('التالي', 'Continue') + ' · ' + label(steps[Math.min(4, i + 1)]);
  if (i !== 3) viewer?.highlight(null);
  else showEditor();
  updateComparison(i === 3);
  renderReports();
}
function translate() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = theme;
  for (const [n, ar] of native) n.textContent = tr(ar, n.dataset.en);
  $('language').textContent = tr('English', 'العربية');
  $('theme').textContent =
    theme === 'dark' ? tr('الوضع الفاتح', 'Light mode') : tr('الوضع الداكن', 'Dark mode');
  $('steps').replaceChildren(
    ...steps.map((name, i) => {
      const b = el('button');
      b.append(el('i', '0' + (i + 1)), el('span', label(name)));
      b.onclick = () => setStep(i);
      return b;
    }),
  );
  $('commands').replaceChildren(...commands.map((c) => new Option(label(c), label(c))));
  setOptions($('camera'), cameras, viewer?.view || 'orbit');
  formFields();
  syncInputs();
  renderPhotos();
  showEditor();
  setStep(step);
  status();
}
function status() {
  $('model-status').textContent = model
    ? tr('مجسم بارامتري', 'Parametric model') +
      ' · ' +
      tr('مراجعة التاجر', 'Merchant review') +
      ' ' +
      (current().approval === 'merchant-reviewed'
        ? tr('مكتملة', 'complete')
        : tr('مطلوبة', 'pending'))
    : tr('جارٍ تجهيز المجسم', 'Preparing model');
}
function results() {
  return fitFromEvidence(references());
}
function fitMessage(result) {
  return result.status === 'inconsistent-views'
    ? tr(
        'حدود الصور الأمامية والخلفية مختلفة. راجع زاوية التصوير.',
        'Front and back outlines disagree. Check the assigned views.',
      )
    : result.fit
      ? tr('حدود صالحة للملاءمة من', 'Usable outline from') +
        ' ' +
        result.fit.sources.length +
        ' ' +
        tr('صورة', 'view(s)')
      : tr(
          'تحتاج الملاءمة صورة أمامية أو خلفية مؤكدة بخلفية بسيطة أو شفافة.',
          'Fitting needs a confirmed front or back view on a plain or transparent background.',
        );
}
function renderReports() {
  const spec = current().spec,
    required = requiredBagViews(spec),
    refs = references(),
    report = evaluateBagCapture(spec, refs);
  $('photo-progress').textContent =
    required.length - report.viewsMissing.length + ' / ' + required.length;
  $('photo-requirements').replaceChildren(
    ...required.map((id) => {
      const ok = !report.viewsMissing.includes(id),
        n = el('span', (ok ? '✓ ' : '○ ') + label(views[id]));
      if (ok) n.className = 'ok';
      return n;
    }),
  );
  const result = results();
  $('construction-report').textContent = [
    label(families[spec.style]) + ' · ' + tr('باترون بحسب المقاسات', 'Measured pattern'),
    spec.mainCompartments +
      ' ' +
      tr('أقسام داخلية بحسب الوصف', 'compartment(s) from the specification'),
    fitMessage(result),
    tr(
      'التعرف الآلي على الجيوب والتقفيل الداخلي غير متاح.',
      'Automatic pocket and interior identification is unavailable.',
    ),
  ].join('\n');
  $('use-color').hidden = !result.color;
  const feedback = current().feedback.filter((f) => f.approval === 'merchant-approved').length;
  const unlinked = photos.filter((p) => !p.url).length;
  $('capture-status').textContent = [
    tr('تغطية المراجع', 'Reference coverage') + ' ' + $('photo-progress').textContent,
    tr('تصحيحات معتمدة', 'Approved corrections') + ' · ' + feedback,
    unlinked ? tr('صور تحتاج إعادة ربط', 'Photos to reattach') + ' · ' + unlinked : '',
    tr(
      'دقة المنتج وتجربة الارتداء التجارية لم تُتحقّق.',
      'Product fidelity and retail try-on remain unverified.',
    ),
  ]
    .filter(Boolean)
    .join('\n');
  $('approve').disabled = current().approval === 'merchant-reviewed';
  $('undo').disabled = !history.past.length;
  $('redo').disabled = !history.future.length;
  status();
}
function changedReferences() {
  reconstruction = null;
  const p = current(),
    fit = p.fit;
  const valid = fit?.sources.every((id) =>
    photos.some(
      (img) => img.id === id && ['front', 'back'].includes(img.view) && img.source === 'merchant',
    ),
  );
  // Reference assignments are outside parameter history. A removed source
  // invalidates its fit in every history frame, including after Undo.
  const clean = (item) => ({
    ...item,
    fit: item.fit?.sources.every((id) =>
      photos.some(
        (img) => img.id === id && ['front', 'back'].includes(img.view) && img.source === 'merchant',
      ),
    )
      ? item.fit
      : null,
    approval: 'unreviewed',
  });
  history.present = { ...p, fit: valid ? fit : null, approval: 'unreviewed' };
  history.past = history.past.map(clean);
  history.future = [];
  renderPhotos();
  showEditor();
  schedule();
}
function renderPhotos() {
  $('photos-list').replaceChildren(
    ...photos.map((p) => {
      const row = el('div');
      row.className = 'photo-row';
      const img = p.url ? el('img') : el('small', tr('أعد الربط', 'Relink'));
      if (p.url) {
        img.src = p.url;
        img.alt = '';
        img.loading = 'lazy';
      }
      const info = el('div'),
        select = el('select');
      setOptions(select, views, p.view);
      select.setAttribute('aria-label', tr('زاوية ', 'View for ') + p.name);
      select.onchange = () => {
        p.view = select.value;
        p.source = 'merchant';
        changedReferences();
      };
      const assigned = p.source === 'merchant';
      const confirm = el('button', tr('تأكيد الزاوية', 'Confirm view'));
      confirm.hidden = assigned || p.view === 'unknown';
      confirm.onclick = () => {
        p.source = 'merchant';
        changedReferences();
      };
      info.append(
        el('strong', p.name),
        select,
        confirm,
        el(
          'small',
          !p.url
            ? tr('اختار الملف الأصلي', 'Choose the original file')
            : !assigned
              ? tr('اقتراح من اسم الملف', 'Filename hint')
              : p.analysis?.status === 'candidate'
                ? tr('حدود مرشحة · زاوية مؤكدة', 'Outline candidate · assigned view')
                : tr('مرجع بصري · زاوية مؤكدة', 'Visual reference · assigned view'),
        ),
      );
      const remove = el('button', '×');
      remove.setAttribute('aria-label', tr('احذف ', 'Remove ') + p.name);
      remove.onclick = () => {
        if (p.url) URL.revokeObjectURL(p.url);
        photos = photos.filter((f) => f !== p);
        changedReferences();
      };
      row.append(img, info, remove);
      return row;
    }),
  );
  $('remove-photos').disabled = !photos.length;
  renderReports();
  updateComparison(false);
}
async function addPhotos(files, epoch) {
  let skipped = 0,
    added = 0,
    fresh = false;
  for (const f of files) {
    if (epoch !== photoEpoch) return;
    try {
      const info = await readLocalPhoto(f);
      if (epoch !== photoEpoch) {
        URL.revokeObjectURL(info.url);
        return;
      }
      const old = photos.find(
        (p) => p.id === info.id || (!p.id && p.name === info.name && p.bytes === info.bytes),
      );
      if (old?.url || (!old && photos.length >= 36)) {
        URL.revokeObjectURL(info.url);
        skipped++;
        continue;
      }
      if (old) Object.assign(old, info);
      else {
        fresh = true;
        const hint = detectViewFromName(f.name);
        photos.push({ ...info, ...hint });
      }
      added++;
    } catch {
      skipped++;
    }
  }
  if (fresh) changedReferences();
  else if (added) {
    renderPhotos();
    schedule();
  }
  $('photo-quality').textContent =
    tr('مضافة', 'Added') +
    ' ' +
    added +
    ' · ' +
    tr('متجاهلة أو متكررة', 'Skipped or duplicate') +
    ' ' +
    skipped;
}
function updateComparison(align) {
  const visible = photos.filter((p) => p.url),
    select = $('compare-photo'),
    old = select.value;
  $('comparison').hidden = visible.length === 0 || ![1, 3].includes(step);
  if ($('comparison').hidden) return;
  select.replaceChildren(
    ...visible.map((p) => new Option(label(views[p.view]) + ' · ' + p.name, p.id)),
  );
  if (visible.some((p) => p.id === old)) select.value = old;
  const p = visible.find((p) => p.id === select.value) || visible[0];
  $('compare-img').src = p.url;
  $('compare-img').alt = p.name;
  const cam = cameras[p.view] ? p.view : p.view === 'open' ? 'inside' : null;
  if (align && cam) setCamera(cam);
  $('compare-note').textContent =
    label(views[p.view]) +
    ' · ' +
    (p.source === 'merchant'
      ? tr('زاوية اختارها التاجر', 'Merchant-assigned view')
      : tr('تحتاج تأكيد الزاوية', 'View awaiting confirmation'));
}
function showEditor() {
  const rows = model?.parts || describeBagComponents(current().spec);
  if (!rows.some((p) => p.id === selection)) selection = 'front_panel';
  const select = $('part-select');
  select.replaceChildren(...rows.map((p) => new Option(pretty(p), p.id)));
  select.value = selection;
  const selected = rows.find((p) => p.id === selection);
  if (!selected) return;
  const source = describeBagComponents(current().spec).find((p) => p.id === selection) || selected;
  const edits = current().edits[selection] || {},
    limits = editLimits(source);
  $('parts').replaceChildren(
    ...rows.map((p) => {
      const b = el('button', pretty(p));
      let depth = 0,
        parent = p.parent;
      while (parent && depth < 6) {
        depth++;
        parent = rows.find((x) => x.id === parent)?.parent;
      }
      b.style.paddingInlineStart = 8 + depth * 11 + 'px';
      b.setAttribute('aria-pressed', p.id === selection);
      b.onclick = () => selectPart(p.id);
      return b;
    }),
  );
  $('part-info').textContent = [
    selected.parent
      ? tr('متصل بـ ', 'Attached to ') +
        (selected.connections || [selected.parent])
          .map((id) => pretty(rows.find((p) => p.id === id) || { id }))
          .join(' · ')
      : '',
    selected.sourceEvidence?.length
      ? tr('مراجع', 'References') +
        ' · ' +
        selected.sourceEvidence.map((id) => photos.find((p) => p.id === id)?.name || id).join(', ')
      : tr('شكل مستنتج من الباترون', 'Inferred from pattern'),
    selected.range
      ? tr('حدود الحركة', 'Joint limits') +
        ' · ' +
        selected.range.min +
        ' … ' +
        selected.range.max +
        ' ' +
        (selected.range.unit === 'degrees' ? '°' : '')
      : '',
    selected.dimensions
      ? [selected.dimensions.width, selected.dimensions.height, selected.dimensions.depth]
          .map((v) => (100 * v).toFixed(1))
          .join(' × ') + ' cm'
      : '',
  ]
    .filter(Boolean)
    .join(' / ');
  const host = $('edit-fields');
  host.replaceChildren();
  dirtyFields = new Set();
  const add = (key, input) => {
    input.id = 'edit-' + key;
    input.oninput = () => dirtyFields.add(key);
    const l = el('label');
    if (input.type === 'checkbox') {
      l.className = 'check';
      l.append(input, el('span', label(editLabels[key])));
    } else l.append(el('span', label(editLabels[key])), input);
    host.append(l);
  };
  const linked =
    {
      body: ['widthCm', 'heightCm', 'depthCm'],
      front_panel: ['widthCm', 'roundness'],
      back_panel: ['widthCm', 'roundness'],
      left_gusset: ['depthCm', 'gussetWidth'],
      right_gusset: ['depthCm', 'gussetWidth'],
      bottom_panel: ['depthCm', 'baseCurve'],
      opening: ['openingScale'],
    }[selection] || [];
  for (const key of linked) {
    const def = Object.values(fields)
        .flat()
        .find((f) => f[0] === key),
      input = el('input'),
      l = el('label');
    input.type = 'number';
    input.id = 'shared-' + key;
    input.min = def[3];
    input.max = def[4];
    input.step = def[5];
    input.value = current().spec[key];
    input.oninput = () => dirtyFields.add('shared-' + key);
    l.append(el('span', tr(def[1], def[2]) + ' · ' + tr('مشترك', 'linked')), input);
    host.append(l);
  }
  for (const [key, [lo, hi]] of Object.entries(limits)) {
    const input = el('input');
    if (key === 'visible') {
      input.type = 'checkbox';
      input.checked = edits.visible !== false;
    } else {
      input.type = 'number';
      input.min = lo;
      input.max = hi;
      input.step = 'any';
      const mat = model?.groups.get(selection)?.children.find((o) => o.isMesh)?.material;
      input.value =
        edits[key] ??
        (key === 'roughness'
          ? (mat?.roughness ?? 0.65)
          : ['offsetX', 'anchorShift'].includes(key)
            ? 0
            : 1);
    }
    add(key, input);
  }
  if (source.role !== 'assembly' && source.role !== 'compartment') {
    const input = el('select');
    setOptions(input, behaviors, edits.behavior || source.behavior);
    add('behavior', input);
    const toggle = el('input');
    toggle.type = 'checkbox';
    toggle.checked = edits.moving ?? source.moving;
    add('moving', toggle);
    if (!source.moving)
      host.append(el('small', tr('الحركة هنا توصيف فقط', 'Movement here is metadata only')));
  }
  $('save-part-correction').disabled = !host.children.length;
  $('reset-part').disabled = !Object.keys(edits).length;
  if (step === 3) viewer?.highlight(selection);
}
function selectPart(id) {
  selection = id;
  if (step !== 3) setStep(3);
  else showEditor();
}
function apply(next, reframe = false) {
  if (!next || !history.apply(next)) return false;
  reconstruction = null;
  syncInputs();
  renderReports();
  schedule(reframe);
  return true;
}
function setCamera(id) {
  if (!cameras[id]) return;
  $('camera').value = id;
  if (id === 'inside') {
    $('opening').value = 100;
    $('opening-out').value = '100%';
    model?.setOpening(1);
    // Interior camera cuts a closed shell only when explicitly requested.
  }
  viewer?.frame(id);
}
function schedule(frame = false) {
  version++;
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    void build(version, frame);
  }, 45);
}
async function api() {
  return (viewerModule ||= await import('./bag-viewer.js'));
}
async function build(id, frame) {
  try {
    const a = await api();
    if (id !== version) return;
    if (!viewer)
      viewer = new a.BagViewer($('stage'), selectPart, (code) => {
        if (code === 'restored') {
          schedule(true);
          return;
        }
        $('stage-message').hidden = false;
        $('stage-message').textContent = tr(
          'فُقد اتصال الرسوميات مؤقتًا',
          'Graphics context temporarily lost',
        );
      });
    const next = await a.assemble(
      current(),
      photos.map((p) => ({ ...p })),
      matchMedia('(max-width:670px)').matches ? 'mobile' : 'detail',
    );
    if (id !== version) {
      next.dispose();
      return;
    }
    model = next;
    viewer.replace(next, frame);
    model.setOpening(+$('opening').value / 100);
    model.setSwing(+$('swing').value / 100);
    model.setPockets(+$('pocket-motion').value / 100);
    viewer.inspect($('show-inside').checked);
    $('stage-message').hidden = true;
    showEditor();
    renderReports();
  } catch {
    if (id !== version) return;
    $('stage-message').hidden = false;
    $('stage-message').textContent = tr(
      'تعذّر عرض المجسم. تقدر تحفظ المشروع وتعيد المحاولة.',
      'Preview unavailable. Save your project or retry construction.',
    );
    $('model-status').textContent = tr('تعذرت المعاينة', 'Preview unavailable');
  }
}
function projectRecord() {
  return {
    kind: 'rawnak-modular-bag',
    schemaVersion: 2,
    units: 'cm',
    project: current(),
    images: photos.map(sourceMetadata),
    reconstruction,
    capture: evaluateBagCapture(current().spec, references()),
    stages: STAGES,
    privacy: { imageBytesIncluded: false, trainingConsent: false },
    output: { photoTo3DFaithful: false, physicalSimulation: false, retailARReady: false },
  };
}
function save(blob, name) {
  const url = URL.createObjectURL(blob),
    a = el('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const json = (value, name) =>
  save(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), name);
function readProject(record) {
  if (!record || record.kind !== 'rawnak-modular-bag' || ![1, 2].includes(record.schemaVersion))
    throw Error('schema');
  const raw = record.project || record;
  if (!raw.spec || typeof raw.spec !== 'object') throw Error('spec');
  const edits =
    raw.edits ||
    Object.fromEntries((record.partCorrections || []).filter((x) => x?.id).map((x) => [x.id, x]));
  const project = newProject(raw.spec, { ...raw, edits });
  const saved = (Array.isArray(record.images) ? record.images : [])
    .slice(0, 36)
    .filter((p) => p && typeof p.name === 'string')
    .map((p) => ({
      id: typeof p.id === 'string' ? p.id.slice(0, 128) : '',
      name: p.name.slice(0, 180),
      bytes: Number(p.bytes) || 0,
      width: Number(p.width) || 0,
      height: Number(p.height) || 0,
      view: Object.hasOwn(views, p.view) ? p.view : 'unknown',
      source: p.source === 'merchant' ? 'merchant' : 'filename',
      analysis: null,
      url: null,
    }));
  photoEpoch++;
  photos.forEach((p) => {
    if (p.url) URL.revokeObjectURL(p.url);
  });
  photos = saved;
  history = new EditHistory(project);
  reconstruction = null;
  selection = 'front_panel';
  syncInputs();
  renderPhotos();
  setStep(0);
  schedule(true);
  note(
    'المشروع مفتوح. أعد اختيار الصور الأصلية لربط مراجعها.',
    'Project opened. Reselect original files to relink references.',
  );
}
async function exportFile(kind) {
  if (busy) return;
  busy = true;
  const controls = ['download-glb', 'download-json', 'download-project'];
  controls.forEach((k) => ($(k).disabled = true));
  try {
    const name = 'rawnak-' + current().spec.style;
    if (kind === 'project') {
      json(projectRecord(), name + '.fit.json');
      return;
    }
    const a = await api(),
      profile = $('profile').value,
      p = current(),
      refs = photos.map((p) => ({ ...p }));
    if (kind === 'glb') {
      const { data } = await a.exportAsset(p, refs, profile);
      save(new Blob([data], { type: 'model/gltf-binary' }), name + '-' + profile + '.glb');
    } else {
      const assembled = await a.assemble(p, refs, profile);
      try {
        json(assembled.graph, name + '-' + profile + '.parts.json');
      } finally {
        assembled.dispose();
      }
    }
    note('تم تجهيز ملف التصدير', 'Export ready');
  } catch {
    note(
      'تعذّر تجهيز الملف. راجع الصور وأعد المحاولة.',
      'Export failed. Check the references and retry.',
    );
  } finally {
    busy = false;
    controls.forEach((k) => ($(k).disabled = false));
  }
}
$('style').onchange = (e) => {
  const style = e.target.value;
  const previous = current().spec;
  const oldTemplate = createBagSpec({ ...FAMILY_PRESETS[previous.style], style: previous.style });
  const newTemplate = createBagSpec({ ...FAMILY_PRESETS[style], style });
  const changes = { style };
  for (const key of Object.keys(newTemplate)) {
    if (previous[key] === oldTemplate[key] && oldTemplate[key] !== newTemplate[key])
      changes[key] = newTemplate[key];
  }
  apply(changeStructure(current(), changes), true);
};
$('language').onclick = () => {
  lang = lang === 'ar' ? 'en' : 'ar';
  store('bag-language', lang);
  translate();
  savedButton();
};
$('theme').onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  store('bag-theme', theme);
  translate();
};
$('next').onclick = () => setStep(step + 1);
$('camera').onchange = (e) => setCamera(e.target.value);
$('reset-view').onclick = () => setCamera('orbit');
$('photos-input').onchange = (e) => {
  const files = [...e.target.files],
    epoch = photoEpoch;
  e.target.value = '';
  uploadQueue = uploadQueue.then(() => addPhotos(files, epoch));
};
$('remove-photos').onclick = () => {
  photoEpoch++;
  photos.forEach((p) => {
    if (p.url) URL.revokeObjectURL(p.url);
  });
  photos = [];
  changedReferences();
};
$('compare-photo').onchange = () => updateComparison(true);
$('generate').onclick = async () => {
  const p = current(),
    epoch = photoEpoch,
    r = await reconstructDraft(p.spec, references());
  if (p !== current() || epoch !== photoEpoch) return;
  if (r.fit && JSON.stringify(r.fit) !== JSON.stringify(p.fit)) {
    const feedback = {
      componentId: 'body',
      componentType: 'assembly',
      bagFamily: p.spec.style,
      category: 'silhouette-fit',
      original: p.fit,
      corrected: r.fit,
      sourceEvidence: r.fit.sources,
      approval: 'pending',
      trainingConsent: false,
    };
    apply({ ...p, fit: r.fit, approval: 'unreviewed', feedback: [...p.feedback, feedback] }, true);
  } else schedule(true);
  reconstruction = { stages: r.stages, evidence: r.evidence, photoGeometryVerified: false };
  $('fit-status').textContent = r.fit
    ? tr(
        'طُبقت حدود الجسم على العرض. المقاسات المدخلة محفوظة.',
        'Applied body outline within the entered measurements.',
      )
    : fitMessage(r);
};
$('use-color').onclick = () => {
  const r = results();
  if (r.color) apply(changeStructure(current(), { bodyColor: r.color }, r.fit.sources));
};
$('part-select').onchange = (e) => selectPart(e.target.value);
$('save-part-correction').onclick = () => {
  const patch = {},
    shared = {},
    sources = model?.parts.find((p) => p.id === selection)?.sourceEvidence || [];
  for (const key of dirtyFields) {
    const isShared = key.startsWith('shared-'),
      n = $(isShared ? key : 'edit-' + key);
    if (!n.checkValidity() || (n.type === 'number' && n.value === '')) {
      n.reportValidity();
      return;
    }
    if (isShared) shared[key.slice(7)] = Number(n.value);
    else
      patch[key] =
        n.type === 'checkbox' ? n.checked : n.type === 'number' ? Number(n.value) : n.value;
  }
  apply(correctPart(changeStructure(current(), shared, sources), selection, patch, sources));
};
$('reset-part').onclick = () =>
  apply(
    correctPart(
      current(),
      selection,
      {},
      model?.parts.find((p) => p.id === selection)?.sourceEvidence || [],
      true,
    ),
  );
$('run-command').onclick = () => {
  const next = interpretCommand(
    $('command').value,
    current(),
    selection,
    model?.parts.find((p) => p.id === selection)?.sourceEvidence || [],
  );
  $('part-feedback').textContent = next
    ? tr('تمت معالجة الأمر', 'Command processed')
    : tr(
        'اختار أمرًا من القائمة وحدد الجزء المناسب',
        'Choose a supported command and its component',
      );
  if (next) apply(next);
};
for (const [button, action] of [
  ['undo', 'undo'],
  ['redo', 'redo'],
])
  $(button).onclick = () => {
    if (history[action]()) {
      reconstruction = null;
      syncInputs();
      renderReports();
      schedule(true);
    }
  };
for (const [slider, out, fn] of [
  ['opening', 'opening-out', 'setOpening'],
  ['swing', 'swing-out', 'setSwing'],
  ['pocket-motion', 'pocket-out', 'setPockets'],
]) {
  $(slider).oninput = () => {
    $(out).value = $(slider).value + '%';
    model?.[fn](+$(slider).value / 100);
    viewer?.draw();
  };
}
$('show-inside').onchange = (e) => {
  viewer?.inspect(e.target.checked);
  if (e.target.checked) setCamera('inside');
  else setCamera('orbit');
};
$('approve').onclick = () => {
  apply(approveProject(current()));
  const ok = store('rawnak-approved-bag', JSON.stringify(projectRecord()));
  note(
    ok ? 'اتحفظت المراجعة على الجهاز.' : 'نزّل المشروع للاحتفاظ بالمراجعة.',
    ok ? 'Review saved on this device.' : 'Download the project to keep this review.',
  );
  savedButton();
};
function savedButton() {
  let b = $('open-saved');
  if (!b) {
    b = el('button');
    b.id = 'open-saved';
    b.className = 'plain';
    $('import').before(b);
    b.onclick = () => {
      try {
        readProject(JSON.parse(stored('rawnak-approved-bag')));
      } catch {
        note('تعذّر فتح الحفظ المحلي', 'Saved review could not be opened');
      }
    };
  }
  b.hidden = !stored('rawnak-approved-bag');
  b.textContent = tr('آخر اعتماد', 'Last approval');
}
$('import').onclick = () => $('project-file').click();
$('project-file').onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    if (f.size > 8e6) throw Error('size');
    readProject(JSON.parse(await f.text()));
  } catch {
    note('ملف المشروع غير صالح', 'Invalid project file');
  }
};
for (const [id, kind] of [
  ['download-glb', 'glb'],
  ['download-json', 'graph'],
  ['download-project', 'project'],
])
  $(id).onclick = () => void exportFile(kind);
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  version++;
  photoEpoch++;
  clearTimeout(rebuildTimer);
  viewer?.dispose();
  photos.forEach((p) => {
    if (p.url) URL.revokeObjectURL(p.url);
  });
});
translate();
savedButton();
schedule(true);
