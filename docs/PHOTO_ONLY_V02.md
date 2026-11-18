# RAWNAK FIT AI — Photo-Only Merchant Flow v0.2

Date: 2026-11-18. Primary page: **https://altaqawy.github.io/rawnak-fit-ai/studio/library.html**

## Product requirement

The merchant uploads **photos and nothing else**. They must never be required to model 3D, label viewing angles, enter dimensions, choose product category, select a template, or provide a rigged GLB.

What the system does automatically for now:
1. Accepts 1–24 JPEG/PNG/WebP photos (10 MB each) as local browser File objects.
2. Runs TensorFlow.js MobileNetV2 locally on up to three images (downloaded from CDN), aggregates class predictions, combines these with filename hints, and selects a category when evidence exists.
3. Uses `studio/auto-template-registry.js` to route 11 families to appropriate reusable template IDs and tracking engines; this is **template classification, not geometry reconstruction**.
4. Estimates an approximate product foreground color from the first image; may fail for jewelry, patterned or low-contrast images, with no claim of reliable color identification.
5. Loads a lightweight generic 3D template (existing Three.js geometries or the skinned reference tee GLB). Applies color to recognized surface groups, then allows pointer drag rotation.
6. Offers an optional metadata JSON download. Images stay on-device; no external processing service receives user images.

All real product 3D geometry/UV material/bone fitting features remain experimental or unimplemented.

## Coverage

| Product category | Generic 3D preview | Dedicated accurate image-to-3D |
| --- | --- | --- |
| T-shirt | Skinned reference tee GLB | Not connected |
| Jacket | Generic geometry | Not connected |
| Hoodie | Not yet; don't pretend a T-shirt is a hoodie | Not connected |
| Dress | Not yet | Not connected |
| Watch | Case/dial/strap generic geometry | Not connected |
| Ring | Generic band with placeholder stone | Not connected |
| Bracelet/Bangle | Generic loop | Not connected |
| Glasses | Generic frame | Not connected |
| Earrings | Generic earrings | Not connected |
| Bag | Generic bag and strap geometry | Not connected |
| Shoes | Generic shoe | Not connected |

Unknown/ambiguous classification: **do not guess a category or show the wrong product**.

## Template Matching Architecture — next stage

```text
Merchant photos (only input)
    |
    +--> on-device category classification
    +--> automatic angle estimation (missing)
    +--> foreground/part segmentation (missing)
    +--> material/detail feature extraction (missing)
    |
Subcategory template registry (license-checked)
    |
Automatic template deformation (geometry silhouette + parts)
    |
Texture baking from product photos and valid material parameters
    |
Reference image vs generated front/back/side render comparison
    |
Optional fallback 3D reconstruction job per SKU (server-side)
    |
Mobile-compressed GLB -> user camera AR (cached, no token cost each frame)
```

Using only images is a product **UX input constraint**. It does not mean that absolute millimeter fit, unseen rear geometry, material stiffness, or body size can be scientifically determined from arbitrary photographs. It requires uncertainty handling, additional internally trained category models, and an optional preview warning when geometry cannot be verified.

## Changes

- `studio/library.html`: replaced manual form with upload-only one-screen flow.
- `studio/auto.css`: responsive photo-only UI.
- `studio/auto-template-registry.js`: 11-category router, safe unknowns, immutable non-approved draft.
- `studio/auto.js`: automatic inference + approximate color + 3D preview, no raw photo upload.
- `src/fit-3d-renderer.js`: ring and earrings generic 3D templates.
- `studio/index.html`: legacy manual tool is still available for developers but calls out upload-only Studio as the default merchant experience.
- `studio/tests/photo-only.test.mjs`: new regression checks.
- GitHub Issue #6 updated to prioritize automated silhouette/texture matching, with no manual GLB or measurement fields.

## Limits and performance

- MobileNet is a generic ImageNet classifier, not a custom-trained product category model. Unknown classification is allowed.
- `ObjectURL` lifetime and WebGL disposal are important on mid-range phones.
- GitHub Pages hosts the static UI, CDNs and fixed reference geometry; it cannot securely host commercial external reconstruction API secrets.
- Exact design reconstruction still requires segmentation and material/geometry projection or a model-generation worker.
- Any published accurate product requires a separate behind-the-scenes quality and legal review, without changing the seller's photos-only intake.
