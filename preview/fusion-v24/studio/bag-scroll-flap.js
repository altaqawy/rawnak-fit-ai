import * as THREE from 'three';
import { blend, clamp, mix } from './bag-patterns.js';
import { grid } from './bag-surfaces.js';
import { scrollCourse, scrollLayout } from './bag-cord.js';

export function buildScrollFlap(c) {
  const { p, s, m, mesh, parts, groups, edits } = c;
  const lid = groups.get('closure'),
    part = parts.get('closure');
  const hinge = p.lip(0, true),
    diameter = Math.min(s.cordDiameterMm / 1000, p.h * 0.09, p.d * 0.13);
  const drop = clamp((s.flapLength / 100) * (edits.closure?.lengthScale || 1), 0.105, 0.875);
  lid.name = 'SCROLL_HINGE';
  lid.position.set(...hinge);
  const developed = p.d * 0.7 + p.h * drop;
  // Coordinates on the flat cutting pattern. The closed shape follows the rim
  // and front wall. The open shape relaxes as the fold rises around the rear seam.
  function map(x, v, z, open) {
    const q = (x * 0.49 * s.scrollWidth) / 100;
    const rear = [p.lip(q, true)[0], hinge[1], hinge[2]],
      front = p.lip(q, false, 1, -diameter * 0.59);
    const bend = Math.min(p.d * 0.12, p.h * drop * 0.26);
    const behind = [...front];
    behind[2] -= bend;
    const below = p.lip(q, false, 1 - bend / p.h, -diameter * 0.59);
    let point, normal;
    if (v < 0.33) {
      point = blend(rear, behind, v / 0.33);
      normal = [0, 1, 0];
    } else if (v < 0.49) {
      const t = (v - 0.33) / 0.16;
      point = blend(blend(behind, front, t), blend(front, below, t), t);
      normal = [0, Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)];
    } else {
      const depth = mix(bend / p.h, drop, (v - 0.49) / 0.51);
      point = p.lip(q, false, 1 - depth, -diameter * 0.59);
      normal = [0, 0, 1];
    }
    const seam = clamp(v / 0.065, 0, 1);
    const flat = [rear[0] - hinge[0], z * seam, v * developed];
    const closed = point.map((n, k) => n - hinge[k] + normal[k] * (z + diameter * 0.32) * seam);
    return open ? flat : closed;
  }
  const morphs = [];
  function morph(id, name, make, mat) {
    const g = make(false),
      target = make(true);
    g.morphAttributes.position = [target.attributes.position];
    g.morphAttributes.normal = [target.attributes.normal];
    target.dispose();
    const o = mesh(id, name, g, mat);
    o.morphTargetDictionary = { unfolded: 0 };
    morphs.push(o);
  }
  // Only the sewn bridge crosses the two scrolls at their roots. The rest of
  // the aperture stays perforated right through to the other side.
  const socketSeam = (u, v) => {
    const q = ((u - 0.5) * 0.7 * 0.49 * s.scrollWidth) / 100,
      back = p.lip(q, true, 0.86, -p.thickness * 0.3);
    const line = [p.lip(q, true)[0], hinge[1], hinge[2]];
    return blend(back, line, v);
  };
  mesh('opening', 'SEWN_HINGE_FACING', grid(12, 5, socketSeam), m.skin);
  c.path(
    'opening',
    'HINGE_STITCH',
    24,
    (u) => socketSeam(u, 0.16),
    p.thickness * 0.19,
    m.thread,
    true,
  );
  morph(
    'closure',
    'WOVEN_HINGE_BRIDGE',
    (o) =>
      grid(12, 12, (u, v) =>
        map((u - 0.5) * mix(0.7, 0.82, Math.sin(v * Math.PI)), v * 0.5, -diameter * 0.29, o),
      ),
    m.skin,
  );
  // The free scroll laps its mate while the snap holds the tip down. The
  // trough between the two curls opens as the flap relaxes.
  function layered(arm, x, v, z, open) {
    const contact = open
      ? 0
      : THREE.MathUtils.smoothstep(v, 0.25, 0.72) * (1 - THREE.MathUtils.smoothstep(v, 0.84, 0.96));
    return map(
      x + (arm ? -0.037 : 0.073) * contact,
      v,
      z + diameter * (arm ? 0.12 : 1.12) * contact,
      open,
    );
  }
  for (const [arm, id] of ['scroll_left', 'scroll_right'].entries()) {
    lid.add(groups.get(id));
    const lay = (x, v, z, open) => layered(arm, x, v, z, open);
    for (const back of [false, true])
      morph(
        id,
        back ? 'UNDERSIDE_COURSES' : 'FACE_COURSES',
        (o) => scrollCourse(c, arm, lay, o, back),
        m.cord,
      );
    morph(
      id,
      'BRAIDED_PERIMETER',
      (o) => {
        const steps = c.detail * 7 + 8,
          points = [];
        for (let i = 0; i < steps; i++) {
          const [x, v] = scrollLayout(i / steps, 0, arm, s.scrollAngle);
          points.push(new THREE.Vector3(...lay(x, v, diameter * 0.12, o)));
        }
        const curve = new THREE.CatmullRomCurve3(points, true);
        const g = new THREE.TubeGeometry(curve, steps, diameter * 0.39, 6, true),
          uv = g.attributes.uv;
        const repeats = curve.getLength() / (diameter * 2.2);
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * repeats, uv.getY(i));
        return g;
      },
      m.cord,
    );
    morph(
      id,
      'CORD_CORE',
      (o) =>
        grid(c.detail * 4 + 8, 2, (t, v) => {
          const [x, y] = scrollLayout(t, 1, arm, s.scrollAngle);
          return lay(x, y, (v - 0.5) * diameter * 0.39, o);
        }),
      m.cord,
    );
    parts.get(id).connections = ['closure'];
  }
  // Place the fastener on material at the distal sweep, clear of the open slit.
  let seat = [0, 0],
    seatArm = 0;
  for (const arm of [0, 1])
    for (let i = 0; i <= 96; i++) {
      const test = scrollLayout(i / 96, 0.5, arm, s.scrollAngle);
      if (test[1] > seat[1]) {
        seat = test;
        seatArm = arm;
      }
    }
  const closed = layered(seatArm, ...seat, -diameter * 0.4, false),
    flat = layered(seatArm, ...seat, -diameter * 0.4, true);
  const radius = Math.min(p.w * 0.042, p.h * 0.065, p.d * 0.12);
  const patch = mesh(
    'closure',
    'SNAP_LEATHER_WASHER',
    new THREE.CylinderGeometry(radius, radius, diameter * 0.22, 24),
    m.carrier || m.trim,
  );
  const plug = mesh(
    'closure',
    'PRESS_STUD',
    new THREE.CylinderGeometry(radius * 0.47, radius * 0.49, diameter * 0.44, 18),
    m.zip,
  );
  const socket = mesh(
    'snap_receiver',
    'RECEIVER_SOCKET',
    new THREE.TorusGeometry(radius * 0.43, radius * 0.11, 7, 20),
    m.zip,
  );
  socket.position.set(
    closed[0] + hinge[0],
    closed[1] + hinge[1],
    closed[2] + hinge[2] - diameter * 0.41,
  );
  const backing = mesh(
    'snap_receiver',
    'SOCKET_WASHER',
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, diameter * 0.26, 20),
    m.carrier || m.trim,
  );
  backing.rotation.x = Math.PI / 2;
  backing.position.copy(socket.position);
  backing.position.z -= diameter * 0.16;
  parts.get('snap_receiver').anchors = { center: socket.position.toArray() };
  part.anchors = { hinge, snap: socket.position.toArray() };
  part.connections.push('snap_receiver');
  part.range = { unit: 'degrees', min: 0, max: 146 * c.limit('closure'), axis: [-1, 0, 0] };
  c.motions.open.push((n) => {
    const f = n * c.limit('closure');
    lid.rotation.x = (-f * 146 * Math.PI) / 180;
    for (const o of morphs) o.morphTargetInfluences[0] = f;
    for (const [o, offset] of [
      [patch, 0],
      [plug, -diameter * 0.2],
    ]) {
      const pos = blend(closed, flat, f);
      o.rotation.x = ((1 - f) * Math.PI) / 2;
      o.position.set(pos[0], pos[1] + f * offset, pos[2] + (1 - f) * offset);
    }
  });
}
