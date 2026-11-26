// A leather tongue and pierced escutcheon lift off a body-mounted quarter-turn button.
import * as THREE from 'three';
import { clamp } from './bag-patterns.js';

export function buildTurnLock(c, hinge, tipT, scale) {
  const { p, m, mesh, path, parts, groups } = c;
  const tip = p.lip(0, false, tipT),
    crown = p.lip(0, false)[1];
  const size = Math.min(scale, tip[1] * 0.45, (crown - tip[1]) * 0.5);
  const socketY = -0.88;
  const bodyZ = (y) => p.lip(0, false, clamp(y / crown, 0, 1))[2];
  const point = (x, y, z) => {
    const h = tip[1] + y * size;
    return [x * size - hinge[0], h - hinge[1], bodyZ(h) + p.thickness * 1.8 + z * size - hinge[2]];
  };
  const tongue = new THREE.Shape();
  tongue.moveTo(-1.28, 1.35);
  tongue.quadraticCurveTo(-1.2, 1.7, 0, 1.75);
  tongue.quadraticCurveTo(1.2, 1.7, 1.28, 1.35);
  tongue.bezierCurveTo(1.1, 0.45, 1.04, -0.5, 0.96, -1.3);
  tongue.quadraticCurveTo(0.88, -1.8, 0, -1.99);
  tongue.quadraticCurveTo(-0.88, -1.8, -0.96, -1.3);
  tongue.bezierCurveTo(-1.04, -0.5, -1.1, 0.45, -1.28, 1.35);
  const hole = () => {
    const h = new THREE.Path();
    h.absellipse(0, socketY, 0.26, 0.53, 0, Math.PI * 2, true);
    return h;
  };
  tongue.holes.push(hole());
  const make = (name, shape, lift, depth, material) => {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 2,
      curveSegments: 10,
    });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++)
      pos.setXYZ(i, ...point(pos.getX(i), pos.getY(i), lift + pos.getZ(i)));
    g.computeVertexNormals();
    return mesh('closure', name, g, material);
  };
  make('PIERCED_LEATHER_TONGUE', tongue, 0, 0.105, m.trim);
  path(
    'closure',
    'TONGUE_STITCH',
    48,
    (u) => {
      const v = tongue.getPointAt(u);
      return point(v.x * 0.9, v.y * 0.92, 0.115);
    },
    p.thickness * 0.15,
    m.thread,
    true,
  );
  const escutcheon = new THREE.Shape();
  escutcheon.absellipse(0, socketY, 0.77, 0.69, 0, Math.PI * 2, false);
  escutcheon.holes.push(hole());
  make('PIERCED_ESCUTCHEON', escutcheon, 0.11, 0.095, m.metal);
  const y = tip[1] + socketY * size;
  const fixed = c.hardware('lock_keeper', 'KEEPER_BASE', size, m.zip);
  fixed.scale.set(0.74, 0.64, 0.15);
  fixed.position.set(0, y, bodyZ(y) + p.thickness * 0.4);
  const stem = mesh(
    'lock_keeper',
    'SPINDLE',
    new THREE.CylinderGeometry(size * 0.17, size * 0.17, p.thickness * 2.0 + size * 0.28, 12),
    m.metal,
  );
  stem.rotation.x = Math.PI / 2;
  stem.position.set(0, y, bodyZ(y) + p.thickness + size * 0.13);
  const pivot = groups.get('turn_button');
  pivot.position.set(0, y, bodyZ(y) + p.thickness * 1.8 + size * 0.29);
  const button = c.hardware('turn_button', 'OVAL_TURN_BUTTON', size, m.metal);
  button.scale.set(0.48, 0.205, 0.17);
  const limit = c.limit('turn_button') * (c.limit('closure') > 0 ? 1 : 0);
  parts.get('turn_button').anchors = { spindle: pivot.position.toArray() };
  parts.get('turn_button').range = { unit: 'degrees', min: 0, max: 90 * limit, axis: [0, 0, 1] };
  parts.get('closure').connections.push('lock_keeper', 'turn_button');
  c.motions.open.push((n) => {
    pivot.rotation.z = (Math.min(1, n * 4) * limit * Math.PI) / 2;
  });
  return (n) => (limit === 1 ? clamp((n - 0.25) / 0.75, 0, 1) : 0);
}
