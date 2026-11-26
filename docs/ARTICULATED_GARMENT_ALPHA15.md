# Alpha 1.5 — articulated front garment preview

This release adds a calibrated 2D garment cutout warp to the existing semantic color and front-panel texture modes. Existing 3D and accessory previews remain separate.

## How to use
1. Select an upper garment, and wear a similarly shaped garment with similar sleeve length.
2. In Product Panel, select the full garment cutout option for short or long sleeves.
3. Load a front-facing flat product cutout with a transparent background (PNG or WebP). The image is decoded locally; the engine trims transparent margins. Opaque photographs are rejected in this mode; use front-panel texture instead.
4. Inspect the 11 source anchors. Defaults are approximate. Select an anchor and click its correct point in the product image. Left and right refer to the displayed image, not the person's anatomical sides. Reset is available.
5. Start the synchronized camera preview. The upper body, elbows and (for long sleeves) wrists should remain visible. The existing opacity slider controls the overlay.
6. Keep arms uncrossed and face the camera. Hidden, crossed or unsuitable poses and invalid mesh triangles suppress the garment overlay rather than reusing an old shape.

## Implementation
- 8 torso triangles and 2 triangles per short sleeve, or 4 per long sleeve. Long sleeves use a separate elbow segment and wrist cuff placement.
- Editable source UV anchors for shoulders, neckline, underarms, hem and both cuff edges. Source image alpha preserves the visible cutout; target placement follows pose geometry.
- Semantic clothing segmentation remains the final clipping mask. Long sleeve regions extend along tracked arms. The overlay does not intentionally paint skin, hair or background.
- Reuse mask image buffers and canvas dimensions. The synchronized cadence adapts between 100 and 300 ms using measured processing time. This limits work on slower devices; it is not a demonstrated FPS improvement.
- Existing panel transfer and color modes remain available. Uploaded images and anchor settings stay in memory and are not sent to a server.

## Limitations
This is an approximate, front-view image warp, not full garment replacement. A new silhouette cannot extend beyond the detected original clothing mask; uncovered original fabric remains visible, and hidden skin cannot be reconstructed. The neckline and cuffs are mapped from the supplied cutout, not regenerated. No physically accurate cloth drape, sizing, back view, or generative inpainting. The source landmarks need manual correction for many garment designs. A true replacement would require a separate, validated video try-on pipeline with temporal consistency, garment construction or multi-view data, and robust occlusion handling. Segmentation still runs on the main thread, so worker/GPU optimization is pending.

## Verification
Five new cutout checks and seven existing texture/semantic-mask checks passed in the synthetic JavaScript harness, including short/long sleeve geometry, crossing/visibility rejection, transparent crop, cuff masks and buffer reuse. The four changed JS modules parsed successfully and markup contracts were checked. Browser-camera visual testing, real-device latency, full CI and release approval are still pending.

## Next
Validate camera and model availability, benchmark real device FPS/latency, test calibrated photos and lighting conditions, then move segmentation off the main thread. Develop a temporally consistent garment reconstruction/replacement method before claiming realistic changes in cut or fit.
