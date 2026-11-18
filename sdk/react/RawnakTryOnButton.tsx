"use client";

import { useEffect, useRef } from "react";

const DEFAULT_SDK =
  "https://altaqawy.github.io/rawnak-fit-ai/sdk/rawnak-fit.js?v=20261118-03";

export type FitCategory =
  | "watch" | "bangle" | "bracelet" | "glasses"
  | "tshirt" | "shirt" | "jacket" | "bag" | "shoes";

export type RawnakFitCartItem = {
  storeId: string;
  productId: string;
  variantId: string;
  category: FitCategory;
  origin: "rawnak-fit-sdk-demo";
};

export type RawnakTryOnProps = {
  storeId: string;
  productId: string;
  variantId?: string;
  category: FitCategory;
  productName: string;
  label?: string;
  onAddToCart?: (item: RawnakFitCartItem) => void;
};

let sdkPromise: Promise<void> | null = null;

function loadSDK(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (customElements.get("rawnak-fit")) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = DEFAULT_SDK;
      script.defer = true;
      script.onload = () => {
        if (customElements.get("rawnak-fit")) resolve();
        else reject(new Error("RAWNAK FIT SDK script did not register"));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Unable to load RAWNAK FIT SDK"));
      };
      document.head.append(script);
    }).catch((error) => {
      sdkPromise = null; // allow a retry on a later mount
      throw error;
    });
  }
  return sdkPromise;
}

/**
 * Demo-only React / Next.js adapter for the public FIT SDK.
 * The current runtime uses illustrative 2D AR overlays, not approved SKU GLB assets.
 * Your own store must implement cart and checkout.
 */
export default function RawnakTryOnButton({
  storeId,
  productId,
  variantId = "",
  category,
  productName,
  label = "جرّبه عليك",
  onAddToCart,
}: RawnakTryOnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCartRef = useRef(onAddToCart);
  onCartRef.current = onAddToCart;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let component: HTMLElement | null = null;

    const listener = (event: Event) => {
      const item = (event as CustomEvent<RawnakFitCartItem>).detail;
      // The merchant owns validation of SKU / variant before performing a cart action.
      if (item.productId !== productId || item.storeId !== storeId) return;
      onCartRef.current?.(item);
    };
    loadSDK().then(() => {
      if (cancelled) return;
      component = document.createElement("rawnak-fit");
      component.setAttribute("store-id", storeId);
      component.setAttribute("product-id", productId);
      component.setAttribute("variant-id", variantId);
      component.setAttribute("category", category);
      component.setAttribute("product-name", productName);
      component.setAttribute("button-text", label);
      component.addEventListener("rawnak-fit:add-to-cart", listener);
      container.replaceChildren(component);
    }).catch((error) => {
      if (!cancelled) console.error("[RAWNAK FIT]", error);
    });

    return () => {
      cancelled = true;
      component?.removeEventListener("rawnak-fit:add-to-cart", listener);
      component?.remove();
    };
  }, [storeId, productId, variantId, category, productName, label]);

  return <div ref={containerRef} data-rawnak-fit-container />;
}
