# RAWNAK FIT Integration Contract v1 — Multi-Tenant Merchant SDK

Status: **Partial proof of concept.** A public/demo Web Component SDK, demo merchant store and URL-based category selection are now implemented on GitHub Pages. Secure merchant authentication, asset manifests, approved SKU models and production SaaS are **NOT deployed**. See [active SDK](../sdk/README.md).

## Product architecture

One multi-tenant service for multiple RAWNAK sites/merchant platforms:

- **RAWNAK AutoFit Studio**: seller onboarding, photo guidelines, size/material metadata, automatic category router, one-off asset generation job, QA and approval.
- **Asset Service**: immutable versioned GLB/GLTF, PBR textures, rig/motion profiles and size variations per SKU, potentially served from R2. Exact product status must be approved before published 360° preview.
- **Try-On Runtime**: camera + tracked face/hand/body + category engines: rigid objects (watches/rings/glasses), articulated jewelry, shoe/handbag attachment, deformable garments with drape simulation.
- **Widget SDK**: a short integration snippet that adds "جرّبه عليك" to any supported product card, launching a modal or hosted full-screen fallback. Shopify uses Theme App Extension; React/Next.js use a component wrapper; generic HTML uses Web Component.

## Runnable public demo SDK (already implemented)

The first Web Component is published in this repository at [sdk/rawnak-fit.js](../sdk/rawnak-fit.js) with a live sample store at [demo/](../demo/). The merchant passes category and product ID to a hosted iframe of the **existing schematic 2D AR mirror**, with a fallback to open in a new tab and a host-side add-to-cart event. This is a public test only: the SKU ID is not authenticated or resolved to approved GLB assets.

See [actual integration code and caveats](../sdk/README.md). The secure multi-tenant manifest API described below is a future deployment target.

## Future production merchant embed (NOT yet active)

\`\`\`html
<script defer src="https://cdn.rawnakgroup.com/fit/v1/widget.js"></script>
<rawnak-fit
  store-id="merchant-public-id"
  product-id="SHOP-SKU-001"
  button-text="جرّبه عليك"
  mode="modal">
</rawnak-fit>
\`\`\`

No secret key in public HTML. Domain authorization and published-asset checks live on the backend. An optional server-side credential is stored only in hosting environment variables.

### React / Next.js (proposed wrapper)

\`\`\`tsx
<RawnakTryOnButton
  storeId={store.publicId}
  productId={product.sku}
  variantId={selectedVariant.id}
  onAddToCart={({sku, variantId}) => addToCart(sku, variantId)}
/>
\`\`\`

### Host messaging

iframe (if chosen) needs explicit \`allow="camera"\`, HTTPS, and a compatible parent Permissions-Policy; the user initiates camera permission inside the frame. Some browsers may need full-screen redirection for reliable UX.

Only non-sensitive messages with allowed origins and strict schema:

- \`RAWNAK_FIT_READY\`: SDK ready; \`sku, variant, engine\`
- \`RAWNAK_FIT_ERROR\`: unsupported camera / missing asset / permission failure
- \`RAWNAK_FIT_ADD_TO_CART\`: exact sku, variant, size selected by shopper; merchant confirms and handles checkout
- \`RAWNAK_FIT_CLOSE\`: modal closed

Do **not** pass raw camera frames or photos to merchant sites. The camera session remains browser-local.

## Secure data flow

1. Store owner connects domain and uploads products via verified merchant token/Shopify app; product categories and variants remain under the merchant.
2. \`POST /v1/merchant/products\` (server auth) with category, dimensions, materials and secure upload references. Async preparation job emits ID.
3. Image QA + category assignment + segmentation + part labeling. Route to parametric/photogrammetry/image-to-3D/garment pattern engine. Human merchant approval for unknown geometry and motion labels.
4. \`GET /v1/products/{sku}/try-on-status\` returns \`not-ready | processing | needs-review | ready\` with engine and capture progress. Public response MUST be scoped to merchant domain and published variants.
5. Versioned approved assets served by CDN; runtime chooses the engine based on **SKU and render metadata** rather than store-wide hardcoding. A watch inside a clothing store still uses wrist tracking.
6. Customer visits store; widget reads product_id + selected size/color variant; requests approved asset manifest, opens try-on runtime.
7. Add-to-cart event passed to merchant's own storefront; no payment processing by FIT AI.

A seller may configure category defaults, but individual product category has precedence. Catalog updates invalidate only changed geometry/material versions.

## Example product manifest (concept)

\`\`\`json
{
  "storeId":"rawnak-demo",
  "sku":"WATCH-0001",
  "category":"watch",
  "assetVersion":"a1",
  "status":"ready",
  "captureQuality":"merchant-reviewed",
  "physicalDimensions":{"caseDiameterMm":42,"strapWidthMm":20},
  "bodyAnchor":"wrist",
  "geometry":{"glb":"/assets/watch-0001.a1.glb"},
  "parts":[
    {"id":"case","motion":"rigid","material":"metal","attachment":"wrist"},
    {"id":"glass","motion":"rigid","material":"glass","attachment":"case"},
    {"id":"strap","motion":"deformable","material":"leather","attachment":"wrist"},
    {"id":"buckle","motion":"hinged","material":"metal","attachment":"strap"}
  ],
  "variants":[{"id":"white-42","color":"white","geometryOverride":null}]
}
\`\`\`

This is **metadata**, not proof that image-only analysis can infer elasticity or mechanical constraints. Merchant supplies material type, real dimensions and confirms each part.

## Merchant tools

- Single account per store; permissions for owner, staff, reviewer.
- Guided category-specific image capture: \`/studio/capture.html?category=watch\`
- Automatic photo-count checks by category from \`studio/capture-profiles.js\`
- Upload quality: blur/duplicate/orientation/coverage checks and minimum dimensions; warnings for highly reflective/translucent objects.
- Confidence and merchant approval gates: missing views trigger correction instead of simulated fake product design.
- Asset-version cache; share geometry across colors and sizes where appropriate.
- Physics metadata: \`rigid | deformable | cloth | hinged | linked\` plus density/elasticity, stretch and bend parameters where meaningful.
- Monitoring: camera success rate, active/inference FPS, tracking confidence, asset approval time, GPU costs by product, completed try-on sessions. Respect privacy and consent.

## Component deployment architecture

- **Frontend/Widge**t: static CDN/Cloudflare Pages, package versioning, no direct GPU secret.
- **Application API**: edge/server functions for tenant/domain auth, rate limiting, signed upload URLs, product state.
- **Database**: Supabase/Postgres or equivalent, row-level isolation by merchant and audited asset approvals.
- **Blob Storage**: Cloudflare R2 or equivalent; signed/private raw photos, approved optimized public meshes where merchants permit.
- **Queue/GPU**: asynchronous worker; schedule expensive image-to-3D job once per geometry hash, with max-budget and manual retry. No image-gen per live frame.
- **Runtime Renderer**: category engine plugin interface with tracking strategy, asset contract, attachment and motion solver; fallback to static product images on unsupported devices.
- **Payments**: merchant store owns cart and checkout. FIT AI only emits events.

## Physics pipeline

Part labeling from photos (vision proposals, confidence scored) with mandatory seller confirmation:
- **Rigid:** metal ring, glasses lenses, watch case, hard bag frame; transform as one assembly.
- **Deformable:** leather strap, soft bag body, rubber sole.
- **Cloth:** T-shirts, dresses, hoodie sleeves; needs stretch/bend/density, cloth rig, anchors/colliders and layer collision.
- **Hinged:** glasses temples, bracelet buckle, bag clips.
- **Linked/chain:** chain bracelets, movable jewelry.

Photo material appearance (PBR base color, normal/roughness/metallic/transmission) is not equivalent to physical motion properties (weight, thickness, stretch, stiffness). Require seller/factory values, optional short motion video and testing. Do not use invented physical constants to claim product fit.

## Release gates

**Stage 1 (implemented prototype):** local capture guides, studio templates, public demo SDK and store page. **Stage 2:** secure asset API + merchant catalog + authenticated SDK; **Stage 3:** first merchant SKU with verified 3D wrist watch, then garment cloth; **Stage 4:** multi-merchant distribution, Shopify app and integration with all RAWNAK stores.

**A public demonstration of storefront integration is active**, but the future production CDN snippet in this architecture document is NOT an existing deploy. Do not use the demo SDK for commercial product claims or private assets until merchant domains, product manifests and approved 3D are secured and verified.

References:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://shopify.dev/docs/apps/build/online-store/theme-app-extensions
- https://docs.lensstudio.com/develop/foundation/physics/cloth-simulation
- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
