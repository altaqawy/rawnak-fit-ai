# Alpha 1.7 — constrained cloth motion

## Implementation
- Screen-space spring displacement driven by tracked torso movement, with preset responses for cotton, silk and denim and an off option.
- Shared-edge subdivision expands the articulated short/long-sleeve cutout mesh from 12/16 to 48/64 triangles when motion is enabled. Outer boundary vertices remain fixed to the current pose-driven shape. Interior displacement is bounded and triangle inversion/area collapse triggers the undeformed subdivided mesh.
- The existing semantic clothes mask is still applied after warping. Motion history resets on missing mask, invalid geometry, asset changes, control changes and long timestamp gaps.
- The background AI pipeline from Alpha 1.6 remains: one frame in flight, exact request/timestamp matching, optional worker GPU, worker/main-thread CPU fallback, bounded deadlines and stale-result rejection. Pose inference and compositing still run on the main thread.
- Existing color, texture, 3D and accessory paths are retained.

## How to try
Use a front-facing transparent garment cutout with matching sleeve length, calibrate its anchors, and select a material motion preset. Compare off and each preset while moving side to side.

## Verification
21 synthetic unit checks executed in the JavaScript harness after these changes (including four new motion tests). App source parsed successfully. Prior Alpha 1.6 integration tests passed before this update. Full GitHub Actions is not confirmed green; earlier runs failed. No real browser/camera, GPU, latency, or visual validation has been performed.

## Limits
These presets are artistic parameters, not measured material properties. This is a 2D spring-based approximation; no 3D cloth solver, gravity, collision, validated elasticity, actual wrinkle synthesis, or hidden-body reconstruction. The original clothing mask remains the hard boundary, so wider/shorter garments cannot be fully replaced. Added triangles may increase composition cost; benchmark on real devices, especially phones, before release.

## Next
Resolve CI failures using available job logs and validate the worker/model in a real browser. Compare before/after camera latency and garment fidelity. Only then proceed to realistic garment replacement and actual cloth simulation with merchant-approved garment data.
