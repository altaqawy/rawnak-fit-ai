import * as THREE from 'three';
import { clamp, mix } from './bag-patterns.js';
import { grid, updateGrid, zipperTeeth, sampled } from './bag-surfaces.js';

export function buildPouchInsert(c) {
  const { p, s, m, mesh, path, parts, groups, detail } = c;
  const id = 'insert_pouch',
    slider = 'insert_slider';
  // Keep the insert within one compartment even after the merchant adds dividers.
  const span = 2 / s.mainCompartments,
    mid = -1 + span / 2;
  const face = (x, z, height) => {
    const nx = 0.84 * x,
      nz = mid + z * span * 0.31;
    const low = p.volume(nx, nz, 0, true)[1],
      high = p.volume(nx, nz, 1, true)[1];
    const t = clamp((p.h * height - low) / (high - low), 0.035, 0.94);
    return p.volume(nx, nz, t, true);
  };
  function wall(u, v, edge) {
    const a = 2 * u - 1,
      taper = mix(0.9, 1, v);
    const x = (edge === 1 ? 1 : edge === 3 ? -1 : edge === 2 ? -a : a) * taper;
    const z = (edge === 0 ? 1 : edge === 2 ? -1 : edge === 1 ? -a : a) * mix(0.77, 1, v);
    return face(x, z, mix(0.06, 0.62, v));
  }
  for (let side = 0; side < 4; side++) {
    mesh(
      id,
      'POUCH_WALL_' + side,
      grid(detail, 4, (u, v) => wall(u, v, side)),
      m.pouch,
    );
    if (side === 1 || side === 3)
      path(id, 'END_BINDING_' + side, detail, (u) => wall(u, 1, side), p.thickness * 0.49, m.trim);
  }
  mesh(
    id,
    'POUCH_FLOOR',
    grid(detail, 3, (u, v) => face((2 * u - 1) * 0.9, (2 * v - 1) * 0.77, 0.06)),
    m.pouch,
  );
  const rail = (u, v, sign, n) => {
    const gap = 0.016 + 0.52 * clamp((n - u) * 7, 0, 1);
    return face(2 * u - 1, sign * mix(1, gap, v), 0.62 + 0.062 * Math.sin((Math.PI * v) / 2));
  };
  const updates = [];
  for (const sign of [-1, 1]) {
    for (const [name, lo, hi, mat] of [
      ['FACING', 0, 0.77, m.pouch],
      ['ZIP_TAPE', 0.77, 1, m.carrier || m.trim],
    ]) {
      const at = (u, v, n) => rail(u, mix(lo, hi, v), sign, n);
      const g = grid(detail * 2, 3, (u, v) => at(u, v, 0), sign === 1);
      mesh(id, name + '_' + sign, g, mat);
      updates.push((n) => updateGrid(g, detail * 2, 3, (u, v) => at(u, v, n)));
    }
    const teeth = zipperTeeth(
      detail * 3,
      (u, v, n) => {
        const q = rail(u, 0.94 + 0.06 * v, sign, n);
        q[1] += p.thickness * 0.14;
        return q;
      },
      sign === 1,
    );
    mesh(id, 'ZIP_TEETH_' + sign, teeth.geometry, m.zip);
    updates.push(teeth.update);
  }
  const center = (u) => rail(u, 1, 0, u);
  const radius = Math.min(p.d * 0.049, p.h * 0.03, p.w * 0.023);
  const pull = c.hardware(slider, 'POUCH_SLIDER', radius, m.zip);
  pull.scale.set(1.35, 0.46, 0.9);
  const loop = mesh(
    slider,
    'ZIP_PULL',
    new THREE.TorusGeometry(radius * 0.86, radius * 0.2, 6, 14),
    m.metal,
  );
  loop.rotation.x = Math.PI / 2;
  loop.scale.x = 1.51;
  loop.position.set(-radius * 1.2, radius * 0.51, 0);
  const g = groups.get(slider),
    limit = c.limit(slider);
  parts.get(slider).range = {
    unit: 'path-fraction',
    min: 0,
    max: limit,
    points: sampled(15, center),
  };
  parts.get(slider).anchors = { start: center(0), end: center(1) };
  parts.get(id).geometryConstraints = {
    boundedToParent: true,
    compartment: 'compartment_1',
    construction: 'zippered-pouch',
  };
  parts.get(id).connections.push('compartment_1');
  c.motions.pockets.push((amount) => {
    const n = amount * limit;
    g.position.set(...center(n));
    for (const update of updates) update(n);
  });
}
