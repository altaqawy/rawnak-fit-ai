# RAWNAK FIT AI · Alpha 0.9 — Garment Motion & Arm-Front Beta

Release candidate date: 2026-11-18. Status: **Code deployed to GitHub**, automated pure-JS regression samples checked; actual mobile WebGL/camera visuals must be tested on target devices.

## What changed

The existing alpha 0.8 shirt was a single static extruded Three.js 3D mesh. It was volumetric but its sleeves stayed fixed even when the wearer moved both arms. For alpha 0.9 we added:

1. **Shoulder/elbow movement solver** (\`src/fit-garment-motion.js\`).
   - Reads MediaPipe pose landmarks: shoulders 11/12, elbows 13/14.
   - Sorts projected shoulders by **screen X** to account for mirrored/front-camera views.
   - Calculates sleeve angle relative to the garment torso orientation rather than absolute camera angle.
   - Converts from 2D screen pixels into the shirt's own local frame using the current mesh width/height.
   - Clamps large/ambiguous movements so sleeves don't wrap through the garment.

2. **Lightweight spring animation.**
   - Second-order damped updates with frame-delta clamping.
   - Small vertex updates outside the torso's main cloth panel; the collar/hem/main body remain unchanged.
   - Original vertex positions are cached to prevent cumulative deformation across frames.
   - Geometry normals are recomputed only on tracking updates.
   - A tiny movement-based surface ripple is included; **not a physical cloth simulation**.

3. **Arm-front heuristic compositing** (\`src/fit-arm-occlusion.js\`).
   - On **synchronized mode only**, reuses the *exact same analyzed camera frame*.
   - Creates conservative capsule-shaped elbow-to-wrist masks, intersected with the torso area.
   - Copies the original camera pixels inside those masks over the rendered shirt.
   - Checks visible shoulders/hips/arms and skips arms when world-Z convincingly places them behind the torso.
   - This is **not person segmentation or reliable depth-based occlusion**. It can still copy some background or hide garment details on hard poses.

4. **Live UI switches.**
   - \`حركة الأكمام\`: on/off.
   - \`إظهار الذراع أمام القماش\`: on/off; synchronized mode only.
   - \`/diagnostics/3d-preview.html?product=tee\`: camera-free 360 inspector now has **Raise sleeves** slider, so mesh deformation can be inspected independently of camera tracking.

## Runtime pipeline

\`\`\`text
Camera frame -> MediaPipe Pose (33 landmarks, normalized + optional world)
              -> project shoulder/elbow/hip positions through object-fit-cover
              -> category anchor + torso roll/yaw scale
              -> spring sleeve targets -> update mesh vertex buffer
              -> Three.js transparent WebGL garment render
              -> draw onto SAME processed camera frame
              -> optional same-frame camera-pixel restore over forearms
              -> synchronized 2D display / snapshot
\`\`\`

**Fast mode:** Three.js canvas overlays the unbuffered live video; clothing deforms with every pose update, but arm-pixel compositing is intentionally disabled to avoid frame misalignment.

## Quality contract

- No per-frame image-generation API or tokens.
- Body and motion are **camera-relative**; measurements in centimeters are not inferred from video.
- Current geometry is an illustrative 3D T-shirt or jacket, not a merchant-approved GLB of the exact product.
- Torso and sleeves do not yet implement an imported full armature or skeletal skinning. Alpha 0.9 uses local CPU mesh deformation; it is **not Blender-grade cloth simulation**.
- No skin surface, cloth-body collisions, real fabric tension, or precise product fit is implemented.
- The arm-front effect is an approximation. Exact occlusion will require reliable arm/person segmentation and/or aligned depth with a body model.
- On phone, face/hand/pose tracker selection and low-GPU memory must be checked independently.

## Smoke and regression tests

- \`tests/garment-motion.test.mjs\`: arms raised, neutral resting angles, missing elbow, spring stability, torso-vs-sleeve deformation, same-frame arm overlap safety.
- \`tests/fit-3d.test.mjs\`: 3D anchor sizing and category routing.
- \`tests/static-check.mjs\`: linked scripts, release version, no-scene fallback, synchronization contract.
- GitHub Actions includes above tests. **Runner-level failures can prevent test execution**; check job steps rather than assuming source failure.

## How to verify

1. **Without camera**: https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html?product=tee — turn off Auto Rotate, adjust \`رفع الأكمام\`, rotate the model 360°. It should visibly bend its sleeve areas while the torso stays upright.
2. **With camera**: https://altaqawy.github.io/rawnak-fit-ai/demo/ — open T-shirt product, allow camera, move into the frame so shoulders/hips/elbows are visible; raise one arm, then both. Compare fast and synchronized modes.
3. Disable \`تحريك الأكمام\`; movement should stop while torso tracking continues.
4. In synchronized mode toggle \`إظهار الذراع أمام القماش\` on/off while a forearm crosses the T-shirt. The effect is experimental and may be imperfect.
5. Check footer/debug reads \`ALPHA 0.9\` and \`JS 2026.11.18.090\` after cache reload.

## Next milestone

Verified per-SKU **GLB import + UV textures**, then a true skinned/rigged garment mesh and adaptive cloth solver with human-body collisions/segmentation. The store catalog must verify uploaded product geometry and physical sizes before promoting any result as fit-accurate.
