import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildModularBag } from '../bag-model.js';
import { FAMILY_PRESETS, TAU } from '../bag-patterns.js';
import {
  newProject,
  correctPart,
  changeStructure,
  EditHistory,
  approveProject,
  interpretCommand,
} from '../bag-editor.js';

test('nine patterns close shared seams, respect dimensions and bound a real cavity', () => {
  const fingerprints = new Set();
  for (const [style, preset] of Object.entries(FAMILY_PRESETS)) {
    const m = buildModularBag({ ...preset, style, mainCompartments: 4 }, { profile: 'mobile' });
    const { pattern: p, graph } = m,
      ids = new Set(graph.parts.map((v) => v.id));
    assert.equal(ids.size, graph.parts.length);
    for (const part of graph.parts) {
      assert.ok(!part.parent || ids.has(part.parent));
      for (const target of part.connections) assert.ok(ids.has(target));
      assert.ok(part.dimensions.width >= 0);
    }
    assert.equal(graph.parts.filter((x) => x.role === 'compartment').length, 4);
    assert.equal(graph.parts.filter((x) => x.role === 'interior_partition').length, 3);
    const front = m.groups.get('front_panel').children[0].geometry;
    const right = m.groups.get('right_gusset').children[0].geometry;
    // The width columns of a flat panel and the winding of a cord panel have
    // different indices. Check their actual boundary vertices in metres.
    const contains = (geo, expected) => {
      const a = geo.attributes.position,
        pt = new THREE.Vector3();
      for (let i = 0; i < a.count; i++)
        if (pt.fromBufferAttribute(a, i).distanceTo(expected) < 1e-6) return true;
      return false;
    };
    const seamSegments = style === 'coiled' ? 6 : 9;
    for (let j = 0; j <= seamSegments; j++) {
      const edge = new THREE.Vector3(...p.surface(Math.PI / 4, j / seamSegments, 0, 0));
      assert.ok(contains(front, edge) && contains(right, edge), style + ' seam ' + j);
    }
    fingerprints.add(
      [0.05, 0.3, 0.55, 0.83, 1].map((t) => p.surface(Math.PI / 2, t)[0] / p.w).join(','),
    );
    for (let i = 0; i < 40; i++) {
      const edge = p.surface((TAU * i) / 40, 0.37),
        v = p.volume(0.65 * Math.sin(i), 0.65 * Math.cos(i), 0.37);
      assert.ok(Math.abs(edge[0]) <= p.w / 2 + 1e-8 && Math.abs(edge[2]) <= p.d / 2 + 1e-8);
      assert.ok(Math.abs(v[0]) < p.w / 2 && Math.abs(v[2]) < p.d / 2);
    }
    m.root.traverse((o) => {
      if (!o.isMesh) return;
      for (const key of ['position', 'normal', 'uv'])
        assert.ok(o.geometry.attributes[key].array.every(Number.isFinite));
    });
    assert.ok(graph.performance.triangles < 50000);
    assert.ok(graph.performance.draws < 130);
    m.dispose();
    m.dispose();
  }
  assert.equal(fingerprints.size, 9);
});
test('depth moves gussets, floor, dividers, pockets and carrying mounts', () => {
  const a = buildModularBag({ depthCm: 8 }),
    b = buildModularBag({ depthCm: 15 });
  for (const id of [
    'right_gusset',
    'bottom_panel',
    'lining',
    'handle_1_ring_a',
    'inner_open_pocket_1',
  ]) {
    const x = a.parts.find((p) => p.id === id),
      y = b.parts.find((p) => p.id === id);
    assert.ok(
      Math.abs(x.position[2] - y.position[2]) + Math.abs(x.dimensions.depth - y.dimensions.depth) >
        0.0005,
      id,
    );
  }
  assert.deepEqual(
    a.parts.find((x) => x.role === 'compartment').geometryConstraints.normalizedDepthInterval,
    [-1, 0],
  );
  a.dispose();
  b.dispose();
});
test('carrier swing preserves both endpoints across every carrying mode and clamps joint angles', () => {
  for (const mode of ['hand', 'shoulder', 'crossbody', 'backpack']) {
    const model = buildModularBag({ strapType: mode, strapCount: 2 });
    for (const part of model.parts.filter((p) => p.role === 'strap' || p.role === 'handle')) {
      const g = model.groups.get(part.id),
        a = new THREE.Vector3(...part.anchors.a),
        b = new THREE.Vector3(...part.anchors.b);
      const localB = b.clone().sub(a);
      for (const amount of [-7, 0.6, 5]) {
        model.setSwing(amount);
        model.root.updateMatrixWorld(true);
        assert.ok(a.distanceTo(g.localToWorld(new THREE.Vector3())) < 1e-8);
        assert.ok(b.distanceTo(g.localToWorld(localB.clone())) < 1e-8);
        assert.ok(g.quaternion.angleTo(new THREE.Quaternion()) <= (32 * Math.PI) / 180 + 1e-7);
      }
    }
    model.dispose();
  }
});
test('closure, pocket travel, morphology and constrained history change the built geometry', () => {
  for (const closure of ['flap', 'clasp', 'zipper', 'button', 'magnetic', 'drawstring', 'buckle']) {
    const model = buildModularBag({ closure }, { edits: { closure: { motionLimit: 0.5 } } });
    const g = model.groups.get('closure'),
      fixed = model.groups.get('bottom_panel').matrix.clone();
    const slider = model.groups.get('inner_zip_pocket_1_slider').children[0],
      origin = slider.position.clone();
    model.setOpening(3);
    model.setPockets(1);
    assert.ok(slider.position.distanceTo(origin) > 0.001);
    assert.ok(model.groups.get('bottom_panel').matrix.equals(fixed));
    if (closure === 'flap') assert.ok(Math.abs(g.rotation.x + (56 * Math.PI) / 180) < 1e-7);
    if (closure === 'drawstring')
      assert.equal(model.groups.get('front_panel').children[0].morphTargetInfluences[0], 0.5);
    model.dispose();
  }
  const proj = newProject({ strapCount: 1 }),
    h = new EditHistory(proj);
  h.apply(
    correctPart(proj, 'strap_1', { widthScale: 90, visible: false, behavior: 'flexible' }, [
      'front-id',
    ]),
  );
  assert.equal(h.present.edits.strap_1.widthScale, 1.5);
  h.undo();
  assert.deepEqual(h.present, proj);
  h.redo();
  const next = interpretCommand('Increase the bag depth', h.present, 'front_panel');
  h.apply(next);
  assert.equal(h.present.spec.depthCm, 12);
  assert.equal(h.present.feedback.length, 2);
  assert.ok(
    approveProject(h.present).feedback.every(
      (f) => f.approval === 'merchant-approved' && !f.trainingConsent,
    ),
  );
  assert.equal(changeStructure(approveProject(h.present), { widthCm: 47 }).approval, 'unreviewed');
});
test('a satchel handle and both mounts follow the flap throughout its travel', () => {
  const m = buildModularBag({ ...FAMILY_PRESETS.structured, style: 'structured' });
  const lid = m.groups.get('closure'),
    handle = m.groups.get('handle_1'),
    part = m.parts.find((p) => p.id === 'handle_1');
  assert.equal(part.parent, 'closure');
  assert.equal(handle.parent, lid);
  const delta = new THREE.Vector3(...part.anchors.b).sub(new THREE.Vector3(...part.anchors.a));
  for (const amount of [0, 0.3, 0.7, 1]) {
    m.setOpening(amount);
    m.setSwing(0.7);
    m.root.updateMatrixWorld(true);
    const a = m.root.getObjectByName('anchor_handle_1_a').getWorldPosition(new THREE.Vector3());
    const b = m.root.getObjectByName('anchor_handle_1_b').getWorldPosition(new THREE.Vector3());
    assert.ok(a.distanceTo(handle.localToWorld(new THREE.Vector3())) < 1e-7);
    assert.ok(b.distanceTo(handle.localToWorld(delta.clone())) < 1e-7);
  }
  m.dispose();
});
test('acyclic parents, unlinked references, fixed zipper and compartment bounds at minimum dimensions', () => {
  const m = buildModularBag(
    {
      style: 'bucket',
      closure: 'zipper',
      lining: 'none',
      cardSlots: 4,
      accessoryPockets: 2,
      mainCompartments: 5,
    },
    {
      edits: { zip_slider: { moving: false } },
      images: [
        { id: 'relink', view: 'front', url: null },
        { id: 'owner', view: 'pockets' },
      ],
    },
  );
  const map = new Map(m.parts.map((p) => [p.id, p]));
  for (const p of map.values()) {
    const seen = new Set();
    let n = p;
    while (n) {
      assert.ok(!seen.has(n.id));
      seen.add(n.id);
      n = map.get(n.parent);
    }
  }
  assert.equal(map.get('front_panel').verification, 'inferred');
  assert.deepEqual(map.get('card_slot_1').sourceEvidence, ['owner']);
  assert.equal(map.get('closure').range.max, 0);
  assert.ok(!m.graph.animations.some((a) => a.channel === 'opening'));
  assert.ok(!map.has('lining'));
  assert.equal([...map.values()].filter((p) => p.role === 'compartment').length, 5);
  const thin = buildModularBag({
    style: 'hobo',
    widthCm: 8,
    heightCm: 6,
    depthCm: 2,
    panelThicknessMm: 6,
    baseCurve: 90,
    mainCompartments: 5,
  });
  for (const n of thin.parts.filter((p) => p.role === 'interior_partition')) {
    const g = thin.groups.get(n.id).children[0].geometry.attributes.position;
    for (let i = 0; i < g.count; i++)
      assert.ok(
        Math.abs(g.getX(i)) <= 0.04001 &&
          Math.abs(g.getZ(i)) <= 0.01001 &&
          g.getY(i) >= 0 &&
          g.getY(i) < 0.06,
      );
  }
  thin.dispose();
  m.dispose();
});

test('corded construction changes pitch, holds the sewn rear hinge and separates the two scrolls', () => {
  const fine = buildModularBag(
    { ...FAMILY_PRESETS.coiled, cordDiameterMm: 4 },
    { profile: 'mobile' },
  );
  const bag = buildModularBag(FAMILY_PRESETS.coiled, {
    profile: 'mobile',
    images: [{ id: 'inside-photo', view: 'inside', url: 'blob:local' }],
  });
  const part = (m, id) => m.parts.find((p) => p.id === id);
  assert.ok(
    part(fine, 'front_panel').geometryConstraints.courseCount >
      part(bag, 'front_panel').geometryConstraints.courseCount,
  );
  assert.ok(fine.graph.performance.triangles < 50000);
  const bridge = bag.root.getObjectByName('closure__WOVEN_HINGE_BRIDGE');
  const facing = bag.root.getObjectByName('opening__SEWN_HINGE_FACING');
  const local = (g, i) => new THREE.Vector3().fromBufferAttribute(g, i);
  for (const progress of [0, 0.25, 0.8, 1]) {
    bag.setOpening(progress);
    bag.root.updateMatrixWorld(true);
    for (const i of [0, 6, 12]) {
      const seam = local(bridge.geometry.attributes.position, i).lerp(
        local(bridge.geometry.morphAttributes.position[0], i),
        progress,
      );
      const fixed = facing.localToWorld(local(facing.geometry.attributes.position, 65 + i));
      assert.ok(bridge.localToWorld(seam).distanceTo(fixed) < 1e-6);
    }
    const flap = bag.groups.get('scroll_left').children[0];
    assert.equal(flap.morphTargetInfluences[0], progress);
    assert.equal(bag.groups.get('scroll_right').parent, bag.groups.get('closure'));
  }
  assert.deepEqual(part(bag, 'insert_pouch').sourceEvidence, ['inside-photo']);
  assert.equal(part(bag, 'scroll_left').verification, 'inferred');
  assert.equal(bag.graph.verification.photoGeometryVerified, false);
  fine.dispose();
  bag.dispose();
});

test('zip insert travel opens a real gap and stays inside its assigned compartment', () => {
  const bag = buildModularBag({ ...FAMILY_PRESETS.coiled, mainCompartments: 3 });
  const slider = bag.groups.get('insert_slider'),
    start = slider.position.clone();
  const tape = bag.root.getObjectByName('insert_pouch__ZIP_TAPE_1');
  const other = bag.root.getObjectByName('insert_pouch__ZIP_TAPE_-1');
  const gap = () => {
    const index = tape.geometry.attributes.position.count - 1 - 30;
    return Math.abs(
      tape.geometry.attributes.position.getZ(index) -
        other.geometry.attributes.position.getZ(index),
    );
  };
  const closed = gap();
  bag.setPockets(1);
  assert.ok(slider.position.distanceTo(start) > 0.08);
  assert.ok(gap() > closed + 0.001);
  assert.equal(
    bag.parts.find((p) => p.id === 'insert_pouch').geometryConstraints.compartment,
    'compartment_1',
  );
  assert.equal(bag.parts.find((p) => p.id === 'insert_slider').range.points.length, 16);
  bag.setPockets(0);
  assert.ok(slider.position.distanceTo(start) < 1e-7);
  bag.dispose();
});

test('quarter turn releases before lifting and the keeper stays on the body', () => {
  const bag = buildModularBag(FAMILY_PRESETS.structured),
    keeper = bag.groups.get('lock_keeper');
  const fixed = keeper.children[0].getWorldPosition(new THREE.Vector3());
  bag.setOpening(0.25);
  assert.equal(bag.groups.get('closure').rotation.x + 0, 0);
  assert.equal(bag.groups.get('turn_button').rotation.z, Math.PI / 2);
  bag.setOpening(1);
  bag.root.updateMatrixWorld(true);
  assert.ok(keeper.children[0].getWorldPosition(new THREE.Vector3()).distanceTo(fixed) < 1e-7);
  assert.ok(bag.groups.get('closure').rotation.x < -1.5);
  assert.equal(
    bag.parts.find((p) => p.id === 'handle_1').geometryConstraints.construction,
    'padded-roll-with-return-loops',
  );
  bag.dispose();
});
