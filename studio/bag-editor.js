import { createBagSpec, describeBagComponents } from './bag-spec.js';
import { clamp } from './bag-patterns.js';

const common = { visible: [0, 1], roughness: [0, 1] };
export function editLimits(part) {
  if (!part) return {};
  const fields = { ...common };
  if (part.role === 'assembly' || part.role === 'compartment') return {};
  if (['strap', 'handle'].includes(part.role))
    Object.assign(fields, {
      lengthScale: [0.65, 1.5],
      widthScale: [0.6, 1.5],
      anchorShift: [-0.18, 0.18],
    });
  if (
    ['open_pocket', 'zip_pocket', 'outer_pocket', 'card_slot', 'accessory_pocket'].includes(
      part.role,
    )
  )
    Object.assign(fields, { widthScale: [0.65, 1.18], offsetX: [-0.24, 0.24] });
  if (['flap', 'buckle', 'clasp'].includes(part.role)) fields.lengthScale = [0.7, 1.25];
  if (part.moving) fields.motionLimit = [0, 1];
  return fields;
}
export function cleanEdit(part, raw = {}) {
  const edit = {};
  for (const [key, [lo, hi]] of Object.entries(editLimits(part))) {
    if (key === 'visible') {
      if (raw.visible === false) edit.visible = false;
      continue;
    }
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key]))
      edit[key] = clamp(raw[key], lo, hi);
  }
  if (['rigid', 'semi-rigid', 'flexible', 'surface-attached'].includes(raw.behavior))
    edit.behavior = raw.behavior;
  if (typeof raw.moving === 'boolean') edit.moving = raw.moving;
  return edit;
}
export function newProject(spec, options = {}) {
  const clean = createBagSpec(spec),
    edits = {};
  for (const part of describeBagComponents(clean)) {
    const e = cleanEdit(part, options.edits?.[part.id]);
    if (Object.keys(e).length) edits[part.id] = e;
  }
  const widths = options.fit?.widths;
  const fit =
    Array.isArray(widths) &&
    widths.length === 5 &&
    widths.every((v) => Number.isFinite(v) && v >= 0.35 && v <= 1)
      ? {
          widths: [...widths],
          sources: (Array.isArray(options.fit.sources) ? options.fit.sources : [])
            .slice(0, 36)
            .map(String),
          method: 'bounded-frontal-envelope',
        }
      : null;
  return {
    spec: clean,
    edits,
    fit,
    feedback: Array.isArray(options.feedback)
      ? options.feedback
          .filter((f) => f && typeof f === 'object')
          .map((f) => ({ ...f, trainingConsent: false }))
      : [],
    approval: options.approval === 'merchant-reviewed' ? 'merchant-reviewed' : 'unreviewed',
  };
}
export class EditHistory {
  constructor(project) {
    this.present = project;
    this.past = [];
    this.future = [];
  }
  apply(next) {
    if (JSON.stringify(next) === JSON.stringify(this.present)) return false;
    this.past.push(this.present);
    if (this.past.length > 64) this.past.shift();
    this.present = next;
    this.future = [];
    return true;
  }
  undo() {
    if (!this.past.length) return false;
    this.future.push(this.present);
    this.present = this.past.pop();
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.present);
    this.present = this.future.pop();
    return true;
  }
}
export function correctPart(project, id, patch, sources = [], reset = false) {
  const part = describeBagComponents(project.spec).find((p) => p.id === id);
  if (!part) return project;
  const original = project.edits[id] || {},
    corrected = reset ? {} : cleanEdit(part, { ...original, ...patch });
  if (JSON.stringify(original) === JSON.stringify(corrected)) return project;
  const edits = { ...project.edits, [id]: corrected };
  if (!Object.keys(corrected).length) delete edits[id];
  const feedback = {
    componentId: id,
    componentType: part.role,
    bagFamily: project.spec.style,
    original: { ...part, overrides: original },
    corrected: { ...part, overrides: corrected },
    category: reset ? 'reset' : 'part-edit',
    sourceEvidence: [...sources],
    approval: 'pending',
    trainingConsent: false,
  };
  return {
    ...project,
    edits,
    feedback: [...project.feedback, feedback],
    approval: 'unreviewed',
  };
}
export function changeStructure(project, patch, sources = []) {
  const spec = createBagSpec({ ...project.spec, ...patch });
  const changed = Object.keys(spec).filter((k) => project.spec[k] !== spec[k]);
  if (!changed.length) return project;
  const feedback = {
    componentId: 'body',
    componentType: 'assembly',
    bagFamily: spec.style,
    category: 'structure',
    original: Object.fromEntries(changed.map((k) => [k, project.spec[k]])),
    corrected: Object.fromEntries(changed.map((k) => [k, spec[k]])),
    sourceEvidence: [...sources],
    approval: 'pending',
    trainingConsent: false,
  };
  return newProject(spec, {
    ...project,
    fit: spec.style === project.spec.style ? project.fit : null,
    feedback: [...project.feedback, feedback],
    approval: 'unreviewed',
  });
}
export function approveProject(project) {
  return {
    ...project,
    approval: 'merchant-reviewed',
    feedback: project.feedback.map((f) => ({
      ...f,
      approval: 'merchant-approved',
      trainingConsent: false,
    })),
  };
}
export function interpretCommand(input, project, selected, sources = []) {
  const text = String(input)
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '');
  const part = describeBagComponents(project.spec).find((p) => p.id === selected);
  if (/^(increase (the )?(bag )?depth|زود عمق الشنطه)$/.test(text))
    return changeStructure(project, { depthCm: Math.min(45, project.spec.depthCm + 1) }, sources);
  if (/^(round (the )?bottom corners|دور زوايا القاعده)$/.test(text))
    return changeStructure(
      project,
      {
        baseCurve: Math.min(90, project.spec.baseCurve + 10),
        roundness: Math.min(100, project.spec.roundness + 10),
      },
      sources,
    );
  if (/^(make (the )?(shoulder )?strap longer|طول السير|طول الحزام)$/.test(text)) {
    const id = part?.role === 'strap' ? selected : 'strap_1';
    if (!describeBagComponents(project.spec).some((p) => p.id === id)) return null;
    return correctPart(
      project,
      id,
      { lengthScale: (project.edits[id]?.lengthScale ?? 1) + 0.1 },
      sources,
    );
  }
  if (/^(move (the )?pocket to the right|حرك الجيب لليمين)$/.test(text) && editLimits(part).offsetX)
    return correctPart(
      project,
      selected,
      { offsetX: (project.edits[selected]?.offsetX || 0) + 0.08 },
      sources,
    );
  if (/^(make (the )?leather softer|خلي الجلد اطري)$/.test(text) && part)
    return correctPart(project, selected, { behavior: 'flexible' }, sources);
  return null;
}
