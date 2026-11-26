/* RAWNAK FIT ref garment catalog — fixed internal model URL only.
 * A productId in the query string is NOT an authorized asset URL.
 */
export const REFERENCE_GARMENTS = Object.freeze({
  tee: Object.freeze({
    id: 'RAWNAK-REF-TEE-001',
    relativeUrl: '../assets/garments/reference-tee-v1.glb',
    source: 'original authored reference',
    approved: false,
    measuredSize: false,
    modelWidth: 1.68,
    modelHeight: 1.38,
    shoulderBones: ['Shoulder_L','Shoulder_R']
  })
});

export async function loadReferenceGarment(category) {
  if (!Object.hasOwn(REFERENCE_GARMENTS,category)) {
    throw new Error('GLB model category not in reference allowlist');
  }
  const entry = REFERENCE_GARMENTS[category];
  // GLTFLoader and renderer MUST resolve the same pinned Three.js module
  // via the import map declared in index.html / diagnostics.
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const url = new URL(entry.relativeUrl, import.meta.url);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url.href);
  let skinned = null;
  gltf.scene.traverse((object) => {
    if (object.isSkinnedMesh && !skinned) skinned = object;
  });
  const left = gltf.scene.getObjectByName(entry.shoulderBones[0]);
  const right = gltf.scene.getObjectByName(entry.shoulderBones[1]);
  if (!skinned || !left?.isBone || !right?.isBone ||
      !skinned.geometry?.getAttribute('skinIndex') ||
      !skinned.geometry?.getAttribute('skinWeight')) {
    throw new Error('Reference GLB lacks SkinnedMesh or required named shoulder bones');
  }
  return {
    source: gltf.scene,
    id:entry.id,
    skinned,
    joints:{left,right},
    modelWidth:entry.modelWidth,
    modelHeight:entry.modelHeight,
    status:'reference_only',
    approved:false,
    fileUrl:url.href
  };
}

/**
 * Inspector-only local preview import. Never uploads user files.
 * A local file is untrusted and cannot become a published merchant asset.
 * The GLB must follow our current 3-bone demonstration naming contract.
 */
export async function parseLocalGarmentFile(file) {
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  if (!file || !/\.glb$/i.test(file.name || '')) {
    throw new Error('Choose a .glb file (not .gltf, .zip or executable content)');
  }
  if (!Number.isFinite(file.size) || file.size < 24 || file.size > MAX_FILE_BYTES) {
    throw new Error('GLB must be between 24 bytes and 20 MB');
  }
  const data = await file.arrayBuffer();
  const header = new DataView(data);
  if (header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== data.byteLength) {
    throw new Error('Invalid GLB v2 header');
  }
  const {GLTFLoader} = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(data, '');
  let skinned = null;
  gltf.scene.traverse(obj => { if(obj.isSkinnedMesh && !skinned)skinned=obj; });
  const left = gltf.scene.getObjectByName('Shoulder_L');
  const right = gltf.scene.getObjectByName('Shoulder_R');
  if(!skinned || !left?.isBone || !right?.isBone) {
    throw new Error('Rigged garment requires SkinnedMesh and Shoulder_L / Shoulder_R bones');
  }
  const position = skinned.geometry?.getAttribute('position');
  const skinIndex = skinned.geometry?.getAttribute('skinIndex');
  const skinWeight = skinned.geometry?.getAttribute('skinWeight');
  if (!position || !skinIndex || !skinWeight ||
      position.count < 100 || position.count > 150000 ||
      skinIndex.count !== position.count ||
      skinWeight.count !== position.count) {
    throw new Error('GLB mesh / skin weights are missing or exceed preview limits');
  }
  // First version: inspect raw vertex bounds in model-local coordinates.
  // This is a scale normalization, never a physical fit measurement.
  const coords = position.array;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<coords.length;i+=3){
    minX=Math.min(minX,coords[i]);maxX=Math.max(maxX,coords[i]);
    minY=Math.min(minY,coords[i+1]);maxY=Math.max(maxY,coords[i+1]);
  }
  const width=Math.max(.01,maxX-minX),height=Math.max(.01,maxY-minY);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width>100 || height>100) {
    throw new Error('GLB model units invalid for the demo');
  }
  return {
    source:gltf.scene,
    id:'LOCAL-UNVERIFIED',
    skinned,
    joints:{left,right},
    modelWidth:width,
    modelHeight:height,
    status:'local_unverified',
    approved:false,
    fileName:String(file.name).slice(0,90)
  };
}
