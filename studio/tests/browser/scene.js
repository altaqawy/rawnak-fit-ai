import * as THREE from 'three';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { BagViewer, exportAsset } from '../../bag-viewer.js';
import { buildModularBag } from '../../bag-model.js';
import { newProject } from '../../bag-editor.js';
import { FAMILY_PRESETS } from '../../bag-patterns.js';

const host = document.querySelector('#bench'),
  v = new BagViewer(
    host,
    () => {},
    () => {},
  );
const ticks = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const pose = async ({
  style = 'structured',
  view = 'orbit',
  open = 0,
  cut = false,
  profile = 'mobile',
  patch = {},
} = {}) => {
  const start = performance.now(),
    m = buildModularBag({ ...FAMILY_PRESETS[style], style, ...patch }, { profile });
  v.replace(m);
  m.setOpening(open);
  v.inspect(cut);
  v.frame(view);
  v.draw();
  await ticks();
  return {
    buildAndDrawMs: Math.round(performance.now() - start),
    ...m.graph.performance,
    memory: { ...v.renderer.info.memory },
  };
};
function signature() {
  const target = new THREE.WebGLRenderTarget(96, 72),
    pixels = new Uint8Array(96 * 72 * 4);
  const r = v.renderer,
    shadow = v.shadow.visible;
  v.shadow.visible = false;
  r.setRenderTarget(target);
  r.render(v.scene, v.camera);
  r.readRenderTargetPixels(target, 0, 0, 96, 72, pixels);
  r.setRenderTarget(null);
  target.dispose();
  v.shadow.visible = shadow;
  v.draw();
  let covered = 0;
  const sample = [];
  for (let y = 0; y < 72; y += 4)
    for (let x = 0; x < 96; x += 4) {
      let n = 0,
        light = 0;
      for (let dy = 0; dy < 4; dy++)
        for (let dx = 0; dx < 4; dx++) {
          const i = 4 * ((y + dy) * 96 + x + dx);
          if (pixels[i + 3] < 50) continue;
          n++;
          covered++;
          light += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        }
      sample.push(n < 4 ? '0' : String(Math.min(9, 1 + Math.floor(light / n / 30))));
    }
  if (covered < 180) throw Error('Empty WebGL frame: ' + covered);
  return { sample: sample.join(''), covered };
}
async function roundTrip(bytes, expected, withLogo = false) {
  const loader = new GLTFLoader(),
    asset = await loader.parseAsync(new Uint8Array(bytes).buffer, '');
  let meshCount = 0,
    logo = null;
  const ids = new Set(),
    anchorNames = [];
  asset.scene.traverse((o) => {
    if (o.userData.anchor) anchorNames.push(o.name);
    if (!o.isMesh) return;
    meshCount++;
    ids.add(o.userData.partId);
    if (o.name.includes('BRAND_MARK_IMAGE')) logo = o;
  });
  if (meshCount < 15 || !ids.has('front_panel') || !ids.has('lining'))
    throw Error('Missing exported construction');
  if (!anchorNames.includes('anchor_base') || !anchorNames.some((n) => n.endsWith('_carry')))
    throw Error('Missing GLB anchors');
  if (withLogo) {
    if (!logo?.material.map) throw Error('Missing embedded logo');
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.canvas.width = 16;
    ctx.canvas.height = 8;
    ctx.drawImage(logo.material.map.image, 0, 0, 16, 8);
    const data = ctx.getImageData(0, 0, 16, 8).data;
    if (data[3] > 5 || data[(4 * 16 + 8) * 4 + 3] < 220) throw Error('Logo alpha changed in GLB');
  } else if (logo) throw Error('Logo unexpectedly exported');
  const box = new THREE.Box3().setFromObject(asset.scene),
    size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.x < 0.05 || size.x > 1.6 || size.y < 0.05)
    throw Error('Invalid GLB bounds');
  const doc = asset.scene.children[0].userData;
  if (doc.style !== expected || doc.retailARReady !== false)
    throw Error('Wrong handoff flags or family');
  const animations = asset.animations.map((c) => c.name);
  if (
    !animations.includes('Carriers') ||
    !animations.includes('Closure') ||
    !animations.includes('Pocket zippers')
  )
    throw Error('Missing glTF animation clips');
  const resources = new Set(),
    geos = new Set(),
    mats = new Set();
  asset.scene.traverse((o) => {
    if (o.isMesh) {
      geos.add(o.geometry);
      mats.add(o.material);
      for (const t of Object.values(o.material)) if (t?.isTexture) resources.add(t);
    }
  });
  v.replace({
    root: asset.scene,
    groups: new Map(),
    pattern: { w: size.x, h: size.y, d: size.z },
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      resources.forEach((t) => t.dispose());
    },
  });
  v.frame('orbit');
  v.draw();
  await ticks();
  const closed = signature();
  const mixer = new THREE.AnimationMixer(asset.scene);
  const clip = asset.animations.find((c) => c.name === 'Closure');
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  mixer.setTime(0.99);
  await ticks();
  const open = signature();
  mixer.stopAllAction();
  mixer.uncacheRoot(asset.scene);
  if (open.sample === closed.sample)
    throw Error('Exported closure animation did not change rendered pixels');
  return {
    meshCount,
    anchorCount: anchorNames.length,
    animations,
    covered: closed.covered,
    bytes: bytes.length,
    logoEmbedded: Boolean(logo),
  };
}
async function exercise() {
  const measurements = [];
  for (let i = 0; i < 12; i++)
    measurements.push(await pose({ style: i % 2 ? 'structured' : 'bucket' }));
  const a = measurements[3].memory,
    b = measurements.at(-1).memory;
  if (b.geometries > a.geometries + 1 || b.textures > a.textures + 1)
    throw Error('GPU resources grew across equivalent rebuilds');
  return { rebuilds: measurements.length, first: a, last: b, structured: measurements.at(-1) };
}
async function otherClosures() {
  const out = [];
  for (const closure of ['zipper', 'drawstring', 'magnetic']) {
    const project = newProject({ ...FAMILY_PRESETS.bucket, style: 'bucket', closure });
    const { data } = await exportAsset(project, [], 'mobile');
    out.push(await roundTrip(new Uint8Array(data), 'bucket'));
  }
  return out;
}
async function sampleAsset() {
  const project = newProject({
    ...FAMILY_PRESETS.structured,
    style: 'structured',
    mainCompartments: 3,
    logoPlacement: 'none',
  });
  const { data, graph } = await exportAsset(project, [], 'mobile');
  const bytes = new Uint8Array(data);
  const checked = await roundTrip(bytes, 'structured');
  let str = '';
  for (let i = 0; i < bytes.length; i += 8192)
    str += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { glb: btoa(str), graph, checked };
}
window.bagQA = { pose, signature, roundTrip, exercise, otherClosures, sampleAsset };
