# RAWNAK FIT Embed SDK — Public Alpha 0.3

**Runnable store demo (after GitHub Pages deployment):**
https://altaqawy.github.io/rawnak-fit-ai/demo/

**Status:** reusable Web Component demo. NOT merchant-authenticated, not exact product GLB try-on, not production SaaS.

## Add to any HTML product page

Insert this script once:

    <script defer src="https://altaqawy.github.io/rawnak-fit-ai/sdk/rawnak-fit.js?v=20261118-04"></script>

Then place the component next to your add-to-cart button:

    <rawnak-fit store-id="demo-merchant"
      product-id="WATCH-DEMO-01"
      variant-id="silver-42"
      category="watch"
      product-name="ساعة Classic"
      button-text="جرّب الساعة"></rawnak-fit>

The component uses Shadow DOM for style isolation. When clicked it creates a camera-enabled iframe containing the *existing* RAWNAK FIT live mirror, picks its demo category, and opens in a modal. It offers a new-tab fallback and destroys the iframe on close.

## Currently supported demo categories

- watch → hand tracking and indicative wristwatch overlay
- bangle/bracelet → hand tracking and indicative bracelet overlay
- glasses → face tracking and indicative glasses overlay
- tshirt/shirt → body tracking and indicative shirt overlay
- jacket → body tracking and indicative jacket overlay
- bag → body tracking and indicative handbag overlay
- shoes → body tracking and indicative shoes overlay

Unknown or unimplemented category labels such as ring, dress, hoodie or earrings disable the widget instead of faking a different renderer.

## Connect the merchant cart

    document.addEventListener("rawnak-fit:add-to-cart", (event) => {
      const {storeId, productId, variantId, category} = event.detail;
      // Validate SKU/variant against your catalog.
      addToCart(productId, variantId);
    });

The SDK also dispatches rawnak-fit:open and rawnak-fit:close events (actual event names: RAWNAK below).

Actual event names:
- rawnak-fit:open
- rawnak-fit:close
- rawnak-fit:add-to-cart

These are host-side click events; they are NOT payment authorizations or proof that tracking succeeded. The merchant must control pricing, product availability, variant validation, cart and checkout.

## React / Next.js

Copy [RawnakTryOnButton.tsx](react/RawnakTryOnButton.tsx) into your Next.js codebase. It is a client component which loads the SDK once, passes selected SKU/category/variant as HTML attributes, and calls onAddToCart with the merchant's own handler. This is example source, not yet an npm package. It needs integration testing inside the destination Next.js app.

## Browser / camera prerequisites

- The merchant site and RAWNAK iframe must use HTTPS. Localhost is suitable for desktop testing.
- The iframe uses the allow="camera" attribute. Merchants must ensure their Permissions-Policy does not deny camera delegation; browser/device compatibility should be tested. A standalone new-tab fallback is available.
- The customer explicitly initiates the camera from the preview; camera access is not automatic on product-page load.
- The demo process keeps webcam frames in the browser and does not upload them to the merchant.
- The host may constrain fixed-position modals if elements are inside transformed containers; a top-level portal and accessibility audit are planned for production.

MDN:
https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera
https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/allow
https://developer.mozilla.org/en-US/docs/Web/API/Web_components

## Security and honesty

Public HTML attributes such as store-id, product-id and category are untrusted. **No merchant authorization, domain allowlist, catalog lookup, product approval or usage quota is in this SDK**. These require a secure server-side product manifest API; don't use it to grant access to private assets or certify 360° accuracy.

The selected SKU is used to label a illustrative 3D mesh overlay; the SDK does not load or reconstruct the merchant product's actual 3D model. There is no real-size measurement or fabric physics guarantee.

## Next release tasks

1. Secure multi-tenant catalog/manifest API with merchant/domain authorization and versioned approved assets.
2. Approved GLB/texture loading in watch/ring/clothing renderer; avoid user-provided asset URLs.
3. Embeddable rendering UI with device-dependent full-screen fallback and tracking error recovery.
4. Storefront adapters, on-prem React/Next.js QA, Shopify extension after verification.
5. Capture-Guide QA checks and genuine photo-to-3D preparation, with seller material confirmations.

See [full integration architecture](../docs/INTEGRATION_ARCHITECTURE_V1.md).

## Validation

Configured checks:
- node --check sdk/rawnak-fit.js
- node tests/sdk.smoke.mjs
- node tests/static-check.mjs
- node tests/frame-sync.smoke.mjs

Browser camera, iframe permission behavior and the new sample store need real-device QA. GitHub Actions results must be separately confirmed.

## Alpha 0.3 Live Three.js demo update

The standalone and embedded camera now default to **3D WebGL demonstration meshes** for watch, glasses, shoulder bag, T-shirt, jacket, bangle and shoes. Camera tracking and frame synchronization are unchanged. Previously generated SKU photo cutouts remain an explicit 2D comparison mode.

3D inspector (camera free): https://altaqawy.github.io/rawnak-fit-ai/diagnostics/3d-preview.html

**These are generic meshes, not merchant-SKU-verified 3D assets.** Exact clothing motion, occlusion, material authenticity and true size still require approved GLB, rigging, and physical measurements. See [Alpha 0.8 implementation details](../docs/AR3D_ALPHA08.md).
