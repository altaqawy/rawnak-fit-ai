import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { bakeBagClips } from './bag-animation.js';
import { buildModularBag } from './bag-model.js';

export async function loadMaps(photos, spec, max) {
  const maps = {},
    views = ['material', 'roughness', 'normal', 'metalness', 'ao'];
  if (spec.brandLicenseConfirmed && spec.logoPlacement !== 'none' && spec.logoType !== 'none')
    views.push('logo');
  try {
    for (const view of views) {
      const ref = photos.find((p) => p.url && p.view === view && p.source === 'merchant');
      if (!ref) continue;
      const img = new Image();
      img.src = ref.url;
      await img.decode();
      const scale = Math.min(1, max / Math.max(img.width, img.height)),
        tile = document.createElement('canvas');
      tile.width = Math.max(1, Math.round(img.width * scale));
      tile.height = Math.max(1, Math.round(img.height * scale));
      tile.getContext('2d').drawImage(img, 0, 0, tile.width, tile.height);
      const tex = new THREE.CanvasTexture(tile);
      tex.name = view;
      if (['logo', 'material'].includes(view)) tex.colorSpace = THREE.SRGBColorSpace;
      if (view !== 'logo') {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 3);
      }
      maps[view] = tex;
    }
    if (!maps.logo && views.includes('logo') && spec.logoText.trim()) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = spec.metalColor;
      ctx.font = '600 76px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.logoText, 256, 64, 476);
      const text = new THREE.CanvasTexture(canvas);
      text.name = 'Merchant lettering';
      text.colorSpace = THREE.SRGBColorSpace;
      maps.logo = text;
    }
    return maps;
  } catch (e) {
    for (const tex of Object.values(maps)) tex.dispose();
    throw e;
  }
}
export async function assemble(project, photos, profile) {
  const maps = await loadMaps(photos, project.spec, profile === 'mobile' ? 512 : 1024);
  return buildModularBag(project.spec, { ...project, images: photos, maps, profile });
}
const directions = {
  orbit: [0.69, 0.39, 1.32],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.0001],
  bottom: [0, -1, 0.0001],
  inside: [0.09, 1, 0.19],
};
export class BagViewer {
  constructor(host, pick, onError) {
    this.host = host;
    this.pick = pick;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    const r = this.renderer;
    r.setClearColor(0, 0);
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
    r.localClippingEnabled = true;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.98;
    host.prepend(r.domElement);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.001, 30);
    const pmrem = new THREE.PMREMGenerator(r),
      room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.035);
    this.scene.environment = this.env.texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = 0.7;
    const sky = new THREE.HemisphereLight(0xfff6df, 0x705e57, 1.05);
    this.scene.add(sky);
    const key = new THREE.DirectionalLight(0xfff3df, 1.75);
    key.position.set(-1.2, 2, 2.2);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xcbd9fc, 0.8);
    rim.position.set(1.7, 1, -2.4);
    this.scene.add(rim);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 96;
    const ctx = shadowCanvas.getContext('2d'),
      fade = ctx.createRadialGradient(48, 48, 2, 48, 48, 48);
    fade.addColorStop(0, 'rgba(43,34,27,.42)');
    fade.addColorStop(0.53, 'rgba(43,34,27,.24)');
    fade.addColorStop(1, 'rgba(43,34,27,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 96, 96);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
    this.controls.addEventListener('change', () => this.draw());
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.ray = new THREE.Raycaster();
    this.canvas = r.domElement;
    this.down = (e) => {
      this.pointer = [e.clientX, e.clientY, e.pointerId];
    };
    this.up = (e) => {
      if (
        !this.pointer ||
        e.pointerId !== this.pointer[2] ||
        Math.hypot(e.clientX - this.pointer[0], e.clientY - this.pointer[1]) > 5 ||
        !this.model
      )
        return;
      const rect = this.canvas.getBoundingClientRect();
      this.ray.setFromCamera(
        {
          x: (2 * (e.clientX - rect.left)) / rect.width - 1,
          y: 1 - (2 * (e.clientY - rect.top)) / rect.height,
        },
        this.camera,
      );
      const meshes = [];
      this.model.root.traverseVisible((o) => {
        if (o.isMesh) meshes.push(o);
      });
      const hit = this.ray
        .intersectObjects(meshes, false)
        .find((h) => !this.cut || h.point.z <= this.model.pattern.d * 0.16);
      if (hit) this.pick(hit.object.userData.partId);
    };
    this.lost = (e) => {
      e.preventDefault();
      this.contextLost = true;
      onError('context-lost');
    };
    this.restored = () => {
      this.contextLost = false;
      onError('restored');
      this.draw();
    };
    this.canvas.addEventListener('pointerdown', this.down);
    this.canvas.addEventListener('pointerup', this.up);
    this.canvas.addEventListener('webglcontextlost', this.lost);
    this.canvas.addEventListener('webglcontextrestored', this.restored);
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.model) this.frame(this.view || 'orbit');
    this.draw();
  }
  draw() {
    if (this.raf || this.contextLost || this.disposed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (!this.disposed) this.renderer.render(this.scene, this.camera);
    });
  }
  replace(model, reframe = false) {
    this.highlight(null);
    const first = !this.model;
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.dispose();
    }
    this.model = model;
    this.scene.add(model.root);
    this.shadow.scale.set(model.pattern.w * 1.56, model.pattern.d * 2.1, 1);
    this.shadow.position.y = -0.0015;
    if (first || reframe) this.frame(this.view || 'orbit');
    this.draw();
  }
  frame(view) {
    if (!this.model) return;
    this.view = directions[view] ? view : 'orbit';
    this.shadow.visible = !['bottom', 'inside'].includes(this.view);
    const root = this.model.root,
      box = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      if (o.isMesh) box.expandByObject(o, false);
    });
    if (box.isEmpty())
      box.setFromCenterAndSize(new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.28, 0.2, 0.11));
    const size = box.getSize(new THREE.Vector3()),
      center = box.getCenter(new THREE.Vector3());
    const interior = view === 'inside',
      p = this.model.pattern;
    if (interior) center.set(0, p.h * 0.38, 0);
    const dir = new THREE.Vector3(...directions[this.view]).normalize();
    const extent = interior
      ? Math.max(p.w, p.d) * 1.05
      : Math.max(
          size.y,
          size.z * 0.85,
          size.x / this.camera.aspect,
          size.y / Math.max(1, this.camera.aspect),
        );
    const vertical = (this.camera.fov * Math.PI) / 180;
    const dist =
      ((extent * 0.57) / Math.tan(vertical * 0.5) + size.z * 0.38) * (interior ? 0.91 : 1.09);
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir, Math.max(dist, 0.12));
    this.camera.near = 0.0008;
    this.camera.far = Math.max(dist * 20, 6);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = 0.025;
    this.controls.maxDistance = Math.max(dist * 4, 2);
    this.controls.update();
    this.draw();
  }
  highlight(id) {
    if (this.highlighted) {
      for (const [mesh, old] of this.highlighted) {
        mesh.material.dispose();
        mesh.material = old;
      }
    }
    this.highlighted = [];
    if (id && this.model)
      this.model.groups.get(id)?.traverse((o) => {
        if (!o.isMesh || o.userData.partId !== id) return;
        const old = o.material,
          mat = old.clone();
        mat.emissive.set('#4e8b71');
        mat.emissiveIntensity = 0.42;
        this.highlighted.push([o, old]);
        o.material = mat;
      });
    this.draw();
  }
  inspect(cut) {
    this.cut = cut;
    this.model?.setInterior(cut);
    this.draw();
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.highlight(null);
    this.observer.disconnect();
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('webglcontextlost', this.lost);
    this.canvas.removeEventListener('webglcontextrestored', this.restored);
    this.shadow.geometry.dispose();
    this.shadow.material.map.dispose();
    this.shadow.material.dispose();
    this.controls.dispose();
    this.model?.dispose();
    this.env.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
export async function exportAsset(project, photos, profile) {
  // Assemble a fresh neutral pose so highlights, inspection cuts and slider
  // previews cannot leak into the GLB. Intentional hidden edits are honoured.
  const model = await assemble(project, photos, profile);
  try {
    model.root.userData.handoff = {
      schema: model.graph.schema,
      anchors: model.graph.anchors,
      carryingModes: model.graph.carryingModes,
      materials: model.graph.materials,
      performance: model.graph.performance,
      verification: model.graph.verification,
    };
    const animations = bakeBagClips(model);
    const data = await new GLTFExporter().parseAsync(model.root, {
      binary: true,
      onlyVisible: true,
      trs: true,
      animations,
      maxTextureSize: model.graph.performance.textureLimit,
    });
    if (!(data instanceof ArrayBuffer)) throw Error('GLB');
    return { data, graph: model.graph };
  } finally {
    model.dispose();
  }
}
