# RAWNAK FIT AI — Alpha 1.0 Rounded 3D Garment

Date: 2026-11-18  
Scope: Improve the block-shaped green T-shirt and jagged/V-shaped neckline seen in the user's landscape Android screenshot.

## What actually changed

The former mesh was a flat 2D shirt outline sent through Three.js \`ExtrudeGeometry\` with a near-constant thickness and little smoothing. Rotating it exposed a large, rigid, block-like side surface.

**New geometry in \`src/fit-3d-renderer.js\`:**

- Rounded open-surface **parametric torso shell**, indexed triangles with calculated smooth vertex normals.
- Approximately **1,147 torso vertices and 2,160 triangles**, before separate sleeves and seam details (geometry counts can be checked directly in the Inspector).
- Different front/back collar depths: front crew-neck lower than rear neck and shoulders.
- Body curvature changes between shoulder, chest, waist and hem with gentle drape/wrinkles.
- Two independent **curved tubular short sleeves** attached to shoulder pivots; each cuff is a 3D seam ring.
- Neck rib and full circular hem stitch instead of the former V-shaped decorative line.
- A tiny **64px tiling synthetic cotton weave texture** for better material relief with very little GPU memory; not an authentic merchant texture.
- Front zipper and material color option retained for the illustrative jacket.
- No per-frame diffusion/generative AI tokens, no new backend or server rendering.

**Animation:** Alpha 0.9 shoulder/elbow spring still drives sleeve movement, but now rotates the separate 3D sleeve tubes rather than deforming the edges of a flat extrusion. Torso is kept stable with a subtle optional surface ripple. Turning off motion resets to neutral geometry.

## Camera-free inspector upgrades

[3D Inspector](https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee):

- Drag with mouse/finger to rotate horizontally and tilt vertically.
- New 70–145% model zoom control.
- Raise sleeves slider, independent of camera.
- Mesh vertex/triangle count shows directly as actual geometry metadata.
- Stable camera-free viewport to distinguish bad 3D topology from MediaPipe placement.

## Test targets and limits

**Code-level verified:** torso front neckline is lower than back neck, curved shell has more than 1,000 indexed vertices, sleeves exist as separate groups and rotate/return to neutral, all other categories continue to instantiate, and geometry/texture are disposed.

**Not yet physically verified on Android:** material shading, front/back appearance, alpha blending with the actual camera, pointer capture, WebGL texture performance and sleeve-body collision. GitHub Actions runner startup problems may prevent CI jobs from executing.

**This is still a procedurally generated illustration.** It does not reconstruct the original product photos, reproduce a merchant's exact fabric/cut, or implement Blender-quality garment physics. No real-world dimensions, weight, drape, human collision or fit guarantee are inferred from the RGB camera.

## Next needed for a real product digital twin

1. Import verified SKU garment GLB from pattern/CAD or multi-view reconstruction.
2. Physically grounded PBR texture maps (base color, roughness, normal), material thickness and scale.
3. Proper skeletal rig and skin weights for shoulder/upper arm, cloth-body collision.
4. Reliable person segmentation/occlusion and robust mobile performance metrics.
5. Merchant review of SKU dimensions and all angles before public publication.

Relevant code: \`src/fit-3d-renderer.js\`; motion: \`src/fit-garment-motion.js\`; camera: \`src/app.js\`.  
Regression tests: \`tests/garment-surface.test.mjs\`, \`tests/garment-motion.test.mjs\`.
