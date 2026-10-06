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
 * Marquee nativo por CSS para os rails de produtos.
 *
 * Motivo: no iOS/Safari, animar scrollLeft por requestAnimationFrame ou criar
 * uma Web Animation por card pode sofrer throttling durante o scroll vertical.
 * Aqui movemos UM unico track com transform: translate3d(), deixando o
 * compositor do Safari cuidar da animacao sem reflow por frame.
 *
 * O rail ja vem duplicado pelo renderer V8. Ao mover exatamente a distancia
 * entre a primeira e a segunda copia, o loop fica continuo e sem salto.
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

      const children = Array.from(rail.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

      // Somente rails de produtos duplicados. Outros scrolls horizontais
      // (links, galeria, YouTube, categorias) continuam com gesto normal.
      if (children.length < 6 || children.length % 2 !== 0) return;
      if (!children[0]?.matches('article[role="button"]')) return;

      const halfIndex = children.length / 2;
      const distance = children[halfIndex].offsetLeft - children[0].offsetLeft;
      if (!Number.isFinite(distance) || distance <= 0) return;

      const parent = rail.parentElement;
      if (!parent) return;

      // Ao transformar o rail em width:max-content, o motor legado deixa de
      // enxergar overflow interno e para de alterar scrollLeft por frame.
      // O viewport passa a ser o elemento pai.
      rail.scrollLeft = 0;
      rail.classList.add("bc-v11-smooth-rail");
      parent.classList.add("bc-v11-smooth-wrap");

      const durationSeconds = Math.max(22, Math.min(46, distance / 38));
      rail.style.setProperty("--bc-v11-distance", `-${distance}px`);
      rail.style.setProperty("--bc-v11-duration", `${durationSeconds}s`);

      let resumeTimer = 0;
      const setPaused = (paused: boolean) => {
        rail.classList.toggle("bc-v11-paused", paused);
      };
      const pause = () => {
        window.clearTimeout(resumeTimer);
        setPaused(true);
      };
      const resume = (delay = 0) => {
        window.clearTimeout(resumeTimer);
        resumeTimer = window.setTimeout(() => setPaused(false), delay);
      };

      // iOS: touch events sao usados explicitamente, porque durante um scroll
      // vertical o Safari pode cancelar pointer events de maneira agressiva.
      const onTouchStart = () => pause();
      const onTouchEnd = () => resume(420);
      const onTouchCancel = () => resume(220);
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== "touch") pause();
      };
      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerType !== "touch") resume(80);
      };
      const onPointerCancel = (event: PointerEvent) => {
        if (event.pointerType !== "touch") resume(120);
      };
      const onMouseEnter = () => {
        if (finePointer.matches) pause();
      };
      const onMouseLeave = () => {
        if (finePointer.matches) resume(60);
      };
      const onVisibility = () => {
        if (document.visibilityState === "visible") resume(80);
      };

      rail.addEventListener("touchstart", onTouchStart, { passive: true });
      rail.addEventListener("touchend", onTouchEnd, { passive: true });
      rail.addEventListener("touchcancel", onTouchCancel, { passive: true });
      rail.addEventListener("pointerdown", onPointerDown, { passive: true });
      rail.addEventListener("pointerup", onPointerUp, { passive: true });
      rail.addEventListener("pointercancel", onPointerCancel, { passive: true });
      rail.addEventListener("mouseenter", onMouseEnter, { passive: true });
      rail.addEventListener("mouseleave", onMouseLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibility, { passive: true });

      cleanups.set(rail, () => {
        window.clearTimeout(resumeTimer);
        rail.removeEventListener("touchstart", onTouchStart);
        rail.removeEventListener("touchend", onTouchEnd);
        rail.removeEventListener("touchcancel", onTouchCancel);
        rail.removeEventListener("pointerdown", onPointerDown);
        rail.removeEventListener("pointerup", onPointerUp);
        rail.removeEventListener("pointercancel", onPointerCancel);
        rail.removeEventListener("mouseenter", onMouseEnter);
        rail.removeEventListener("mouseleave", onMouseLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        rail.classList.remove("bc-v11-smooth-rail", "bc-v11-paused");
        parent.classList.remove("bc-v11-smooth-wrap");
        rail.style.removeProperty("--bc-v11-distance");
        rail.style.removeProperty("--bc-v11-duration");
      });
    };

    const scan = () => {
      root.querySelectorAll<HTMLElement>(".bc-v8-scroll").forEach(install);
    };

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
        .bc-v11-smooth-wrap {
          overflow: hidden !important;
          position: relative;
        }
        .bc-v11-smooth-rail {
          width: max-content !important;
          max-width: none !important;
          overflow: visible !important;
          scroll-behavior: auto !important;
          touch-action: pan-y !important;
          overscroll-behavior-x: none !important;
          animation-name: bc-v11-marquee;
          animation-duration: var(--bc-v11-duration, 28s);
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          -webkit-transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .bc-v11-smooth-rail.bc-v11-paused {
          animation-play-state: paused !important;
        }
        .bc-v11-smooth-rail > * {
          flex: 0 0 auto;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .bc-v11-smooth-wrap > button[aria-label="Anterior"],
        .bc-v11-smooth-wrap > button[aria-label="Próximo"] {
          display: none !important;
        }
        @keyframes bc-v11-marquee {
          from {
            transform: translate3d(0, 0, 0);
            -webkit-transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(var(--bc-v11-distance), 0, 0);
            -webkit-transform: translate3d(var(--bc-v11-distance), 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .bc-v11-smooth-rail {
            animation: none !important;
            overflow-x: auto !important;
            width: auto !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      <BioCommerceLandingV10 {...props} />
    </div>
  );
}
