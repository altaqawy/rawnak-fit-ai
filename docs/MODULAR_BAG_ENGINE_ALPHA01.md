# RAWNAK FIT — Modular Bag Engine Alpha 0.1

The current builder and export contract are documented in [Bag Atelier](BAG_ATELIER.md). This page records the original Alpha 0.1 design.

Date: 2026-11-18  
[Live structured bag-builder pilot](https://altaqawy.github.io/rawnak-fit-ai/studio/bag-builder.html)

## Revised merchant experience

This is a *bag-specific advanced* route alongside the original [Photo-Only Studio](https://altaqawy.github.io/rawnak-fit-ai/studio/library.html). The owner has now explicitly described the bag workflow as:

1. Enter the **bag structure with dimensions** (centimeters), style, flexible/rigid material, closure and carrying methods.
2. Enter interior design: number of main compartments, open inner pockets, zipped inner pockets, outer pockets, lining, and logo location/type.
3. Upload genuine images of **all required exterior and interior views**, including the opened bag, closure mechanism, partition layout, pockets, strap attachments and logo close-up.
4. Generate an independently editable **modular 3D structure**, with distinct front, back, side gussets, base, lining, dividers, pockets, handle/strap groups, closure nodes and logo.
5. Inspect which nodes are fixed versus movable, try simple hinge/strap motion, optionally correct part behavior labels and export GLB plus a JSON of its parts/constraints.
6. Later feed the verified asset into a *separate* RAWNAK AR tracking/rendering service.

The owner now wants *measurements before photos for bags*. This is **not** the previously stated photos-only route. The photo-only option remains available for simpler storefront product previews and categories other than the advanced handbag flow.

## What's implemented

- `studio/bag-spec.js` — input validation, conditional image-view checklist, product component graph, stiffness/rigidity labels, movement and joint semantics.
- `studio/bag-model.js` — new measured Three.js procedural generator of separate major panels, straps, lining, partitions, pockets, logo placement, hinges and zipper handle.
- `studio/bag-builder.html`, `studio/bag-builder.css`, `studio/bag-builder.js` — mobile-friendly UI, structured data form, image upload, optional view-label corrections, local real-time WebGL inspector, hinge opening, strap swing, interior X-ray, merchant part behavior corrections, local GLB + JSON export.
- `studio/tests/bag-spec.test.mjs` — guards for camera evidence requirements, closures, compartments, movable part metadata and publication limitations.

Bag dimensions are entered in centimeters and mapped to meters in the GLB mesh. This is a dimensional proof of architecture, **not a physical manufacturing pattern**: panel thickness, sewing allowances, material folds and strap curve are approximations.

### Required photo checklist, dynamically selected

**Always**: front, back, left, right, bottom, top, opened, interior.  
**Conditional**: inner pocket details, strap/handle attachment, zipper/clasp/closure, and close-up logo.

All files are processed in the browser; the generated *Parts JSON* contains photo filenames/angles/metadata **without image bytes**. If a user marks one uploaded photo as the logo, the viewer attempts to put that image on a logo plane of the draft. This is not a trademark extractor or correct metal embossing process yet.

### Component behavior

- Fixed structure: front/back panel, right/left gussets, base.
- Interior: lining, soft partitions, open and zipped pockets. These are exposed via an inspector X-ray (front panel hidden), not through physically accurate bag opening/sewing.
- Moving parts: strap/handle pivot groups, flap hinge if present, zipper slider if present. **Only simplified kinematic animations are wired**; no physically based collisions, real zipper mesh opening, drawstring tension or cloth deformation.
- Material classification: rigid/semi-rigid/flexible labels come from the structure form and can be corrected by the merchant. They do not currently imply simulated bend/stretch.
- Part correction data persists to model GLB extras and Parts JSON with source `merchant-review`, and **does not initiate training** or leave the browser.

### What is NOT implemented

- Image-to-parts instance segmentation, view recognition from raw pixels, accurate automatic reconstruction of bags from the supplied photos.
- Correct topology for every bag style. All styles share a box-like **structural preview** in v0.1; choose/tune real templates later rather than suggesting a hobo looks box-like in reality.
- Full inner pocket sewing, exact leather thickness, real flap/clasp/drawstring mechanics or logo removal from photographic background.
- Automatic extraction of unseen compartments, hidden closures, unseen logo/strap details, or real material elastic parameters from arbitrary photos.
- Automated AI learning from merchant corrections; feedback is local, not a trained model or cloud database.
- Production secure authenticated merchant storage, commercial model licensing and customer AR try-on from generated product geometry.

### Next technical milestones

**P1 — Accurate bag templates:** curated family-specific topology for Structured, Tote, Baguette, Hobo, Bucket etc, each with true named component boundaries, anchors, UV and constrained morph targets.

**P2 — Photo-to-parts vision:** segment body/straps/pockets/hardware; infer camera viewpoint; extract logo image with rights and isolate material regions; match against seller dimensions and separate front/back/interior photo sets. Unseen parts remain labeled **unverified**.

**P3 — Structural geometry fitting:** modify panel curves/seams, strap topology, depth, zippers/handles and visual texture projection to match real SKU photographs; QA via rendered front/back/side and opened/interior comparisons.

**P4 — Behavior and feedback:** fit hinges, stiffness values and physical strap dynamics; collect explicit merchant-reviewed corrections with opt-in privacy and rights and use them for quality eval/retraining offline.

**P5 — AR runtime:** render approved GLB / parts + JSON on-device, apply shoulder/hand anchors, dynamic occlusion, cloth/strap motion, separate GPU performance budgets. This is separate from model creation.

## Acceptance criteria before any commercial release

- Verify the dimensions, front/back/side silhouette, interior partitions and pockets against real merchant photographs (manual reviewed acceptance).
- Verify logo and hardware location, textures, ownership and licensed raw photos.
- Verify all movable joints and constrain their physical range without tearing/detaching.
- Label any inferred/hidden parts, mark missing views and refuse to claim exact 360-degree real-product match.
- Real Android and desktop browser preview; check GLB exporter and asset texture on actual device.
- Performance and privacy controls in production; never store merchant's private photos without an authorized policy.

See also [source research and licensed 3D tooling](ASSET_LIBRARY_RECONSTRUCTION_ROADMAP.md).
