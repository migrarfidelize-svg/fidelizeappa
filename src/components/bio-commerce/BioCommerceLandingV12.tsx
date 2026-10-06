import { useEffect, useRef } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV11,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV11";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

type SavedStyles = {
  scrollX: number;
  scrollY: number;
  body: Partial<CSSStyleDeclaration>;
  html: Partial<CSSStyleDeclaration>;
};

/**
 * Trava a página atrás do checkout, inclusive no Safari/iOS.
 * O checkout continua rolando normalmente; somente a landing de fundo fica fixa.
 */
function useCheckoutBodyLock(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined" || typeof document === "undefined") return;

    let activeOverlay: HTMLElement | null = null;
    let saved: SavedStyles | null = null;
    let scanFrame = 0;

    const findCheckoutOverlay = () => {
      const checkoutButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        /concluir\s+e\s+enviar\s+no\s+whatsapp/i.test(button.textContent ?? ""),
      );
      if (!checkoutButton) return null;
      return checkoutButton.closest<HTMLElement>(".fixed.inset-0");
    };

    const preventBackgroundGesture = (event: Event) => {
      if (!activeOverlay) return;
      const target = event.target as Node | null;
      if (target && activeOverlay.contains(target)) return;
      if (event.cancelable) event.preventDefault();
    };

    const lock = (overlay: HTMLElement) => {
      if (activeOverlay === overlay && saved) return;
      if (saved) unlock();

      const body = document.body;
      const html = document.documentElement;
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      saved = {
        scrollX,
        scrollY,
        body: {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
          overscrollBehavior: body.style.overscrollBehavior,
        },
        html: {
          overflow: html.style.overflow,
          overscrollBehavior: html.style.overscrollBehavior,
        },
      };

      activeOverlay = overlay;
      overlay.style.overscrollBehavior = "contain";

      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = `-${scrollX}px`;
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "none";
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";

      document.addEventListener("touchmove", preventBackgroundGesture, { passive: false, capture: true });
      document.addEventListener("wheel", preventBackgroundGesture, { passive: false, capture: true });
    };

    function unlock() {
      if (!saved) {
        activeOverlay = null;
        return;
      }

      const body = document.body;
      const html = document.documentElement;
      const restore = saved;

      document.removeEventListener("touchmove", preventBackgroundGesture, true);
      document.removeEventListener("wheel", preventBackgroundGesture, true);

      body.style.position = String(restore.body.position ?? "");
      body.style.top = String(restore.body.top ?? "");
      body.style.left = String(restore.body.left ?? "");
      body.style.right = String(restore.body.right ?? "");
      body.style.width = String(restore.body.width ?? "");
      body.style.overflow = String(restore.body.overflow ?? "");
      body.style.overscrollBehavior = String(restore.body.overscrollBehavior ?? "");
      html.style.overflow = String(restore.html.overflow ?? "");
      html.style.overscrollBehavior = String(restore.html.overscrollBehavior ?? "");

      activeOverlay = null;
      saved = null;

      requestAnimationFrame(() => window.scrollTo(restore.scrollX, restore.scrollY));
    }

    const scan = () => {
      const overlay = findCheckoutOverlay();
      if (overlay) lock(overlay);
      else if (activeOverlay) unlock();
    };

    const scheduleScan = () => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
    scheduleScan();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(scanFrame);
      unlock();
    };
  }, [rootRef]);
}

export function BioCommerceLanding(props: {
  data: BioCommerceLandingData;
  slug: string;
  blockData?: BioCommerceBlockData;
  embedded?: boolean;
  interactive?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useCheckoutBodyLock(rootRef);

  return (
    <div ref={rootRef} className="bc-v12-runtime">
      <style>{`
        .bc-v12-runtime .fixed.inset-0 {
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
      <BioCommerceLandingV11 {...props} />
    </div>
  );
}
