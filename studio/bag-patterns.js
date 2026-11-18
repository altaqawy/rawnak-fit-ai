// Pattern space: metres, Y up, +Z front. The four exterior pieces share exact
// seam curves. The liner, floor and pockets sample the same interior volume.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const blend = (a, b, t) => a.map((value, i) => mix(value, b[i], t));
export const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);
const profile = (width, depth, exponent, rise, dip, extras = {}) => ({
  width,
  depth,
  exponent,
  rise,
  dip,
  ...extras,
});

export const PATTERNS = {
  structured: profile([0.9, 1, 0.99, 0.94, 0.84], [0.87, 1, 0.97, 0.83, 0.65], 4.8, 0.045, 0.008),
  tote: profile([0.69, 0.78, 0.88, 0.96, 1], [0.71, 0.83, 0.92, 1, 0.94], 4.0, 0.035, 0.075),
  baguette: profile([0.81, 0.99, 1, 0.96, 0.82], [0.73, 0.97, 1, 0.88, 0.58], 3.5, 0.14, 0.095),
  hobo: profile([0.56, 0.93, 1, 0.96, 0.86], [0.58, 0.91, 1, 0.79, 0.46], 2.7, 0.3, 0.43),
  bucket: profile([0.8, 0.88, 0.97, 1, 0.98], [0.81, 0.9, 0.97, 1, 0.99], 2.1, 0.024, 0.025, {
    pleats: 10,
  }),
  clutch: profile([0.91, 0.99, 1, 0.99, 0.92], [0.5, 0.9, 1, 0.77, 0.36], 5.0, 0.078, 0.018),
  saddle: profile([0.64, 0.92, 1, 0.99, 0.96], [0.64, 0.87, 1, 0.97, 0.73], 3.3, 0.17, 0.035, {
    asymmetry: 0.11,
  }),
  backpack: profile([0.88, 1, 0.99, 0.87, 0.57], [0.81, 1, 0.96, 0.82, 0.58], 3.7, 0.055, 0.02, {
    crown: 0.16,
  }),
};

export const FAMILY_PRESETS = {
  structured: {
    widthCm: 28,
    heightCm: 20,
    depthCm: 11,
    closure: 'flap',
    strapCount: 0,
    handlesCount: 1,
    strapType: 'shoulder',
    bodyColor: '#6e4336',
  },
  tote: {
    widthCm: 37,
    heightCm: 29,
    depthCm: 15,
    closure: 'open',
    strapCount: 0,
    handlesCount: 2,
    handleDropCm: 21,
    bodyColor: '#aa7049',
  },
  baguette: {
    widthCm: 30,
    heightCm: 14,
    depthCm: 7,
    closure: 'zipper',
    strapCount: 1,
    strapLengthCm: 47,
    handlesCount: 0,
    bodyColor: '#904653',
  },
  hobo: {
    widthCm: 34,
    heightCm: 25,
    depthCm: 11,
    closure: 'magnetic',
    strapCount: 1,
    strapLengthCm: 45,
    handlesCount: 0,
    bodyColor: '#826746',
  },
  bucket: {
    widthCm: 23,
    heightCm: 26,
    depthCm: 18,
    closure: 'drawstring',
    strapCount: 1,
    strapLengthCm: 48,
    handlesCount: 0,
    bodyColor: '#a66e4c',
  },
  clutch: {
    widthCm: 26,
    heightCm: 13,
    depthCm: 5,
    closure: 'flap',
    strapType: 'none',
    strapCount: 0,
    handlesCount: 0,
    bodyColor: '#5c7464',
  },
  saddle: {
    widthCm: 25,
    heightCm: 20,
    depthCm: 8,
    closure: 'flap',
    strapType: 'crossbody',
    strapCount: 1,
    strapLengthCm: 72,
    handlesCount: 0,
    bodyColor: '#98522e',
  },
  backpack: {
    widthCm: 25,
    heightCm: 29,
    depthCm: 13,
    closure: 'zipper',
    strapType: 'backpack',
    strapCount: 2,
    strapLengthCm: 56,
    handlesCount: 1,
    handleDropCm: 4,
    outerPockets: 1,
    bodyColor: '#616c50',
  },
};

export function sampleProfile(values, t) {
  const at = clamp(t, 0, 1) * (values.length - 1);
  const i = Math.min(values.length - 2, Math.floor(at));
  // Monotone cubic Hermite interpolation keeps rounded shoulders free of overshoot.
  const a = values[i],
    b = values[i + 1],
    f = at - i,
    slope = b - a;
  const tangent = (previous, next) =>
    previous * next > 0 ? (2 * previous * next) / (previous + next) : 0;
  const m0 = i ? tangent(a - values[i - 1], slope) : slope;
  const m1 = i + 2 < values.length ? tangent(slope, values[i + 2] - b) : slope;
  return mix(a, b, smooth(f)) + f * (1 - f) * ((1 - f) * m0 - f * m1);
}

export function makePattern(spec, fittedWidths) {
  const family = PATTERNS[spec.style],
    w = spec.widthCm / 100,
    h = spec.heightCm / 100,
    d = spec.depthCm / 100;
  const thickness = Math.min(spec.panelThicknessMm / 1000, d * 0.065, h * 0.035, w * 0.025);
  const widths = family.width.map((value, i) => {
    const f = fittedWidths?.[i];
    const fitted = Number.isFinite(f) ? mix(value, clamp(f, 0.35, 1), 0.55) : value;
    return fitted * (1 + (spec.sideTaper / 100) * (i / 4 - 0.5) * 0.62);
  });
  const max = Math.max(...widths);
  const width = widths.map((v) => v / max);
  const power = clamp(family.exponent + (50 - spec.roundness) / 32, 2, 7);
  const inset = (t) => (t === true ? thickness * 1.25 : Number(t) || 0);
  function surface(angle, t, offset = 0, open = 1) {
    const sn = Math.sin(angle),
      cs = Math.cos(angle);
    const polar = (Math.abs(sn) ** power + Math.abs(cs) ** power) ** (-1 / power);
    const nx = sn * polar,
      nz = cs * polar,
      edge = Math.abs(nx);
    const base =
      h *
      (((family.rise * spec.baseCurve) / 50) * edge ** 2.8 +
        (family.asymmetry || 0) * Math.max(0, -nx) ** 2);
    const crown = h * (1 - family.dip * (1 - edge ** 2) - (family.crown || 0) * edge ** 2);
    const neck = smooth(clamp((t - 0.72) / 0.28, 0, 1));
    const pinch = spec.closure === 'drawstring' ? (1 - open) * neck : 0;
    const fluting = family.pleats
      ? 1 - ((0.022 + 0.075 * pinch) * neck * (1 - Math.cos(angle * family.pleats))) / 2
      : 1;
    const opening = mix(1, spec.openingScale / 100, neck);
    const gusset = 1 - (1 - spec.gussetWidth / 100) * Math.sin(Math.PI * t) * 0.55;
    const rx = w * 0.5 * sampleProfile(width, t) * opening * fluting * (1 - 0.27 * pinch);
    const rz =
      d * 0.5 * sampleProfile(family.depth, t) * opening * fluting * gusset * (1 - 0.55 * pinch);
    const off = inset(offset);
    return [nx * (rx - off), mix(base, crown, t) + off * (1 - 1.25 * t), nz * (rz - off)];
  }
  function volume(x, z, t, offset = true, open = 1) {
    const r = Math.max(Math.abs(x), Math.abs(z));
    const edge = surface(Math.atan2(x, z), t, offset, open);
    return [
      r * edge[0],
      mix(t * h * (1 - family.dip) + inset(offset) * (1 - 1.25 * t), edge[1], r),
      r * edge[2],
    ];
  }
  // A section cuts front and back at exactly the same x, including the side tips.
  const lip = (q, back, t = 1, offset = 0, open = 1) =>
    surface(back ? Math.PI - (q * Math.PI) / 2 : (q * Math.PI) / 2, t, offset, open);
  return { w, h, d, thickness, width, surface, volume, lip, spec, family };
}
