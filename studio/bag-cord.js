// A course is one cord laid beside the previous one. All courses of a cut
// piece share a draw call, but keep their own UV strip along the braid.
import * as THREE from 'three';
import { clamp, mix, TAU } from './bag-patterns.js';

export function braidMap(channel = 'normal') {
  const size = 128,
    a = new Uint8Array(size * size * 4);
  function height(u, v) {
    const turn = TAU * (4 * u + 0.035 * Math.sin(TAU * (u + v))),
      s = TAU * v;
    const left = Math.cos(turn + 2 * s + 0.28 * Math.sin(2 * turn - s));
    const right = Math.cos(turn - 2 * s + Math.PI + 0.25 * Math.sin(s));
    return (
      0.45 * Math.max(left, right) +
      0.14 * Math.cos(3 * turn + 6 * s) +
      0.1 * Math.cos(4 * turn - 7 * s)
    );
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        e = 1 / size;
      const dx = (height(u - e, v) - height(u + e, v)) * 1.9;
      const dy = (height(u, v - e) - height(u, v + e)) * 1.9;
      const l = Math.hypot(dx, dy, 1);
      if (channel === 'normal') {
        a.set(
          [dx, dy, 1].map((n) => Math.round(127.5 * (1 + n / l))).concat(255),
          (y * size + x) * 4,
        );
      } else {
        const yarn = height(u, v),
          fiber = Math.sin(TAU * (9 * u + 12 * v) + 1.8 * Math.sin(TAU * v));
        const fuzz = Math.sin(TAU * (27 * u - 11 * v) + 1.35 * Math.sin(TAU * (8 * u + 3 * v)));
        const value = clamp(Math.round(210 + yarn * 28 + fiber * 6 + fuzz * 7), 164, 248);
        a.set([value, value, value, 255], (y * size + x) * 4);
      }
    }
  const t = new THREE.DataTexture(a, size, size);
  t.name = 'Template braided yarn · ' + channel;
  if (channel === 'color') t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// The points passed to the mapper are on the pattern, so the edge stays at the
// sewing line as the number of cords, fitted silhouette or dimensions change.
function courseGeometry(count, steps, diameter, point, flip = false, sides = 4) {
  const p = [],
    uv = [],
    idx = [];
  for (let k = 0; k < count; k++) {
    const start = p.length / 3;
    let distance = 0,
      previous;
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const center = new THREE.Vector3(...point(t, (k + 0.5) / count, 0.5));
      if (previous) distance += previous.distanceTo(center);
      previous = center;
      for (let i = 0; i <= sides; i++) {
        const f = i / sides;
        p.push(...point(t, (k + f) / count, f));
        uv.push(distance / (diameter * 2.2), f * 0.5);
        if (j === steps || i === sides) continue;
        const a = start + j * (sides + 1) + i,
          b = a + 1,
          c = a + sides + 1,
          d = c + 1;
        idx.push(...(flip ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function panelCourses(c, face, open = 0) {
  const { p, s, detail } = c;
  const side = face % 2 === 1,
    pitch = s.cordDiameterMm / 1000;
  const count = clamp(
    Math.round((side ? p.d * 0.45 : p.w * 0.48) / pitch),
    side ? 5 : 8,
    side ? 12 : 27,
  );
  const steps = detail * 3 + 6,
    cy = side ? 0.42 : 0.19;
  const leg = Math.round(steps * 0.16) / steps;
  const point = (t, r, f) => {
    let x, y;
    const shoulder = side ? 0.64 : 0.57;
    if (t < leg || t > 1 - leg) {
      x = t < leg ? -r : r;
      y = ((t < leg ? t : 1 - t) / leg) * mix(cy, shoulder, r);
    } else {
      const a = ((t - leg) / (1 - 2 * leg)) * Math.PI;
      x = -r * Math.cos(a);
      y = cy + r * (shoulder - cy + (1 - shoulder) * Math.sin(a));
    }
    const cap = shoulder + (1 - shoulder) * Math.sqrt(Math.max(0, 1 - x * x));
    const theta = (face * Math.PI) / 2 + (x * Math.PI) / 4;
    const relief = -Math.min(pitch, p.d * 0.11) * 0.31 * Math.sin(f * Math.PI);
    return p.surface(theta, clamp(y / cap, 0, 1), relief, open);
  };
  return { geometry: courseGeometry(count, steps, pitch, point, true), count };
}

// Two opposing scrolls widen at the outer sweep and curl into rounded tips.
// The interval between the sweeps is empty on both faces of the flap.
export function scrollLayout(t, r, arm, angle) {
  // Each offset follows the outside arc, convex bulb and concave return
  // of one interlocking lobe. The offsets meet tangentially around the bulb.
  const d = mix(0.038, 0.4995, r),
    outer = 1 - d,
    bulb = 0.5 - d,
    inner = 0.5 + d;
  const yi = 3 * d - 1,
    xi = -Math.sqrt(Math.max(0, outer * outer - yi * yi));
  let x, y;
  if (t < 0.47) {
    let start = Math.atan2(yi, xi);
    if (start > 0) start -= TAU;
    const a = mix(start, -1.5 * Math.PI, t / 0.47);
    x = outer * Math.cos(a);
    y = outer * Math.sin(a);
  } else if (t < 0.74) {
    const a = Math.PI * (0.5 - (t - 0.47) / 0.27);
    x = bulb * Math.cos(a);
    y = 0.5 + bulb * Math.sin(a);
  } else {
    let end = Math.atan2(yi + 0.5, xi);
    if (end < Math.PI / 2) end += TAU;
    const a = mix(Math.PI / 2, end, (t - 0.74) / 0.26);
    x = inner * Math.cos(a);
    y = -0.5 + inner * Math.sin(a);
  }
  // Slightly incline the division, as on a scroll laid across the crown.
  const curl = -2.05 * (1 - Math.min(1, Math.hypot(x, y))) ** 1.35;
  const rot = arm * Math.PI + (angle * Math.PI) / 180 + curl;
  return [
    x * Math.cos(rot) - y * Math.sin(rot),
    0.5 + 0.49 * (x * Math.sin(rot) + y * Math.cos(rot)),
  ];
}

export function scrollCourse(c, arm, map, open, back = false) {
  const diameter = Math.min(c.s.cordDiameterMm / 1000, c.p.w * 0.06, c.p.h * 0.09);
  const count = clamp(Math.round((c.p.w * 0.16) / diameter), 5, 10);
  const steps = c.detail * 4 + 8;
  const point = (t, r, f) => {
    const [x, v] = scrollLayout(t, r, arm, c.s.scrollAngle);
    const height = diameter * (0.19 + 0.21 * Math.sin(Math.PI * f)) * (back ? -1 : 1);
    return map(x, v, height, open);
  };
  return courseGeometry(count, steps, diameter, point, back, back ? 3 : 4);
}
