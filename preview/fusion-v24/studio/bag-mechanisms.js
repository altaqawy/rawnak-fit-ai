import * as THREE from 'three';
import { blend, clamp, mix, TAU } from './bag-patterns.js';
import {
  grid,
  cord,
  ribbon,
  rolledGrip,
  mountingRing,
  sampled,
  stitches,
  updateGrid,
  zipperTeeth,
} from './bag-surfaces.js';

import { buildScrollFlap } from './bag-scroll-flap.js';
import { buildTurnLock } from './bag-turn-lock.js';

const vec = (a) => new THREE.Vector3(...a);
function brassPlate(width, height, thickness) {
  const x = width / 2,
    y = height / 2,
    r = Math.min(y * 0.6, x * 0.45),
    shape = new THREE.Shape();
  shape.moveTo(-x + r, -y);
  shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y);
  shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r);
  shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  return new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.2,
    bevelSize: thickness * 0.25,
    bevelSegments: 2,
    curveSegments: 4,
  });
}
export function buildCarriers(c) {
  const { p, s, m, parts, groups, edits, mesh, path, detail, motions, anchor } = c;
  for (const part of parts.values()) {
    if (!['strap', 'handle'].includes(part.role)) continue;
    const handle = part.role === 'handle',
      id = part.id,
      index = Number(id.split('_')[1]) - 1;
    const pack = !handle && s.strapType === 'backpack',
      e = edits[id] || {};
    const leather = !handle && m.carrier ? m.carrier : m.trim;
    const side = index % 2 ? -1 : 1;
    const shift = e.anchorShift || 0;
    const flapClosure = ['flap', 'clasp', 'buckle'].includes(s.closure);
    const lidMount = handle && s.handlesCount === 1 && flapClosure;
    const front = handle
      ? flapClosure && s.handlesCount === 1
        ? -1
        : side
      : s.strapCount > 1
        ? side
        : 0;
    let bases;
    const t =
      s.closure === 'drawstring'
        ? 0.7
        : handle && flapClosure
          ? front > 0
            ? 0.47
            : 0.995
          : handle
            ? 0.88
            : 0.87;
    if (lidMount) {
      bases = [c.flapPoint(0.29 + shift * 0.4, 0.25), c.flapPoint(0.71 - shift * 0.4, 0.25)];
    } else if (pack) {
      const angle = Math.PI + side * (0.33 + shift);
      bases = [p.surface(angle, t), p.surface(Math.PI + side * (0.8 + shift), 0.16)];
    } else if (front === 0) {
      bases = [p.surface(-Math.PI / 2 + shift, t), p.surface(Math.PI / 2 - shift, t)];
    } else {
      const a = (handle ? 0.48 : 1.05) + shift;
      bases = [
        p.surface(front > 0 ? -a : Math.PI + a, t),
        p.surface(front > 0 ? a : Math.PI - a, t),
      ];
    }
    const ringR = Math.min(p.w * 0.036, p.h * 0.055, p.d * 0.12);
    const ends = bases.map((at, i) => {
      const suffix = i ? 'b' : 'a',
        tab = id + '_tab_' + suffix,
        ring = id + '_ring_' + suffix;
      const bearing = lidMount ? 0 : Math.atan2(at[0] / p.w, at[2] / p.d);
      const outward = [Math.sin(bearing), 0, Math.cos(bearing)];
      const offset = (height, extension) => [
        at[0] + outward[0] * extension,
        at[1] + height,
        at[2] + outward[2] * extension,
      ];
      const center = offset(ringR * 1.35, ringR * 0.45);
      const ringMesh = mesh(ring, 'D_RING', mountingRing(ringR), m.metal);
      ringMesh.position.set(...center);
      ringMesh.rotation.y = bearing;
      const tangent = [Math.cos(bearing), 0, -Math.sin(bearing)];
      const tabPoint = (u, v) => {
        const width = ringR * 1.65 * (0.77 + 0.23 * Math.sin(v * Math.PI));
        const q = lidMount
          ? offset(ringR * (0.08 + 0.89 * v * v), ringR * (1.6 - 1.13 * v))
          : offset(mix(-ringR * 2.45, ringR * 0.97, v), ringR * (0.25 + 0.22 * v));
        return q.map((n, k) => n + (u - 0.5) * width * tangent[k]);
      };
      mesh(tab, 'FOLDED_TAB', grid(4, 5, tabPoint), leather);
      for (const edge of [0.1, 0.9])
        path(tab, 'TAB_STITCH', 8, (v) => tabPoint(edge, v), ringR * 0.042, m.thread, true);
      const stud = c.hardware(tab, 'RIVET', ringR * 0.27, m.metal);
      stud.position.set(
        ...(lidMount ? offset(ringR * 0.13, ringR * 1.41) : offset(-ringR * 1.68, ringR * 0.38)),
      );
      const tip = offset(ringR * 2.27, ringR * 0.45);
      parts.get(tab).anchors = { sewn: at, loop: center };
      parts.get(ring).anchors = { center, attachment: tip };
      anchor(id + '_' + suffix, tip);
      if (lidMount) {
        const lid = groups.get('closure');
        for (const node of [
          groups.get(tab),
          groups.get(ring),
          c.root.getObjectByName('anchor_' + id + '_' + suffix),
        ])
          lid.attach(node);
      }
      return vec(tip);
    });
    const [a, b] = ends,
      span = a.distanceTo(b),
      axis = b.clone().sub(a).normalize();
    const rise = pack ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    rise.addScaledVector(axis, -rise.dot(axis)).normalize();
    const curveAt = (drop) => {
      const mid = a.clone().lerp(b, 0.5);
      const point = (f, r) =>
        a
          .clone()
          .lerp(b, f)
          .addScaledVector(rise, r * drop);
      return new THREE.CatmullRomCurve3([
        a,
        point(0.045, 0.56),
        point(0.19, 0.9),
        mid.addScaledVector(rise, drop),
        point(0.81, 0.9),
        point(0.955, 0.56),
        b,
      ]);
    };
    let drop = (s.handleDropCm / 100) * (e.lengthScale || 1);
    const requested = (s.strapLengthCm / 100) * (e.lengthScale || 1);
    if (!handle) {
      let lo = 0,
        hi = Math.max(span, requested);
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (curveAt(mid).getLength() < requested) lo = mid;
        else hi = mid;
      }
      drop = Math.max(span * 0.05, (lo + hi) / 2);
    }
    const curve = curveAt(drop),
      w = Math.min(
        (handle ? Math.min(p.w * 0.065, 0.019) : s.strapWidthCm / 100) * (e.widthScale || 1),
        span * 0.27,
      );
    const piv = groups.get(id);
    piv.name = (handle ? 'HANDLE_ANCHOR_' : 'STRAP_ANCHOR_') + (index + 1);
    piv.position.copy(a);
    const local = new THREE.CatmullRomCurve3(curve.points.map((pt) => pt.clone().sub(a)));
    const steps = detail * 3;
    const gauge = Math.min(w * 0.25, p.thickness * 1.8);
    if (handle) {
      const grip = rolledGrip(local, w, gauge, steps);
      mesh(id, 'PADDED_ROLL', grip.surface, m.trim);
      mesh(id, 'FOLDED_SEAM', cord(grip.seam, gauge * 0.13), m.edge);
      mesh(id, 'HANDLE_STITCH', stitches(grip.stitch, gauge * 0.12), m.thread);
      for (const [i, end] of ends.entries()) {
        const bearing = lidMount ? 0 : Math.atan2(bases[i][0] / p.w, bases[i][2] / p.d);
        const billet = (u, v) => {
          const angle = v * TAU;
          const edge = (u - 0.5) * w * 0.67;
          const depth = ringR * Math.sin(angle) * 0.37;
          return [
            end.x - a.x + edge * Math.cos(bearing) + depth * Math.sin(bearing),
            end.y - a.y + ringR * (0.07 + 0.34 * Math.cos(angle)),
            end.z - a.z - edge * Math.sin(bearing) + depth * Math.cos(bearing),
          ];
        };
        mesh(id, 'RETURN_LOOP_' + i, grid(2, 14, billet), m.trim);
      }
    } else {
      const strap = mesh(id, 'FOLDED_LEATHER', ribbon(local, w, gauge, steps), leather);
      // Bind the two long edges of the flat adjustable strap.
      const belt = strap.geometry.attributes.position;
      for (const row of [0, 1]) {
        const points = sampled(steps, (t) => {
          const i = row * (steps + 1) + Math.round(t * steps);
          return [belt.getX(i), belt.getY(i), belt.getZ(i)];
        });
        mesh(id, 'ROLLED_EDGE_' + row, cord(points, p.thickness * 0.32), m.edge);
        if (m.carrier) {
          const seam = points.map((pt, i) =>
            pt.map((x, k) => mix(x, local.getPointAt(i / steps).getComponent(k), 0.085)),
          );
          mesh(id, 'STRAP_STITCH_' + row, stitches(seam, gauge * 0.095), m.thread);
        }
      }
    }
    const centerLine = (u) => local.getPointAt(u);
    const carry = (id2, f) => {
      const g = groups.get(id2);
      piv.add(g);
      g.position.copy(centerLine(f));
      return g;
    };
    if (!handle && s.adjustable) {
      const g = carry(id + '_buckle', 0.19);
      const diameter = w * 0.61;
      const frame = new THREE.CurvePath();
      const shape = new THREE.Shape();
      const hw = diameter,
        hh = w * 0.72,
        rr = w * 0.16;
      shape.moveTo(-hw + rr, -hh);
      shape.lineTo(hw - rr, -hh);
      shape.quadraticCurveTo(hw, -hh, hw, -hh + rr);
      shape.lineTo(hw, hh - rr);
      shape.quadraticCurveTo(hw, hh, hw - rr, hh);
      shape.lineTo(-hw + rr, hh);
      shape.quadraticCurveTo(-hw, hh, -hw, hh - rr);
      shape.lineTo(-hw, -hh + rr);
      shape.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
      const points = shape.getPoints(4);
      for (let i = 1; i < points.length; i++)
        frame.add(
          new THREE.LineCurve3(
            new THREE.Vector3(points[i - 1].x, points[i - 1].y, 0),
            new THREE.Vector3(points[i].x, points[i].y, 0),
          ),
        );
      mesh(
        id + '_buckle',
        'ADJUSTMENT_FRAME',
        new THREE.TubeGeometry(frame, 36, w * 0.065, 7, true),
        m.metal,
      );
      const bar = mesh(
        id + '_buckle',
        'BUCKLE_BAR',
        new THREE.CylinderGeometry(w * 0.064, w * 0.064, w * 1.19, 8),
        m.metal,
      );
      bar.rotation.z = Math.PI / 2;
      const tangent = local.getTangentAt(0.19);
      const across = new THREE.Vector3(0, 0, 1);
      if (Math.abs(across.dot(tangent)) > 0.87) across.set(1, 0, 0);
      across.addScaledVector(tangent, -across.dot(tangent)).normalize();
      const normal = new THREE.Vector3().crossVectors(across, tangent);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, tangent, normal));
      g.position.addScaledVector(normal, gauge * 0.62);
    }
    if (!handle && s.detachable) {
      const g = groups.get(id + '_clips');
      piv.add(g);
      for (const f of [0.012, 0.988]) {
        const hook = mesh(
          id + '_clips',
          'SWIVEL_CLIP',
          new THREE.TorusGeometry(ringR * 0.69, ringR * 0.18, 6, 16),
          m.metal,
        );
        hook.position.copy(centerLine(f));
        hook.scale.y = 1.6;
      }
    }
    part.anchors = { a: a.toArray(), b: b.toArray(), carry: curve.getPointAt(0.5).toArray() };
    part.connections = [id + '_ring_a', id + '_ring_b'];
    part.geometryConstraints = {
      requestedLengthM: handle ? null : requested,
      actualCenterlineM: curve.getLength(),
      minimumSpanM: span,
      widthM: w,
      construction: handle ? 'padded-roll-with-return-loops' : 'bound-flat-strap',
      handleDropM: drop,
    };
    const swingLimit = !handle && s.style === 'coiled' ? 92 : 32;
    part.range = {
      unit: 'degrees',
      min: -swingLimit * c.limit(id),
      max: swingLimit * c.limit(id),
      axis: axis.toArray(),
    };
    anchor(id + '_carry', part.anchors.carry, piv, a);
    if (lidMount) {
      groups.get('closure').attach(piv);
      part.attachmentFrame = 'closure';
    }
    motions.swing.push((amount) =>
      piv.quaternion.setFromAxisAngle(axis, (amount * part.range.max * Math.PI) / 180),
    );
  }
}
export function buildClosure(c) {
  const { p, s, m, parts, groups, mesh, sheet, path, detail, motions, edits } = c;
  if (s.closure === 'open') return;
  if (s.closure === 'scroll_snap') return buildScrollFlap(c);
  const part = parts.get('closure'),
    group = groups.get('closure');
  const factor =
      s.closure === 'zipper'
        ? Math.min(c.limit('closure'), c.limit('zip_slider'))
        : c.limit('closure'),
    size = Math.min(p.w * 0.045, p.h * 0.071, p.d * 0.16);
  if (['flap', 'clasp', 'buckle'].includes(s.closure)) {
    const hinge = p.lip(0, true);
    group.position.set(...hinge);
    group.name = 'CLOSURE_HINGE';
    const local = (a) => a.map((n, k) => n - hinge[k]);
    const length = (s.flapLength / 100) * (edits.closure?.lengthScale || 1);
    const flap = (u, v) => {
      const q = (u * 2 - 1) * (s.style === 'structured' ? 0.66 : 0.78),
        edge = Math.abs(2 * u - 1);
      const back = p.lip(q, true),
        front = p.lip(q, false);
      if (v <= 0.47) {
        const f = v / 0.47,
          rail = [back[0], hinge[1], hinge[2]];
        const point = blend(rail, front, f);
        point[1] += p.thickness * (1.5 + Math.sin(f * Math.PI) * 1.65);
        return local(point);
      }
      const f = (v - 0.47) / 0.53;
      const shape =
        s.style === 'clutch'
          ? 0.95
          : s.style === 'saddle'
            ? 0.74
            : s.style === 'structured'
              ? 0.55
              : 0.24;
      const t = 1 - f * length * (1 - shape * edge ** 2);
      const point = p.lip(q * (1 - 0.075 * f ** 3), false, t, -p.thickness * 1.15);
      point[1] += p.thickness * 1.5 * (1 - f);
      return local(point);
    };
    c.flapPoint = (u, v) => flap(u, v).map((n, k) => n + hinge[k]);
    mesh('closure', 'FLAP_OUTER', grid(detail * 2, 18, flap), m.skin);
    const under = (u, v) => {
      const q = flap(u, v);
      q[1] -= p.thickness * 0.65;
      q[2] -= p.thickness * 0.45;
      return q;
    };
    mesh('closure', 'FLAP_LINER', grid(detail, 12, under, true), m.trim);
    for (const [name, fn] of [
      ['TIP', (u) => flap(u, 1)],
      ['L', (u) => flap(0, u)],
      ['R', (u) => flap(1, u)],
    ]) {
      path('closure', 'FLAP_WELT_' + name, detail * 2, fn, p.thickness * 0.56, m.edge);
    }
    path(
      'closure',
      'SADDLE_STITCH',
      detail * 4,
      (u) => {
        const pt = flap(0.018 + 0.964 * u, 0.97);
        pt[2] += p.thickness * 0.32;
        return pt;
      },
      p.thickness * 0.18,
      m.thread,
      true,
    );
    // The straight hinge rail is fixed to two sewn knuckles on the rear panel.
    for (const side of [-1, 1]) {
      const seat = p.lip(side * 0.48, true, 0.95);
      const cap = [seat[0], hinge[1], hinge[2]];
      path('opening', 'HINGE_KNUCKLE', 6, (t) => blend(seat, cap, t), p.thickness * 0.83, m.trim);
    }
    let release = (n) => n;
    if (parts.has('turn_button')) {
      release = buildTurnLock(c, hinge, 1 - length, size);
    } else {
      const lock =
        s.closure === 'buckle'
          ? mesh(
              'closure',
              'BUCKLE_FRAME',
              new THREE.TorusGeometry(size * 0.95, size * 0.14, 7, 18),
              m.metal,
            )
          : mesh('closure', 'TURN_LOCK', brassPlate(size * 2.4, size * 1.35, size * 0.19), m.metal);
      lock.scale.set(1, s.closure === 'buckle' ? 1.23 : 0.73, s.closure === 'buckle' ? 1 : 0.36);
      lock.position.set(...flap(0.5, 0.91));
      lock.position.z += p.thickness * 0.68;
      const tongue = mesh(
        'closure',
        'LOCK_BAR',
        brassPlate(size * 1.2, size * 0.4, size * 0.27),
        m.metal,
      );
      tongue.position.copy(lock.position);
      tongue.position.z += size * 0.22;
      for (const sign of [-1, 1]) {
        const screw = c.hardware('closure', 'LOCK_RIVET', size * 0.11, m.zip);
        screw.position.copy(lock.position);
        screw.position.x += sign * size * 0.9;
        screw.position.z += size * 0.16;
        screw.scale.z = 0.34;
      }
    }
    part.anchors = {
      hinge,
      axisStart: [p.lip(-0.48, true)[0], hinge[1], hinge[2]],
      axisEnd: [p.lip(0.48, true)[0], hinge[1], hinge[2]],
    };
    part.range = { unit: 'degrees', min: 0, max: 112 * factor * release(1), axis: [-1, 0, 0] };
    motions.open.push((n) => (group.rotation.x = (-release(n) * part.range.max * Math.PI) / 180));
  } else if (s.closure === 'zipper') {
    const point = (u, v, back, open) => {
      const q = (u * 2 - 1) * 0.995,
        a = p.lip(q, back),
        b = p.lip(q, !back);
      const gap = 0.004 + 0.75 * clamp((open - u) * 9, 0, 1);
      const pt = blend(a, b, (v * (1 - gap)) / 2);
      pt[1] += p.thickness * (0.6 + 1.4 * v);
      return pt;
    };
    const tracks = [],
      teeth = [];
    for (const back of [false, true]) {
      for (const [name, lo, hi, mat] of [
        ['ZIP_TAPE', 0, 0.9, m.trim],
        ['ZIP_CHAIN', 0.9, 1, m.zip],
      ]) {
        const fn = (u, v, n) => point(u, mix(lo, hi, v), back, n);
        const g = grid(detail * 3, 2, (u, v) => fn(u, v, 0), !back);
        mesh('closure', name, g, mat);
        tracks.push([g, fn]);
      }
      const links = zipperTeeth(
        detail * 4,
        (u, v, n) => {
          const pt = point(u, 0.94 + 0.065 * v, back, n);
          pt[1] += p.thickness * 0.21;
          return pt;
        },
        !back,
      );
      mesh('closure', back ? 'BACK_TEETH' : 'FRONT_TEETH', links.geometry, m.metal);
      teeth.push(links);
    }
    const center = (u) => blend(point(u, 1, false, u), point(u, 1, true, u), 0.5);
    const pull = c.hardware('zip_slider', 'ZIPPER_SLIDER', size * 0.73, m.metal);
    pull.scale.set(1.3, 0.48, 1.1);
    const tab = mesh(
      'zip_slider',
      'ZIP_PULL_TAB',
      new THREE.TorusGeometry(size * 0.54, size * 0.13, 6, 14),
      m.metal,
    );
    const move = (n) => {
      const pos = center(n);
      pull.position.set(...pos);
      tab.position.set(pos[0] - size * 0.65, pos[1] + size * 0.25, pos[2]);
      tab.rotation.x = Math.PI / 2;
      for (const [g, fn] of tracks) updateGrid(g, detail * 3, 2, (u, v) => fn(u, v, n));
      for (const links of teeth) links.update(n);
    };
    part.anchors = { start: center(0), end: center(1) };
    part.range = { unit: 'path-fraction', min: 0, max: factor, points: sampled(20, center) };
    parts.get('zip_slider').anchors = part.anchors;
    parts.get('zip_slider').range = part.range;
    motions.open.push((n) => move(n * factor));
  } else if (s.closure === 'drawstring') {
    const at = (u, o) => p.surface(u * TAU, 0.925, -p.thickness * 1.2, o);
    path('closure', 'DRAW_CORD', detail * 4, at, p.thickness * 0.82, m.trim);
    for (const sign of [-1, 1]) {
      const end = (u, o) => {
        const q = p.surface(sign * 0.12, 0.925, -p.thickness * 1.1, o);
        q[0] += sign * u * p.w * 0.075;
        q[1] -= u * p.h * (0.29 + (1 - o) * 0.2);
        q[2] += p.d * 0.11 * Math.sin(Math.PI * u) + p.thickness * 2;
        return q;
      };
      path('closure', 'CORD_END', 12, end, p.thickness * 0.83, m.trim);
      const tip = c.hardware('closure', 'AGLET', size * 0.31, m.metal);
      motions.open.push((n) => tip.position.set(...end(1, n * factor)));
    }
    part.anchors = { mouth: p.surface(0, 0.925) };
    part.range = { unit: 'opening-fraction', min: 0, max: factor };
  } else {
    // Snap/button lips meet at the central short bridge and separate on release.
    const fixed = p.lip(0, true, 1),
      loose = p.lip(0, false, 1);
    const fn = (u, v, n) => {
      const q = blend(fixed, blend(loose, fixed, n * 0.78), v);
      q[0] += (u - 0.5) * size * 1.8;
      q[1] += p.thickness + Math.sin(Math.PI * v) * n * p.h * 0.11;
      return q;
    };
    const g = grid(4, 14, (u, v) => fn(u, v, 0));
    mesh('closure', 'SNAP_TAB', g, m.trim);
    const stud = c.hardware(
      'closure',
      'PRESS_STUD',
      size * 0.53,
      s.closure === 'button' ? m.plastic : m.metal,
    );
    stud.scale.set(1, 0.26, 1);
    motions.open.push((n) => {
      updateGrid(g, 4, 14, (u, v) => fn(u, v, n * factor));
      stud.position.set(...fn(0.5, 0.96, n * factor));
    });
    part.anchors = { sewn: fixed, socket: loose };
    part.range = { unit: 'release-fraction', min: 0, max: factor };
  }
}
