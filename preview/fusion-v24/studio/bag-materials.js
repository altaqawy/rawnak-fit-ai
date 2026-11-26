import * as THREE from 'three';
import { BAG_MATERIALS } from './bag-spec.js';
import { braidMap } from './bag-cord.js';
import { leatherMap } from './bag-leather.js';

const finishes = {
  leather: [0.76, 0.3],
  faux_leather: [0.7, 0.25],
  suede: [0.96, 0.18],
  canvas: [0.9, 0.23],
  nylon: [0.48, 0.23],
  woven: [0.88, 0.34],
  rigid_case: [0.32, 0.09],
  cotton: [0.93, 0.36],
  polyester: [0.77, 0.23],
};
// Periodic, deterministic micro-normal swatches; never attributed to a photo.
function grain(kind) {
  if (kind === 'leather' || kind === 'faux_leather') return leatherMap(kind, 'normal');
  const size = 64,
    data = new Uint8Array(size * size * 4);
  const woven = ['woven', 'canvas', 'cotton', 'polyester', 'nylon'].includes(kind);
  function height(x, y) {
    const a = (x * 2 * Math.PI) / size,
      b = (y * 2 * Math.PI) / size;
    return woven
      ? 0.5 * Math.cos(8 * a) * Math.cos(4 * b) + 0.38 * Math.sin(8 * b) * Math.sin(4 * a)
      : 0.28 * Math.sin(6 * a + 2 * Math.sin(3 * b)) +
          0.12 * Math.cos(11 * b + 4 * Math.sin(a)) +
          0.11 * Math.cos(7 * a + 9 * b);
  }
  for (let y = 0, i = 0; y < size; y++)
    for (let x = 0; x < size; x++, i += 4) {
      const dx = height(x - 1, y) - height(x + 1, y),
        dy = height(x, y - 1) - height(x, y + 1);
      const norm = Math.hypot(dx, dy, 1);
      for (const [c, v] of [dx, dy, 1].entries()) data[i + c] = Math.round(127.5 * (1 + v / norm));
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.name = 'Template micrograin · ' + kind;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(15, 12);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
export function makeMaterials(spec, maps = {}) {
  const standard = (color, roughness, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
  const finish = finishes[spec.material] || [BAG_MATERIALS[spec.material].roughness, 0.2];
  const skin = standard(maps.material ? '#ffffff' : spec.bodyColor, finish[0]);
  skin.normalMap = maps.normal || grain(spec.material);
  skin.normalScale.setScalar(maps.normal ? 1 : finish[1]);
  for (const [key, slot] of [
    ['material', 'map'],
    ['roughness', 'roughnessMap'],
    ['metalness', 'metalnessMap'],
    ['ao', 'aoMap'],
  ]) {
    if (maps[key]) skin[slot] = maps[key];
  }
  if (maps.roughness) skin.roughness = 1;
  else if (spec.material === 'leather' || spec.material === 'faux_leather')
    skin.roughnessMap = leatherMap(spec.material, 'roughness');
  if (skin.metalnessMap) skin.metalness = 1;
  const trim = skin.clone();
  trim.color.multiplyScalar(0.8);
  const lining = standard(
    spec.liningShade === 'dark'
      ? '#4e4239'
      : spec.lining === 'leather'
        ? '#955c40'
        : spec.lining === 'cotton'
          ? '#dcc5a7'
          : '#ac8773',
    0.85,
  );
  lining.normalMap = grain(spec.lining);
  lining.normalScale.setScalar(0.21);
  const edge = standard(new THREE.Color(spec.bodyColor).multiplyScalar(0.44), 0.6);
  const thread = standard(
    new THREE.Color(spec.bodyColor).lerp(new THREE.Color('#efcf9e'), 0.56),
    0.87,
  );
  const metal = standard(spec.metalColor, 0.25, 0.82),
    zip = standard('#61584c', 0.44, 0.58);
  const plastic = standard('#37352f', 0.38),
    art = standard('#ffffff', 0.68);
  art.transparent = true;
  art.alphaTest = 0.025;
  art.depthWrite = false;
  art.polygonOffset = true;
  art.polygonOffsetFactor = -2;
  if (maps.logo) art.map = maps.logo;
  const materials = { skin, trim, lining, edge, thread, metal, zip, plastic, art };
  if (spec.style === 'coiled' || spec.closure === 'scroll_snap') {
    materials.cord = skin.clone();
    materials.cord.normalMap = maps.normal || braidMap();
    materials.cord.map = maps.material || braidMap('color');
    materials.cord.normalScale.setScalar(maps.normal ? 1 : 0.64);
    materials.cord.roughness = maps.roughness ? 1 : 0.94;
    materials.cord.roughnessMap = maps.roughness || null;
  }
  if (spec.style === 'coiled') {
    materials.carrier = standard(spec.strapColor, 0.65);
    materials.carrier.normalMap = leatherMap('leather', 'normal');
    materials.carrier.normalScale.setScalar(0.22);
  }
  if (spec.logoType === 'round_patch') materials.badge = standard('#88613f', 0.74);
  if (spec.zipInsert) materials.pouch = standard('#b79a7b', 0.82);
  return materials;
}

// A licensed alpha mask can provide a relief normal and silhouette without
// painting source RGB over leather. This only affects shading, not mesh depth.
export function reliefArtwork(source, debossed) {
  const src = source.image,
    w = src.width,
    h = src.height,
    base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const ctx = base.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const mask = ctx.getImageData(0, 0, w, h),
    normal = ctx.createImageData(w, h);
  const alpha = (x, y) =>
    mask.data[(Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4 + 3] /
    255;
  for (let y = 0, i = 0; y < h; y++)
    for (let x = 0; x < w; x++, i += 4) {
      const sign = debossed ? -1 : 1,
        dx = sign * (alpha(x - 1, y) - alpha(x + 1, y)),
        dy = sign * (alpha(x, y + 1) - alpha(x, y - 1));
      const len = Math.hypot(dx, dy, 1);
      normal.data.set(
        [127.5 * (1 + dx / len), 127.5 * (1 + dy / len), 127.5 * (1 + 1 / len), 255],
        i,
      );
      mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = 255;
    }
  ctx.putImageData(mask, 0, 0);
  const n = document.createElement('canvas');
  n.width = w;
  n.height = h;
  n.getContext('2d').putImageData(normal, 0, 0);
  const color = new THREE.CanvasTexture(base);
  color.colorSpace = THREE.SRGBColorSpace;
  return { color, normal: new THREE.CanvasTexture(n) };
}
