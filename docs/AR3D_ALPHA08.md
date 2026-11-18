# RAWNAK FIT AI — Alpha 0.8 Live 3D WebGL

**Status:** Implemented in repo main; runtime acceptance on Android/desktop is pending.  
**Date:** 2026-11-18.

## User problem and fix

Original product-photo overlays were planar 2D: the shirt sometimes appeared upside down, watch/bag often failed to show due to missing full-body keypoints, and glasses looked frontal when wearer turned sideways. Merely improving 2D landmark positioning cannot create real volumetric depth, full-body rigging or cloth motion.

**Solution shipped:** client-side Three.js WebGL real geometry renderer at `src/fit-3d-renderer.js` with `src/fit-3d-pose.js` for landmarks-to-3D transforms and size ratios. These are **genuine 3D demo meshes** (volumes, material, depth, side/back surfaces), **not** AI-generated accurate merchant product replicas.

## Live pipeline

```text
User camera frame
  -> MediaPipe Pose / Hand / Face
  -> pose-to-3D anchor sizing/yaw/roll (category dependent)
  -> THREE.Scene + OrthographicCamera (Y-down same coordinate space as video)
  -> 3D mesh + PBR-style material + lights
  -> transparent WebGL output
  -> SAME frame composite in sync mode, or separate overlay in fast mode
  -> preview / screenshot
```

- The camera and pose inference stay on-device, and no per-frame AI generation tokens are consumed.
- Lazy-load Three.js from a pinned CDN only when user opens camera in 3D mode.
- WebGL failure is isolated from webcam and MediaPipe; show a clear diagnostic rather than silently reverting to a wrong overlay.
- Current default in demo and standalone live mirror is `assetMode='3d'`. An explicit optional comparison switch offers old 2D photo and schematic overlays in the four demo SKUs.
- `synchronized` mode draws the WebGL canvas onto the **same source frame** that was analyzed, avoiding overlay temporal lag; `fast` mode uses a transparent canvas over the unbuffered video.
- Explicit `fit-guide` hints explain missing or low-confidence anchors, with 70–130% scale only for visual preview.

## New 3D models

| Type | Engine geometry | Attach to | Known limitations |
| --- | --- | --- | --- |
| Watch | Cylinder case/dial/bezel, indices/hands, leather strap, metal crown | Wrist + palm axis; smaller 3D face than previous 2D image | No true measured wrist thickness, genuine SKU face/strap |
| Glasses | Two ring frames, glass surfaces, bridge, rearward gold temples | Face eyes/nose, approximate yaw | Nose/ear occlusion and bridge fit not certified |
| Bag | Extruded rounded leather body, flap, clasp, 3D tube strap | Shoulder/hip; shoulder-only approximate fallback | Strap physics, hand grasp, cloth occlusion |
| T-shirt / jacket | Extruded **3D cloth-shaped geometry**, collar/hem/zipper | Shoulder axis, torso height and yaw; shoulder-only approximate fallback | Rigid shape, **no cloth simulation, no skinning**, arm motion not yet rigged |
| Bangle | 3D torus metal band | Wrist | No exact diameter from single camera |
| Shoes | Extruded shoe silhouette and 3D sole, pair model | Ankles/foot landmarks | Scale and footwear fit illustrative only |

The **shirt collar geometry begins at the shoulders and the hem extends downward in the Y-down image coordinate system**. This removes the "shirt upside-down" asset issue in 3D mode (2D photo remains legacy comparison).

## Quality / safety

- The 3D model is **not** generated from every merchant photo. The 8 synthetic reference product photos are design/color references only.
- A 3D mesh can rotate continuously to show a modeled backside. That backside is *estimated design*, not an authentic image of the store item.
- When shoulder/hips aren't both visible, shirt and bag can show an explicitly labeled approximate shoulder-only 3D placement instead of disappearing. For full reliability, move back until torso is visible.
- Missing shoulders, or low-confidence face/hand landmarks, still suppress falsely placed models.
- True product matching requires approved GLB assets/UV textures, physical dimensions and brand/visual QA per SKU.
- True cloth motion requires a separate garment rig, deformable mesh/skinning, depth/segmentation, cloth physics and device testing.
- No camera can guarantee 100% dimensional measurement or fit from a single RGB stream.

## URLs

- Live store: https://altaqawy.github.io/rawnak-fit-ai/demo/
- [3D Inspector **without camera**](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html) (select watch/tee/glasses/bag; rotate 360°)
- Live mirror: https://altaqawy.github.io/rawnak-fit-ai/
- Tests: `tests/fit-3d.test.mjs`, `tests/static-check.mjs` and existing frame-sync tests

## QA

Static JS syntax and a mocked 3D runtime were checked: all seven category factory meshes constructed, render() returned success for synthetic pose landmarks, preview() rotated four products, and GPU resources cleaned on dispose.

**Still pending:** actual Three.js CDN load, WebGL rendering, cross-origin iframe behavior and Android/Chrome camera anchoring. A scripted mock does not prove visual accuracy. Also benchmark actual FPS on the target Android device and ensure texture/polygon budget remains practical.

Next milestone: a verified textured GLB for one watch, and then garment rigging/skinning instead of rigid T-shirt extrusion.
