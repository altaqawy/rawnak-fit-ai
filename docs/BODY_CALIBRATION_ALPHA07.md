# RAWNAK FIT AI — Alpha 0.7 Body-relative Fit Calibration

Date: 2026-11-18  
Status: **Implemented as a safety/placement improvement for 2D Photo AR**, pending acceptance on real camera.

## Why

In the user's Android camera screenshots, face tracking was stable but glasses were still frontal while the wearer turned sideways, the watch appeared oversized, the bag floated near a partially visible body, and a T-shirt covered the user's face. The root problem was **converting detected landmarks to photo-overlay position without sufficient body framing, photo alpha cropping, pose orientation/visibility checks or proportional sizing**.

## Implemented pipeline

1. Continue local MediaPipe hand (21 points), face (~478 points), pose (33 points) tracking. Pose model also provides visibility and 3D world landmarks.
2. Preserve `visibility`, `presence` and `z` during smoothing; preserve `worldLandmarks` per frame where present.
3. Check that required anatomical landmarks are actually in the camera's **visible object-fit crop**, and pass their confidence thresholds.
4. Establish **relative on-screen body metrics**:
   - Shirt/jacket: projected shoulder span and shoulder-to-hip torso length, shoulder roll, shoulder depth ratio for strong side turns.
   - Bag: both shoulders and hips visible; use side-of-body anchor and frame bounds.
   - Watch: palm width across index/pinky bases, wrist-to-middle-knuckle direction and forearm attachment.
   - Glasses: inter-eye span and a nose-offset yaw proxy.
5. Crop product photo's transparent padding by alpha bounding box before computing its aspect ratio and projection.
6. Scale the 2D asset relative to the landmarks, then apply user-adjustable **70–130% preview scale**.
7. If the detected anatomy is cropped, too small, low-confidence or too side-on for a frontal flat image, **hide the asset** and display repositioning guidance. Never fall back to another oversized 2D overlay behind the scenes.
8. Keep Alpha 0.4 synchronized camera-frame rendering so the coordinates and camera frame match temporally.

### What 0.7 does NOT do

- It does **not** infer true centimeters, clothing size, garment fit, body circumference, age/identity, or actual 3D geometry from a single RGB webcam.
- It does not solve z-depth occlusion of hands over the garment, cloth physics, or realistic glasses side views.
- A manually selected preview size multiplier changes a 2D mockup only; it is **not** a physical size measurement.

For true dimensions, require measured garment specifications (chest width, shoulder, length, etc.), an optional explicit customer size profile and a camera calibration reference or compatible depth sensor, with consent and privacy limits. Then use a calibrated body model; do not claim exact fit.

## Test cases

- Shirt top should be placed near the **shoulders**, never the face.
- Cropped/low-confidence hips hide T-shirt and show "move back, show shoulders and waist".
- Strong body turn or face yaw hides the **frontal 2D asset** (3D renderer required).
- Watch size follows actual detected palm width, not viewport size.
- Bag stays near hip only when upper body frame is complete.
- If camera preview works and AI pose fails, camera continues running.

Code: `src/fit-calibration.js`, `src/app.js`.  
Regression tests: `tests/body-calibration.test.mjs` and `tests/static-check.mjs`.

## Verify on phone

Open `https://altaqawy.github.io/rawnak-fit-ai/demo/` after Pages deployment; test each product in portrait camera. Verify source shows **ALPHA 0.7** and `JS 2026.11.18.070`. Stand far enough away to show shoulders and hips for shirts and bags. Keep the wrist and palm inside the frame for watches. Rotate face away for glasses to verify photo disappears with an instruction instead of floating at the wrong angle.

Passing code tests is not a guarantee of product geometry accuracy or camera-specific tracking. Capture results and revisit thresholds after real-device QA.
