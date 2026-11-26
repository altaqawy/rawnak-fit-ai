# RAWNAK FIT AI — Clothing Color Transfer Beta (Alpha 1.2)

Status: **Implemented on a feature branch as an opt-in prototype**, not a true neural garment-swap product.

## Product request

Give shoppers a more interactive experience with their existing clothing: a shopper ideally wears **the same category of garment** (tee for tee, jacket for jacket), points the camera at their upper body, and previews a different item as they move.

The existing system already has browser-local camera capture, MediaPipe PoseLandmarker and GLB/Three.js AR. It does **not** have apparel semantic segmentation, invisible-garment removal or photorealistic image generation.

## What this beta implements

1. Adds a same-type **color-transfer** choice for tee and jacket products, leaving the existing 3D preview as default.
2. Uses the current pose landmark engine and existing synchronized camera frame.
3. Tracks shoulder/hip geometry and only recolors a conservative central torso quadrilateral.
4. Uses canvas `color` compositing to retain some live-video shading while changing hue. User can control intensity.
5. Disables fast-camera mode during the transfer to avoid painting on a transparent frame; remains compatible with video capture.
6. Maintains the browser-local camera workflow. No video frame is sent to a generation service.
7. Declines to recolor if the upper-body pose is incomplete, too small or overly angled.
8. Immediately returns to the established GLB / Three.js system without affecting bag or accessory handling.

**Limitations:** This is not an AI cloth parser and does not faithfully replace the original shirt style, sleeves, collar, logos, texture or fabric. The central torso may include a small amount of non-garment area (especially with open jackets or unusual poses). Fit, scale and body measurements are approximations, not validated sizing. This mode is a visible proof of concept only. It works best with a similarly shaped light/plain top, sufficient illumination and a front-facing upper-body pose.

## Planned true clothing replacement engine

### A — Garment category and segmentation
- Ask for consent; initialize a clothing-segmentation model separately from existing pose tracking.
- Classify existing garment type with confidence; do **not** require a matching garment as a hard product rule. Offer guidance and a graceful fallback where uncertain.
- Produce per-pixel apparel/skin/arm masks, update at reduced FPS and propagate masks across intermediate frames. Avoid covering skin or hair.
- Use shoulder, torso, elbow and hip landmarks for registration and self-occlusion.
- Guard against side views, lost tracks, people overlapping and low lighting.

### B — Product-specific transfer
- Seller uploads approved item photos, relevant product construction data, size variants and materials.
- Prepare reusable garment texture/pattern/mesh and part segmentation once per SKU. Require merchant review for anything inferred.
- Warp target garment with the shopper's tracked pose, align collar/sleeves/hem and preserve shading. Use occlusion/collision logic.
- Support realistic soft cloth drape / fabric effects when there is suitable rigging and product data.
- Keep a clearly marked difference between visual *style preview* and a certified *size/fit estimate*.

### C — Optional higher-fidelity still preview
- With explicit consent, an optional one-off photo may be processed by a garment-transfer generative model where licensing, privacy, latency and cost are acceptable.
- Do not claim photorealistic generated frames can be computed locally at 30 FPS on all phones.
- Explicitly inform shoppers if a frame/photo is uploaded, retention rules and deletion paths.
- Continue the offline/browser-local AR experience even if any remote service fails.

## QA / acceptance

- Opt-in button is hidden for non-clothing SKUs; bags, watches, glasses and shoes remain unchanged.
- Browser-local video continues working when pose models or the experimental transfer are unavailable.
- Invalid pose prevents recoloring and displays an intelligible guide.
- Switching between color-transfer and 3D never opens a second camera session.
- Manual QA on desktop and Android before merging. The branch is **not production deployed** until verified.
