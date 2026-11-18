// Indexed pattern surfaces share edge samples. Store metres and a separate
// UV chart per sewn piece. Updating a joint reuses its GPU buffers.
import * as THREE from 'three';

function geometry(positions, uv, index) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
export function grid(cols, rows, point, reverse = false) {
  const p = [],
    uv = [],
    idx = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      p.push(...point(i / cols, j / rows));
      uv.push(i / cols, j / rows);
      if (i < cols && j < rows) {
        const a = j * (cols + 1) + i,
          b = a + 1,
          c = a + cols + 1,
          d = c + 1;
        idx.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
      }
    }
  return geometry(p, uv, idx);
}
export function disk(segments, point, center, reverse = false) {
  const pos = [...center],
    uv = [0.5, 0.5],
    idx = [];
  for (let i = 0; i < segments; i++) {
    const a = (i * 2 * Math.PI) / segments;
    pos.push(...point(a));
    uv.push(0.5 + 0.5 * Math.sin(a), 0.5 + 0.5 * Math.cos(a));
    const next = ((i + 1) % segments) + 1;
    idx.push(...(reverse ? [0, next, i + 1] : [0, i + 1, next]));
  }
  return geometry(pos, uv, idx);
}
export function updateGrid(g, cols, rows, point) {
  g.userData.kinematicSurface = true;
  const pos = g.attributes.position;
  for (let j = 0, k = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++, k++) pos.setXYZ(k, ...point(i / cols, j / rows));
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
}
export const sampled = (segments, fn) =>
  Array.from({ length: segments + 1 }, (_, i) => fn(i / segments));
export function cord(points, radius, sides = 5) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((v) => new THREE.Vector3(...v)),
    false,
    'centripetal',
  );
  return new THREE.TubeGeometry(curve, Math.max(4, points.length - 1), radius, sides, false);
}
// One indexed mesh for the entire stitch row, independent of stitch count.
export function stitches(points, radius) {
  const p = [],
    uv = [],
    ix = [],
    t = new THREE.Vector3(),
    n = new THREE.Vector3(),
    b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0),
    forward = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector3(...points[i]),
      d = new THREE.Vector3(...points[i + 1]).sub(a);
    if (d.lengthSq() < 1e-12) continue;
    t.copy(d).normalize();
    n.crossVectors(t, Math.abs(t.y) > 0.9 ? forward : up).normalize();
    b.crossVectors(t, n);
    const base = p.length / 3;
    for (const f of [0.12, 0.76])
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI) / 2;
        p.push(
          ...a
            .clone()
            .addScaledVector(d, f)
            .addScaledVector(n, Math.cos(angle) * radius)
            .addScaledVector(b, Math.sin(angle) * radius)
            .toArray(),
        );
        uv.push(f, j / 4);
      }
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      ix.push(base + j, base + k, base + j + 4, base + k, base + k + 4, base + j + 4);
    }
  }
  return geometry(p, uv, ix);
}
export function ribbon(curve, width, thickness, steps = 36) {
  // Parallel-transport frames keep the section rectangular through the crown.
  const frames = curve.computeFrenetFrames(steps, false);
  const first = curve.getTangentAt(0),
    axis = new THREE.Vector3(0, 0, 1);
  if (Math.abs(first.dot(axis)) > 0.85) axis.set(1, 0, 0);
  axis.addScaledVector(first, -first.dot(axis)).normalize();
  const n = axis.dot(frames.normals[0]),
    b = axis.dot(frames.binormals[0]);
  const point = (t, side) => {
    const i = Math.round(t * steps),
      w = frames.normals[i].clone().multiplyScalar(n).addScaledVector(frames.binormals[i], b);
    const depth = new THREE.Vector3().crossVectors(frames.tangents[i], w);
    const [sx, sy] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ][Math.round(side * 4)];
    return curve
      .getPointAt(t)
      .addScaledVector(w, (sx * width) / 2)
      .addScaledVector(depth, (sy * thickness) / 2)
      .toArray();
  };
  return grid(steps, 4, point);
}

// Discontinuous teeth in a single draw call. Each tooth samples the actual tape
// edge, including the separated part of a partially opened zipper.
export function zipperTeeth(count, point, reverse = false) {
  const positions = new Float32Array(count * 12),
    uv = [],
    indices = [];
  for (let i = 0; i < count; i++) {
    const start = i * 4;
    uv.push(0, 0, 1, 0, 0, 1, 1, 1);
    const order = reverse ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2];
    indices.push(...order.map((j) => j + start));
  }
  const g = geometry(positions, uv, indices);
  function update(amount) {
    const attr = g.attributes.position;
    for (let i = 0; i < count; i++)
      for (let j = 0; j < 4; j++) {
        const u = (i + (j % 2 ? 0.83 : 0.17)) / count;
        attr.setXYZ(i * 4 + j, ...point(u, j < 2 ? 0 : 1, amount));
      }
    attr.needsUpdate = true;
    g.userData.kinematicSurface = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }
  update(0);
  return { geometry: g, update };
}
