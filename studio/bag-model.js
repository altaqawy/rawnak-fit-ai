// Measured construction and rig in metres. No camera or AR runtime dependency.
import * as THREE from 'three';
import { createBagSpec, describeBagComponents } from './bag-spec.js';
import { makePattern, clamp } from './bag-patterns.js';
import { grid, cord, stitches, sampled } from './bag-surfaces.js';
import { makeMaterials, reliefArtwork } from './bag-materials.js';
import { buildPouchInsert } from './bag-insert.js';
import { buildShell, buildPockets } from './bag-shell.js';
import { buildCarriers, buildClosure } from './bag-mechanisms.js';
import { cleanEdit } from './bag-editor.js';

export function buildModularBag(input = {}, options = {}) {
  const s = createBagSpec(input),
    p = makePattern(s, options.fit?.widths);
  const root = new THREE.Group();
  root.name = 'RAWNAK_MODULAR_BAG';
  const parts = new Map(),
    groups = new Map(),
    edits = {},
    materials = new Set(),
    variants = new Map();
  const maps = options.maps || {},
    m = makeMaterials(s, maps);
  Object.values(m).forEach((mat) => materials.add(mat));
  const list = describeBagComponents(s),
    refs = options.images || [];
  const motions = { open: [], swing: [], pockets: [] },
    morphs = [],
    anchors = {},
    detail = options.profile === 'mobile' ? 10 : 16;
  const profile = options.profile === 'mobile' ? 'mobile' : 'detail';
  for (const source of list) {
    const edit = cleanEdit(source, options.edits?.[source.id]);
    edits[source.id] = edit;
    const hits = refs.filter(
      (img) => img.linked !== false && img.url !== null && source.requires.includes(img.view),
    );
    const part = {
      ...source,
      behavior: edit.behavior || source.behavior,
      rigidity: edit.behavior || source.behavior,
      flexibility: source.role === 'panel' ? s.flexibility : null,
      moving: edit.moving ?? source.moving,
      mobility: (edit.moving ?? source.moving) ? 'movable' : 'fixed',
      animationImplemented: source.moving && edit.moving !== false,
      position: [0, 0, 0],
      orientation: [0, 0, 0, 1],
      dimensions: { width: 0, height: 0, depth: 0 },
      thicknessM: ['panel', 'side', 'bottom', 'interior_partition', 'interior'].includes(
        source.role,
      )
        ? p.thickness
        : null,
      anchors: {},
      connections: source.parent ? [source.parent] : [],
      visible: edit.visible !== false,
      geometryConstraints: { pattern: s.style, boundedToParent: true },
      range: null,
      sourceEvidence: hits.map((i) => i.id || i.name),
      verification: hits.length ? 'reference-available' : 'inferred',
      confidence: null,
      overrides: edit,
    };
    parts.set(part.id, part);
    const g = new THREE.Group();
    g.name = part.id;
    g.userData = { partId: part.id };
    groups.set(part.id, g);
    root.add(g);
  }
  function mesh(id, name, geometry, material) {
    const edit = edits[id];
    if (edit?.roughness !== undefined) {
      const key = id + '_' + material.uuid;
      if (!variants.has(key)) {
        const mat = material.clone();
        mat.roughness = edit.roughness;
        variants.set(key, mat);
        materials.add(mat);
      }
      material = variants.get(key);
    }
    const o = new THREE.Mesh(geometry, material);
    o.name = id + '__' + name;
    o.userData = { partId: id };
    if (material.aoMap) geometry.setAttribute('uv1', geometry.attributes.uv.clone());
    groups.get(id).add(o);
    return o;
  }
  function deformable(id, name, make, mat, affected) {
    const geom = make(0);
    if (s.closure === 'drawstring' && affected) {
      const target = make(1);
      geom.morphAttributes.position = [target.attributes.position];
      geom.morphAttributes.normal = [target.attributes.normal];
      target.dispose();
    }
    const obj = mesh(id, name, geom, mat);
    if (obj.morphTargetInfluences?.length) {
      obj.morphTargetDictionary = { open: 0 };
      morphs.push(obj);
    }
    return obj;
  }
  const sheet = (id, name, n, k, fn, mat, reverse = false) =>
    deformable(id, name, (o) => grid(n, k, (u, v) => fn(u, v, o), reverse), mat, fn.length > 2);
  const path = (id, name, count, fn, radius, mat, dashed = false) =>
    deformable(
      id,
      name,
      (o) =>
        (dashed ? stitches : cord)(
          sampled(count, (t) => fn(t, o)),
          radius,
        ),
      mat,
      fn.length > 1,
    );
  function anchor(name, point, parent = root, origin = null) {
    const node = new THREE.Object3D();
    node.name = 'anchor_' + name;
    node.position.set(...point);
    if (origin) node.position.sub(origin);
    node.userData = { anchor: name };
    parent.add(node);
    anchors[name] = { node: node.name, position: point };
  }
  const hardware = (id, name, r, mat) => mesh(id, name, new THREE.SphereGeometry(r, 12, 8), mat);
  const limit = (id) => (edits[id]?.moving === false ? 0 : (edits[id]?.motionLimit ?? 1));
  const c = {
    root,
    p,
    s,
    m,
    mesh,
    sheet,
    path,
    parts,
    groups,
    edits,
    detail,
    motions,
    anchor,
    hardware,
    limit,
  };
  buildShell(c);
  buildPockets(c);
  if (s.zipInsert) buildPouchInsert(c);
  buildClosure(c);
  buildCarriers(c);
  anchor('base', p.volume(0, 0, 0, 0));
  anchor('opening', p.volume(0, 0, 1, 0));
  const roundBadge = s.logoType === 'round_patch';
  const badgeRadius = Math.min(p.w * 0.047, p.h * 0.071, p.d * 0.17);
  function badgePosition(lift) {
    const inside = s.logoPlacement === 'inside';
    const angle = s.logoPlacement === 'front' ? 0 : Math.PI;
    const offset = inside
      ? p.thickness * 1.8 + lift
      : -(p.thickness * 0.55 + (p.family.corded ? s.cordDiameterMm * 0.00035 : 0) + lift);
    return p.surface(angle, inside ? 0.64 : 0.3, offset);
  }
  let logo = null;
  function setLogoTexture(texture) {
    if (!parts.has('brand_mark')) return;
    const used = s.brandLicenseConfirmed ? texture : null;
    const material = logo?.material || m.art;
    if (material.map && material.map !== used) material.map.dispose();
    material.normalMap?.dispose();
    material.normalMap = null;
    material.color.set('#ffffff');
    material.map = used;
    if (used && ['embossed', 'debossed'].includes(s.logoType)) {
      const relief = reliefArtwork(used, s.logoType === 'debossed');
      material.map = relief.color;
      material.normalMap = relief.normal;
      material.color.set(s.bodyColor);
      material.roughness = m.skin.roughness;
    }
    material.needsUpdate = true;
    if (logo) {
      groups.get('brand_mark').remove(logo);
      logo.geometry.dispose();
      logo = null;
    }
    if (!used) return;
    const aspect = (used.image?.width || 2) / (used.image?.height || 1);
    const width = roundBadge
        ? badgeRadius * 1.46 * Math.min(aspect, 1)
        : Math.min(p.w * 0.25, p.h * 0.14 * aspect),
      height = width / aspect;
    const back = s.logoPlacement !== 'front',
      inside = s.logoPlacement === 'inside';
    const angle = back ? Math.PI : 0,
      t = inside ? 0.64 : 0.3,
      center = roundBadge
        ? badgePosition(p.thickness * 0.7)
        : p.surface(angle, t, inside ? p.thickness * 2 : -p.thickness);
    logo = mesh('brand_mark', 'BRAND_MARK_IMAGE', new THREE.PlaneGeometry(width, height), material);
    logo.position.set(...center);
    if (back && !inside) logo.rotation.y = Math.PI;
    logo.renderOrder = 1;
  }
  if (parts.has('brand_mark')) {
    if (roundBadge) {
      const badge = mesh(
        'brand_mark',
        'ROUND_LEATHER_BADGE',
        new THREE.CylinderGeometry(badgeRadius, badgeRadius, p.thickness * 0.75, 28),
        m.badge,
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.set(...badgePosition(p.thickness * 0.26));
      const at = badgePosition(p.thickness * 0.69);
      path(
        'brand_mark',
        'BADGE_STITCH',
        24,
        (t) => [
          at[0] + Math.cos(t * 2 * Math.PI) * badgeRadius * 0.82,
          at[1] + Math.sin(t * 2 * Math.PI) * badgeRadius * 0.82,
          at[2],
        ],
        p.thickness * 0.14,
        m.thread,
        true,
      );
    }
    if (['metal', 'patch'].includes(s.logoType)) {
      const inside = s.logoPlacement === 'inside',
        angle = s.logoPlacement === 'front' ? 0 : Math.PI;
      sheet(
        'brand_mark',
        'BRAND_BACKING',
        10,
        4,
        (u, v) =>
          p.surface(
            angle + (u - 0.5) * 0.4,
            0.24 + v * 0.12,
            inside ? p.thickness * 1.8 : -p.thickness * 0.72,
          ),
        s.logoType === 'metal' ? m.metal : m.trim,
      );
      if (s.logoType === 'patch') {
        for (const t of [0.245, 0.355])
          path(
            'brand_mark',
            'PATCH_STITCH',
            22,
            (u) =>
              p.surface(
                angle + (u - 0.5) * 0.38,
                t,
                inside ? p.thickness * 2 : -p.thickness * 0.81,
              ),
            p.thickness * 0.13,
            m.thread,
            true,
          );
      }
    }
    setLogoTexture(maps.logo);
  }
  let disposed = false,
    cut = false;
  function visibility() {
    for (const part of parts.values()) {
      let v = true,
        up = part;
      while (up) {
        if (!up.visible) {
          v = false;
          break;
        }
        up = parts.get(up.parent);
      }
      if (
        cut &&
        (part.id.startsWith('seam_') ||
          ['corner_guard', 'lock_keeper', 'turn_button', 'snap_receiver'].includes(part.role))
      )
        v = false;
      if (cut && ['front_panel', 'piping', 'opening', 'closure', 'brand_mark'].includes(part.id))
        v = false;
      if (
        cut &&
        (part.role === 'outer_pocket' ||
          part.id.startsWith('handle_') ||
          part.id.startsWith('strap_'))
      )
        v = false;
      groups.get(part.id).visible = v;
    }
    // Front shell and front lining are cut together. Other cavity surfaces stay intact.
    for (const mat of materials) {
      mat.clippingPlanes = cut ? [new THREE.Plane(new THREE.Vector3(0, 0, -1), p.d * 0.16)] : null;
      mat.clipIntersection = false;
    }
  }
  const unit = (n) => clamp(Number(n) || 0, 0, 1);
  function setOpening(value) {
    const n = unit(value);
    for (const fn of motions.open) fn(n);
    for (const o of morphs) o.morphTargetInfluences[0] = n * limit('closure');
  }
  const setSwing = (n) => motions.swing.forEach((fn) => fn(clamp(Number(n) || 0, -1, 1)));
  const setPockets = (n) => motions.pockets.forEach((fn) => fn(unit(n)));
  setOpening(0);
  setSwing(0);
  setPockets(0);
  visibility();
  root.updateMatrixWorld(true);
  let triangles = 0,
    draws = 0;
  for (const part of parts.values()) {
    const group = groups.get(part.id),
      bounds = new THREE.Box3();
    group.traverse((o) => {
      if (!o.isMesh || o.userData.partId !== part.id) return;
      o.geometry.computeBoundingBox();
      bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      if (group.visible) {
        triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
        draws++;
      }
    });
    if (!bounds.isEmpty()) {
      const size = bounds.getSize(new THREE.Vector3());
      part.dimensions = { width: size.x, height: size.y, depth: size.z };
      part.position = bounds.getCenter(new THREE.Vector3()).toArray();
    }
    part.node = group.name;
    part.includedInGLB = group.visible;
    part.orientation = group.getWorldQuaternion(new THREE.Quaternion()).toArray();
    if (part.role === 'pocket_slider' && !part.range)
      part.range = { unit: 'path-fraction', min: 0, max: limit(part.id) };
    group.userData = {
      partId: part.id,
      role: part.role,
      semanticParent: part.parent,
      joint: part.joint,
      range: part.range,
      rigidity: part.rigidity,
      animationImplemented: part.animationImplemented,
    };
  }
  const body = parts.get('body');
  body.dimensions = { width: p.w, height: p.h, depth: p.d };
  body.position = [0, p.h / 2, 0];
  root.userData = {
    schema: 'rawnak.fit.bag/2',
    units: 'm',
    style: s.style,
    profile,
    physicalSimulation: false,
    merchantReview: options.approval || 'unreviewed',
    photoGeometryVerified: false,
    retailARReady: false,
  };
  const carries = [];
  for (const part of parts.values())
    if (['handle', 'strap'].includes(part.role) && part.includedInGLB) {
      const mode = part.role === 'handle' || s.strapType === 'hand' ? 'handheld' : s.strapType;
      carries.push({
        mode,
        part: part.id,
        anchor: 'anchor_' + part.id + '_carry',
        attachments: ['a', 'b'].map((k) => 'anchor_' + part.id + '_' + k),
      });
    }
  const graph = {
    schema: 'rawnak.fit.bag/2',
    units: 'm',
    frame: { up: '+Y', front: '+Z', origin: 'base-center', handedness: 'right' },
    style: s.style,
    parts: [...parts.values()],
    anchors,
    carryingModes: carries,
    profile,
    animations: [
      ['Closure', 'opening', ['closure', 'turn_button']],
      ['Carriers', 'swing', carries.map((c) => c.part)],
      [
        'Pocket zippers',
        'pockets',
        [...parts.values()].filter((p) => p.role === 'pocket_slider').map((p) => p.id),
      ],
    ]
      .filter(([, , ids]) =>
        ids.some((id) => {
          let part = parts.get(id);
          if (!part || !part.animationImplemented || !limit(id) || part.range?.max === 0)
            return false;
          while (part) {
            if (!part.visible) return false;
            part = parts.get(part.parent);
          }
          return true;
        }),
      )
      .map(([name, channel]) => ({
        name,
        channel,
        seconds: 1,
        range: channel === 'swing' ? [-1, 1] : [0, 1],
      })),
    performance: { triangles, draws, textureLimit: profile === 'mobile' ? 512 : 1024 },
    pose: 'closed-neutral',
    materials: {
      outer: s.material,
      lining: s.lining,
      baseColor: s.bodyColor,
      metalColor: s.metalColor,
      source: Object.keys(maps).filter((k) => maps[k]),
      fallback: 'procedural-PBR',
      finishes: Object.fromEntries(
        Object.entries(m).map(([id, mat]) => [
          id,
          {
            color: '#' + mat.color.getHexString(),
            roughness: mat.roughness,
            metalness: mat.metalness,
          },
        ]),
      ),
    },
    verification: {
      merchantReview: options.approval || 'unreviewed',
      photoGeometryVerified: false,
      dimensionsVerified: false,
      physicalSimulation: false,
      retailARReady: false,
    },
  };
  return {
    root,
    spec: s,
    parts: graph.parts,
    graph,
    groups,
    pattern: p,
    setOpening,
    setSwing,
    setPockets,
    setLogoTexture,
    setInterior(enabled) {
      cut = Boolean(enabled);
      visibility();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const geometries = new Set(),
        textures = new Set(Object.values(maps).filter(Boolean));
      root.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
      });
      for (const mat of materials) {
        for (const prop of Object.values(mat)) if (prop?.isTexture) textures.add(prop);
        mat.dispose();
      }
      for (const tex of textures) tex.dispose();
      for (const geo of geometries) geo.dispose();
      root.clear();
    },
  };
}
