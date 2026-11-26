# Alpha 1.3 — semantic garment color transfer

The live clothing swap prototype now uses Google's MediaPipe SelfieMulticlass ImageSegmenter rather than a pose-only torso polygon. The model is loaded only when the shopper opts into color transfer. Inference runs on the browser CPU. The model download is from Google's published model URL; video frames are not sent to a server.

## Current functionality
- Semantic class 4 (clothing) is intersected with a pose-derived upper-body region, with one-pixel erosion at ambiguous edges. Hair, face, skin, background and accessories are not intentionally tinted.
- Segmentation and pose tracking consume the same sampled frame. A missing or invalid mask never reuses an older mask or falls back to an unmasked tint.
- The display preserves the camera image, overlays only the tinted cloth mask, and retains original fabric shading as much as Canvas color blending allows.
- Default 3D mode, accessories, bag tools and camera permissions are unchanged. A model-loading or inference error leaves the raw camera visible, with retry and return-to-3D options.
- The segmentation mode caps attempted frame analysis at 10Hz. Actual rate is device-dependent; the CPU model is synchronous on the main thread, so stutter on weaker phones is expected.

## Not yet implemented
- Distinguishing shirts, jackets and trousers as separate semantic labels. The model has a single clothing class; same-type guidance remains manual.
- Exact neckline, sleeve length, pattern, logo, material or product replacement; hidden body geometry and true fit/size cannot be reconstructed by this model.
- Multi-person instance isolation, robust boundary confidence, temporal warping, worker-based asynchronous processing, GPU benchmarks, or validated mobile camera results.
- Immutable model artifact pinning, license review, and commercial release approval.

## Verification
Synthetic category-mask checks and mocked compositor behavior passed during development. The full GitHub Actions workflow is not verified green and actual model download/inference/camera performance has not been validated. Do not merge or publish as production ready.

## Next engineering step
Build a worker-based same-frame segmentation pipeline and a product-specific garment warper using approved product texture/cutout and pose landmarks, followed by occlusion-aware compositing. Test target SKU fidelity and device latency before extending to other garment categories. Avoid any claims about certified fit.

References:
- https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter
- https://developers.google.com/edge/api/mediapipe/js/tasks-vision.imagesegmenter
