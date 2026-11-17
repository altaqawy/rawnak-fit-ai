# Architecture Decision: Continuous 360° Virtual Clothing (ADR-0001)

Date: 2026-11-17  
Status: **Proposed for prototype** — no production garment renderer integrated yet.

## Decision

**Do not use eight-angle image swaps as the primary solution.** A smoother rotation and better side/back geometry need one *continuous 3D garment surface*, not one PNG per view.

Build two complementary product-input paths:

1. **True continuous 360° mode:** Import a garment mesh (GLB/GLTF for Three.js prototype, or mesh compatible with Snap Lens Studio) with shape, UV materials, an attachment/retargeting plan, and optional cloth simulation. The same geometry is rendered as the wearer rotates.
2. **Fast 2D upper-body mode:** Snap **Garment Transfer** can apply one reference garment image to live video. It may be a viable accessible front-facing demo, but a single frontal image does *not* establish faithful unseen back, side construction, real size, or fabric physics. Do not label this path true 360°.

## Recommended prototype engine

**First evaluation: Snap Lens Studio + Camera Kit Web.** Official sample docs confirm:

- Clothing Try-On + imported 3D garment meshes and External Body Mesh; Camera Kit Web listed as fully supported.
- Cloth Simulation Try-On pack includes Dress, Coat, Hoodie; uses Body Tracking, Body Mesh, cloth physics colliders, and body occluders; Camera Kit Web listed as fully supported.
- Garment Transfer uses an image to transfer upper-body garment appearance to camera video; Camera Kit Web listed as fully supported. Not a replacement for accurate backside 3D geometry.

Links:
- https://docs.lensstudio.com/develop/capabilities/ar/try-on/clothing-try-on
- https://docs.lensstudio.com/develop/capabilities/ar/try-on/cloth-simulation-try-on
- https://docs.lensstudio.com/develop/capabilities/ar/try-on/garment-transfer
- https://docs.lensstudio.com/get-started/camera-kit

**Portable fallback:** Keep our working MediaPipe camera and synchronized-preview engine. Attach a rigged 3D garment to body-pose world landmarks with Three.js `SkinnedMesh` / `GLTFLoader`, calibrated skeleton retargeting, segmentation occlusion, and selective cloth motion. This requires considerable bespoke 3D/physics work; it is *not* already implemented by adding a SkinnedMesh alone.

Sources:
- https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- https://threejs.org/docs/#api/en/objects/SkinnedMesh

## Asset creation (one-time per SKU)

**Best:** vendor CAD / original pattern converted to a consistent garment mesh by tools such as CLO/Blender, then optimize for realtime. Store the shape and UV textures with physically based material values and sizes.

**Merchant does not have a 3D model:** template-per-garment-family (T-shirt, shirt, hoodie, dress) with measured size parameters, color and textures; request at least the details needed to verify back, side and closures. AI 3D generation can draft a mesh offline, but unseen designs from one photo are guesses and require approval.

Suggested SKU metadata:

```json
{
  "sku": "demo-hoodie-001",
  "category": "hoodie",
  "previewMode": "true-3d",
  "assets": {
    "modelGlb": "assets/hoodie-lowpoly.glb",
    "baseColor": "assets/hoodie-basecolor.webp",
    "normal": "assets/hoodie-normal.webp"
  },
  "measurementsCm": {
    "chest": 108,
    "shoulder": 48,
    "length": 72,
    "sleeve": 63
  },
  "rigProfile": "human-torso-v1",
  "clothPreset": "hoodie-light",
  "coverage": "upper-body",
  "verifiedRearDesign": true
}
```

## Render pipeline

```text
User camera
  -> local pose and/or body-mesh tracking
  -> body orientation estimation (front/side/back continuously)
  -> skeleton retarget + garment model placement / deform
  -> optional cloth simulation for loose regions
  -> depth/segmentation occlusion (hands and torso)
  -> **one camera frame + matching 3D render**
  -> browser display
```

Our existing Alpha 0.4 frame synchronization can remain as fallback for consistent camera-frame alignment; the 3D renderer is a distinct project stage.

**Important limitations:** Single RGB webcam cannot guarantee perfect shape/measurements or back-side tracking while key body joints are occluded. Implement confidence-based stability with recovery and clear warnings instead of claiming absolute accurate fit.

## Validation plan

1. Import **one public/demo 3D hoodie model with appropriate license** into Snap Lens Studio Cloth Simulation Try-On sample.
2. Confirm **Camera Kit Web** preview works with a connected API token, approved Lens ID and Lens Group ID from developer account. Store tokens in approved environment configuration; never commit secrets.
3. Test continuous front -> side -> back -> front rotation; verify no image-swap jumps, safe tracking loss/reacquisition, and realistic sleeves.
4. Compare on Windows Chrome/Edge, mid-range Android Chrome/Samsung Internet, iOS Safari. Log actual render FPS, tracking FPS and frame latency; do not promise 60 FPS.
5. Add human occlusion tests: arms crossing chest, crouching, half torso leaving frame.
6. Reduce mesh polygons, physics complexity, resolution or enable fallback mode when device is slow.
7. Only after the proof-of-concept, add merchant upload/prepare/store pipeline and sizing.

## Suggested milestone

**Alpha 0.5 = first rotating 3D hoodie on camera**, no seller-generated catalog yet. **Beta 0.6 = one merchant SKU pipeline with verified front/side/back details.**

## What this ADR does not do

This is an architecture recommendation, **not an implementation of Camera Kit or 3D rendering in the live site**. The current Alpha 0.4 2D overlays stay available until the 3D pilot is validated.
