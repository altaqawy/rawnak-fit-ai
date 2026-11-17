// Studio's optional Three.js engine. Loaded only when a compatible product is selected.
// Asset is an illustrative parametric template, NOT a product-exact reconstruction.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const metallic = (color, roughness = 0.27) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.73, roughness, side: THREE.DoubleSide });
const matte = (color, roughness = 0.7) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.08, roughness, side: THREE.DoubleSide });
const add = (group, geometry, material, name, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

export function buildParametricGeometry(category, diameterMm, color = '#c4d7bd') {
  const group = new THREE.Group();
  group.name = 'RAWNAK illustrative parametric ' + category;
  const size = Math.max(4, Math.min(180, Number(diameterMm) || 30));
  const accent = metallic(color);
  const metal = metallic('#d0bd88', 0.22);
  if (category === 'ring') {
    const innerRadius = size / 20;
    const bandWidth = Math.max(0.14, innerRadius * .18);
    add(group, new THREE.TorusGeometry(innerRadius + bandWidth * .5, bandWidth, 18, 92),
      accent, 'Generic ring band');
    const setting = add(group, new THREE.SphereGeometry(bandWidth * 1.6, 22, 16),
      new THREE.MeshPhysicalMaterial({ color: '#e9f8ef', roughness: 0.1, metalness: 0.05, transmission: .25 }),
      'Example stone placeholder', 0, innerRadius + bandWidth, 0);
    setting.scale.set(.78, .9, .7);
  } else if (category === 'bangle') {
    const innerRadius = size / 20;
    const thickness = Math.max(.16, innerRadius * .085);
    add(group, new THREE.TorusGeometry(innerRadius + thickness * .5, thickness, 20, 110),
      accent, 'Generic bangle band');
    add(group, new THREE.TorusGeometry(innerRadius + thickness * .5, thickness * .22, 12, 110),
      metal, 'Gold decorative trim', 0, 0, .08);
  } else if (category === 'watch') {
    const caseRadius = size / 20;
    const body = add(group, new THREE.CylinderGeometry(caseRadius, caseRadius, Math.max(.23, caseRadius * .22), 72),
      accent, 'Generic watch case', 0, 0, 0);
    body.rotation.x = Math.PI / 2;
    add(group, new THREE.CylinderGeometry(caseRadius * .85, caseRadius * .85, .025, 72),
      matte('#172c29', .24), 'Plain illustrative dial', 0, 0, .17).rotation.x = Math.PI / 2;
    add(group, new THREE.TorusGeometry(caseRadius * .89, .05, 12, 74),
      metal, 'Generic bezel', 0, 0, .2);
    for (let i = 0; i < 12; i++) {
      const t = i / 12 * Math.PI * 2;
      const mark = add(group, new THREE.BoxGeometry(.035, .11, .03), metal, 'Dial marker ' + i,
        Math.sin(t) * caseRadius * .7, Math.cos(t) * caseRadius * .7, .21);
      mark.rotation.z = -t;
    }
    const minute = add(group, new THREE.BoxGeometry(.05, caseRadius * .49, .04), metal, 'Demo minute hand', 0, caseRadius * .20, .25);
    minute.rotation.z = .35;
    add(group, new THREE.BoxGeometry(.07, caseRadius * .37, .04), metal, 'Demo hour hand',
      caseRadius * .13, caseRadius * .12, .28).rotation.z = -.7;
    for (const side of [-1, 1]) {
      const strap = add(group, new THREE.BoxGeometry(caseRadius * 1.05, caseRadius * 1.55, .16),
        matte(color), side > 0 ? 'Upper strap' : 'Lower strap', 0,
        side * caseRadius * 1.72, -.04);
      strap.rotation.x = side * .11;
      add(group, new THREE.BoxGeometry(caseRadius * 1.09, .13, .20), metal,
        'Strap connector', 0, side * caseRadius * 1.05, -.03);
    }
  } else {
    throw new Error('No parametric renderer available for ' + category);
  }
  return group;
}

function disposeObject(node) {
  node?.traverse((object) => {
    object.geometry?.dispose?.();
    if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(x => x.dispose?.());
  });
}

export class ParametricViewer {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x132720);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xfff7e6, 0x547d71, 3.0));
    const key = new THREE.DirectionalLight(0xffffff, 3.3);
    key.position.set(5, 7, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xb2f2d6, 2.4);
    rim.position.set(-6, 2, -5);
    this.scene.add(rim);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 80;
    this.controls.autoRotate = false;
    this.group = null;
    this.frame = 0;
    this.disposed = false;
    this.resize = () => {
      if (this.disposed) return;
      const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.resize();
    const loop = () => {
      if (this.disposed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.frame = requestAnimationFrame(loop);
    };
    loop();
  }

  clear() {
    if (this.group) {
      this.scene.remove(this.group);
      disposeObject(this.group);
      this.group = null;
    }
  }

  setProduct(category, size, color) {
    this.clear();
    this.group = buildParametricGeometry(category, size, color);
    this.scene.add(this.group);
    const bounds = new THREE.Box3().setFromObject(this.group);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(.45, sphere.radius);
    this.camera.position.set(radius * 1.25, radius * .7, radius * 3.6);
    this.controls.target.copy(sphere.center);
    this.controls.maxDistance = radius * 12;
    this.controls.minDistance = radius * 1.4;
    this.controls.update();
  }

  async exportGLB() {
    if (!this.group) throw new Error('Build a template before exporting');
    const exporter = new GLTFExporter();
    return await new Promise((resolve, reject) =>
      exporter.parse(this.group, data => {
        if (data instanceof ArrayBuffer) resolve(new Blob([data], { type: 'model/gltf-binary' }));
        else reject(new Error('Expected binary GLB output'));
      }, reject, { binary: true, onlyVisible: true }));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
