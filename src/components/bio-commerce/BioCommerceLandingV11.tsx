import { useEffect, useRef } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV10,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV10";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

/**
 * Corrige o auto-scroll em iOS: o rail antigo movimenta scrollLeft a cada frame
 * e pode ficar pausado por eventos touch/hover sintetizados pelo Safari.
 * Aqui mantemos o motor antigo pausado e movemos os cards via transform no
 * compositor, sem reflow por frame. Tocar pausa; soltar retoma suavemente.
 */
function useSmoothProductRails(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const cleanups = new Map<HTMLElement, () => void>();
    let scanFrame = 0;
    let resizeTimer = 0;

    const install = (rail: HTMLElement) => {
      if (cleanups.has(rail) || reduced.matches) return;

      const children = Array.from(rail.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
      if (children.length < 6 || children.length % 2 !== 0) return;
      if (!children[0]?.matches('article[role="button"]')) return;

      const halfIndex = children.length / 2;
      const distance = children[halfIndex].offsetLeft - children[0].offsetLeft;
      if (!Number.isFinite(distance) || distance < rail.clientWidth * 0.7) return;

      rail.classList.add("bc-v11-smooth-rail");
      rail.parentElement?.classList.add("bc-v11-smooth-wrap");
      rail.scrollLeft = 0;

      const keepLegacyPaused = () => {
        try {
          rail.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        } catch {
          // O compositor novo continua funcionando mesmo sem esse fallback.
        }
      };
      keepLegacyPaused();

      const duration = Math.max(16000, (distance / 42) * 1000);
      const animations = children.map((child) =>
        child.animate(
          [
            { transform: "translate3d(0,0,0)" },
            { transform: `translate3d(-${distance}px,0,0)` },
          ],
          { duration, iterations: Infinity, easing: "linear", fill: "both" },
        ),
      );

      let resumeTimer = 0;
      const pause = (event?: Event) => {
        if (event && !event.isTrusted) return;
        window.clearTimeout(resumeTimer);
        animations.forEach((animation) => animation.pause());
      };
      const resume = (delay = 320) => {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => {
          keepLegacyPaused();
          animations.forEach((animation) => animation.play());
        }, delay);
      };

      const onPointerDown = (event: PointerEvent) => pause(event);
      const onPointerUp = (event: PointerEvent) => {
        if (!event.isTrusted) return;
        resume(event.pointerType === "touch" ? 420 : 100);
      };
      const onPointerCancel = (event: PointerEvent) => {
        if (!event.isTrusted) return;
        resume(180);
      };
      const onMouseEnter = (event: MouseEvent) => {
        if (finePointer.matches) pause(event);
      };
      const onMouseLeave = (event: MouseEvent) => {
        if (finePointer.matches && event.isTrusted) resume(80);
      };

      rail.addEventListener("pointerdown", onPointerDown, { passive: true });
      rail.addEventListener("pointerup", onPointerUp, { passive: true });
      rail.addEventListener("pointercancel", onPointerCancel, { passive: true });
      rail.addEventListener("mouseenter", onMouseEnter, { passive: true });
      rail.addEventListener("mouseleave", onMouseLeave, { passive: true });

      cleanups.set(rail, () => {
        window.clearTimeout(resumeTimer);
        rail.removeEventListener("pointerdown", onPointerDown);
        rail.removeEventListener("pointerup", onPointerUp);
        rail.removeEventListener("pointercancel", onPointerCancel);
        rail.removeEventListener("mouseenter", onMouseEnter);
        rail.removeEventListener("mouseleave", onMouseLeave);
        animations.forEach((animation) => animation.cancel());
        rail.classList.remove("bc-v11-smooth-rail");
        rail.parentElement?.classList.remove("bc-v11-smooth-wrap");
      });
    };

    const scan = () => root.querySelectorAll<HTMLElement>(".bc-v8-scroll").forEach(install);
    const scheduleScan = () => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    };
    const resetForResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cleanups.forEach((cleanup) => cleanup());
        cleanups.clear();
        scheduleScan();
      }, 180);
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", resetForResize, { passive: true });
    reduced.addEventListener?.("change", resetForResize);
    scheduleScan();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(scanFrame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resetForResize);
      reduced.removeEventListener?.("change", resetForResize);
      cleanups.forEach((cleanup) => cleanup());
      cleanups.clear();
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
  useSmoothProductRails(rootRef);

  return (
    <div ref={rootRef} className="bc-v11-runtime">
      <style>{`
        .bc-v11-smooth-rail {
          overflow-x: hidden !important;
          scroll-behavior: auto !important;
          touch-action: pan-y !important;
          contain: layout paint;
        }
        .bc-v11-smooth-rail > * {
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
        }
        .bc-v11-smooth-wrap > button[aria-label="Anterior"],
        .bc-v11-smooth-wrap > button[aria-label="Próximo"] {
          display: none !important;
        }
      `}</style>
      <BioCommerceLandingV10 {...props} />
    </div>
  );
}
