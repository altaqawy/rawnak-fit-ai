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
