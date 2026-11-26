# Alpha 1.8 — adaptive garment lighting and validation

## Changes
- Optional low-resolution luminance field computed from the same camera frame and semantic clothing mask. Broad light and shadow differences modulate product RGB with a bounded gain; alpha is preserved. Fine patterns are attenuated, not guaranteed removed. Downsampling and imperfect masks can still introduce edge contamination.
- Adjustable 0–100% strength, default 45%. Available for product panel and articulated cutout, not recolor-only mode. Dark/insufficient evidence skips the effect. Lighting readback errors do not disable the camera.
- Retains spring-based cloth motion, asynchronous segmentation worker, same-frame composition and CPU fallback.
- Independent garment unit-check job separates the garment tests from the Studio dependency installation. The existing full CI job is retained.

## Evidence and blockers
24 synthetic checks passed in the JavaScript harness, including three new lighting checks. The app source parsed successfully. Previous GitHub Actions runs failed; the job steps were empty and log retrieval returned HTTP 404, so the original cause is unknown. A local headless Chromium smoke attempt timed out without a result; direct GitHub clone was blocked by DNS/network in the local environment. Real-camera/model inference, visual quality, GPU and end-to-end performance remain unverified. The independent CI job is not yet confirmed green.

## Limits
This is bounded screen-space illumination matching, not measured material reflectance, synthesized wrinkles or physically correct 3D lighting. Original clothing silhouettes and semantic occlusion remain limiting. Full replacement outside the old garment mask and robust crossed-arm handling are not implemented. Keep the PR draft, do not merge until independent and full CI pass and camera QA has been completed.
