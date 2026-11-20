// Bake the deterministic preview joints to standard glTF animation channels on
// an export-only assembly. The editable graph remains the authoring source.
import * as THREE from 'three';
const different = (a, b) => a.some((v, i) => Math.abs(v - b[i]) > 1e-7);
const samples = (count) => Array.from({ length: count }, (_, i) => i / (count - 1));
export function bakeBagClips(model) {
  const clips = [];
  for (const { name, channel } of model.graph.animations) {
    const swing = channel === 'swing',
      pockets = channel === 'pockets';
    const move = swing ? model.setSwing : pockets ? model.setPockets : model.setOpening;
    const times = samples(swing ? 3 : pockets || model.spec.closure === 'zipper' ? 9 : 5);
    const nodes = [];
    model.root.traverseVisible((o) => {
      const p = o.userData.partId || '';
      const isPocket =
        p.startsWith('inner_zip_pocket_') || p === 'insert_slider' || p === 'insert_pouch';
      if (swing ? !/^(strap|handle)_/.test(p) : pockets ? !isPocket : isPocket) return;
      nodes.push({ o, positions: [], rotations: [], weights: [], surfaces: [] });
    });
    for (const time of times) {
      move(swing ? time * 2 - 1 : time);
      for (const n of nodes) {
        const { o } = n;
        n.positions.push(o.position.toArray());
        n.rotations.push(o.quaternion.toArray());
        if (o.morphTargetInfluences?.length) n.weights.push([...o.morphTargetInfluences]);
        if (!swing && o.geometry?.userData.kinematicSurface)
          n.surfaces.push({
            position: o.geometry.attributes.position.clone(),
            normal: o.geometry.attributes.normal.clone(),
          });
      }
    }
    move(0);
    const tracks = [];
    for (const { o, positions, rotations, weights, surfaces } of nodes) {
      for (const [type, key, values] of [
        [THREE.VectorKeyframeTrack, 'position', positions],
        [THREE.QuaternionKeyframeTrack, 'quaternion', rotations],
        [THREE.NumberKeyframeTrack, 'morphTargetInfluences', weights],
      ]) {
        if (values.length && values.some((v) => different(v, values[0])))
          tracks.push(new type(o.uuid + '.' + key, times, values.flat()));
      }
      if (
        surfaces.length &&
        surfaces.some((v) => different(v.position.array, surfaces[0].position.array))
      ) {
        o.geometry.morphAttributes.position = surfaces.slice(1).map((s) => s.position);
        o.geometry.morphAttributes.normal = surfaces.slice(1).map((s) => s.normal);
        o.updateMorphTargets();
        const values = times.flatMap((_, j) => times.slice(1).map((_, k) => (j === k + 1 ? 1 : 0)));
        tracks.push(
          new THREE.NumberKeyframeTrack(o.uuid + '.morphTargetInfluences', times, values),
        );
      }
    }
    if (tracks.length) clips.push(new THREE.AnimationClip(name, 1, tracks));
  }
  return clips;
}
