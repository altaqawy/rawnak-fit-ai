# Alpha 1.4 — local product front-panel texture transfer

This prototype extends Alpha 1.3 semantic color transfer with a pose-driven 2D mesh. It does not generate a new 3D garment or replace its entire silhouette.

## How to try (feature branch, not production)
1. Select tee or jacket; choose a similar garment to wear in front of the camera.
2. Open the product panel, choose a rectangular crop of the front fabric (preferred), or select automatic central crop for a full frontal product image. A bundled synthetic tee sample is also available.
3. Select a PNG, JPEG or WebP image up to 10 MB. The image is decoded locally and reduced to at most 768 pixels along its longest edge; no uploaded product image is sent to a server.
4. The image enables the synchronized semantic preview. Use the strength slider; switch to color-only or back to 3D, or remove the local image.

## Engineering
- 12 affine triangles track the shoulder/hip anchors and follow their angle and body motion. The source panel is warped to the central torso, not sleeves.
- The existing semantic clothes mask clips the warped texture to the same captured camera frame. Missing mask or unreliable pose produces no texture overlay.
- The intermediate compositing layer is capped at 640 px on its longest edge. This reduces canvas work but may soften detail; it does not solve CPU inference latency.
- Product photos are kept in temporary per-category browser memory; local blob URLs are revoked after decoding. Nothing is persisted or uploaded. Demo image is synthetic and not an approved SKU.
- A front-panel crop must exclude background, collar, and sleeves. The automatic crop is a heuristic, not AI product parsing.
- No fit prediction, real material simulation, reliable cloth wrinkles, neckline reconstruction, sleeve transfer, or side/back view reconstruction. At low opacity original garment details may remain visible. Segmentation errors remain possible.

## Verification
Four new geometry/compositing tests and three existing semantic mask tests passed in a JavaScript harness with synthetic landmarks and mocked canvases; app source parsed successfully. No physical camera/browser visual QA or full CI pass is confirmed.

## Next
Move semantic inference away from the main UI thread (worker / GPU fallback after browser compatibility testing), then build merchant-approved full garment assets with sleeve/collar/hem anchors and calibrated texture/shading. Do not claim true photorealistic garment replacement until tested.
