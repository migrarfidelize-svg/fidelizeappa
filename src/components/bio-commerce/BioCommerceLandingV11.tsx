import { useEffect, useRef } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV10,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV10";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

function readTranslateX(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  try {
    return new DOMMatrixReadOnly(transform).m41;
  } catch {
    const match = /matrix(?:3d)?\(([^)]+)\)/.exec(transform);
    if (!match) return 0;
    const values = match[1].split(",").map((value) => Number(value.trim()));
    return transform.startsWith("matrix3d") ? Number(values[12] ?? 0) : Number(values[4] ?? 0);
  }
}

/**
 * Rail continuo para produtos, otimizado para Safari/iOS.
 *
 * Regras importantes:
 * - uma unica animacao de transform no track inteiro;
 * - resize apenas por mudanca REAL de largura (a barra do Safari altera a
 *   altura durante o scroll e nao pode reiniciar o carrossel);
 * - tocar/segurar pausa no ponto atual;
 * - arrastar horizontalmente move para frente ou para tras;
 * - ao soltar, o loop continua exatamente da posicao em que ficou.
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
    let viewportWidth = window.innerWidth;

    const install = (rail: HTMLElement) => {
      if (cleanups.has(rail) || reduced.matches) return;

      const children = Array.from(rail.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );

      // So rails de produtos duplicados. Links, galeria, YouTube e categorias
      // continuam com scroll horizontal nativo.
      if (children.length < 6 || children.length % 2 !== 0) return;
      if (!children[0]?.matches('article[role="button"]')) return;

      const halfIndex = children.length / 2;
      const distance = children[halfIndex].offsetLeft - children[0].offsetLeft;
      if (!Number.isFinite(distance) || distance <= 0) return;

      const parent = rail.parentElement;
      if (!parent) return;

      rail.scrollLeft = 0;
      rail.classList.add("bc-v11-smooth-rail");
      parent.classList.add("bc-v11-smooth-wrap");

      const durationSeconds = Math.max(22, Math.min(46, distance / 38));
      rail.style.setProperty("--bc-v11-distance", `-${distance}px`);
      rail.style.setProperty("--bc-v11-duration", `${durationSeconds}s`);
      rail.style.setProperty("--bc-v11-delay", "0s");

      let resumeTimer = 0;
      let dragging = false;
      let horizontalDrag = false;
      let startX = 0;
      let startY = 0;
      let startOffset = 0;
      let currentOffset = 0;
      let suppressClick = false;
      let activePointerId: number | null = null;

      const normalizeOffset = (value: number) => {
        if (!Number.isFinite(value) || distance <= 0) return 0;
        let next = value % distance;
        if (next > 0) next -= distance;
        if (next <= -distance) next += distance;
        return next;
      };

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

      const beginDrag = (x: number, y: number) => {
        window.clearTimeout(resumeTimer);
        const renderedOffset = normalizeOffset(readTranslateX(rail));
        dragging = true;
        horizontalDrag = false;
        startX = x;
        startY = y;
        startOffset = renderedOffset;
        currentOffset = renderedOffset;
        rail.classList.add("bc-v11-paused", "bc-v11-dragging");
        rail.style.transform = `translate3d(${renderedOffset}px,0,0)`;
        rail.style.webkitTransform = `translate3d(${renderedOffset}px,0,0)`;
      };

      const moveDrag = (x: number, y: number, event?: Event) => {
        if (!dragging) return;
        const dx = x - startX;
        const dy = y - startY;

        if (!horizontalDrag && Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.05) {
          horizontalDrag = true;
          suppressClick = true;
        }

        if (!horizontalDrag) return;
        if (event?.cancelable) event.preventDefault();

        currentOffset = normalizeOffset(startOffset + dx);
        rail.style.transform = `translate3d(${currentOffset}px,0,0)`;
        rail.style.webkitTransform = `translate3d(${currentOffset}px,0,0)`;
      };

      const finishDrag = (delay = 180) => {
        if (!dragging) {
          resume(delay);
          return;
        }

        dragging = false;
        const normalized = normalizeOffset(currentOffset);
        const progress = distance > 0 ? Math.max(0, Math.min(1, -normalized / distance)) : 0;
        rail.style.setProperty("--bc-v11-delay", `${-(progress * durationSeconds)}s`);
        rail.classList.remove("bc-v11-dragging");
        rail.style.removeProperty("transform");
        rail.style.removeProperty("-webkit-transform");
        resume(delay);
      };

      // Touch dedicado evita o cancelamento agressivo de pointer events no iOS.
      const onTouchStart = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;
        beginDrag(touch.clientX, touch.clientY);
      };
      const onTouchMove = (event: TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;
        moveDrag(touch.clientX, touch.clientY, event);
      };
      const onTouchEnd = () => finishDrag(260);
      const onTouchCancel = () => finishDrag(120);

      // Mouse/pen tambem podem arrastar o rail no desktop.
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        activePointerId = event.pointerId;
        beginDrag(event.clientX, event.clientY);
        try { rail.setPointerCapture(event.pointerId); } catch { /* noop */ }
      };
      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch" || activePointerId !== event.pointerId) return;
        moveDrag(event.clientX, event.clientY, event);
      };
      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerType === "touch" || activePointerId !== event.pointerId) return;
        activePointerId = null;
        try { rail.releasePointerCapture(event.pointerId); } catch { /* noop */ }
        finishDrag(80);
      };
      const onPointerCancel = (event: PointerEvent) => {
        if (event.pointerType === "touch" || activePointerId !== event.pointerId) return;
        activePointerId = null;
        finishDrag(100);
      };

      const onMouseEnter = () => {
        if (finePointer.matches && !dragging) pause();
      };
      const onMouseLeave = () => {
        if (finePointer.matches && !dragging) resume(60);
      };
      const onVisibility = () => {
        if (document.visibilityState === "visible" && !dragging) resume(60);
      };
      const onClickCapture = (event: MouseEvent) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      };

      rail.addEventListener("touchstart", onTouchStart, { passive: true });
      rail.addEventListener("touchmove", onTouchMove, { passive: false });
      rail.addEventListener("touchend", onTouchEnd, { passive: true });
      rail.addEventListener("touchcancel", onTouchCancel, { passive: true });
      rail.addEventListener("pointerdown", onPointerDown, { passive: true });
      rail.addEventListener("pointermove", onPointerMove, { passive: false });
      rail.addEventListener("pointerup", onPointerUp, { passive: true });
      rail.addEventListener("pointercancel", onPointerCancel, { passive: true });
      rail.addEventListener("mouseenter", onMouseEnter, { passive: true });
      rail.addEventListener("mouseleave", onMouseLeave, { passive: true });
      rail.addEventListener("click", onClickCapture, true);
      document.addEventListener("visibilitychange", onVisibility, { passive: true });

      cleanups.set(rail, () => {
        window.clearTimeout(resumeTimer);
        rail.removeEventListener("touchstart", onTouchStart);
        rail.removeEventListener("touchmove", onTouchMove);
        rail.removeEventListener("touchend", onTouchEnd);
        rail.removeEventListener("touchcancel", onTouchCancel);
        rail.removeEventListener("pointerdown", onPointerDown);
        rail.removeEventListener("pointermove", onPointerMove);
        rail.removeEventListener("pointerup", onPointerUp);
        rail.removeEventListener("pointercancel", onPointerCancel);
        rail.removeEventListener("mouseenter", onMouseEnter);
        rail.removeEventListener("mouseleave", onMouseLeave);
        rail.removeEventListener("click", onClickCapture, true);
        document.removeEventListener("visibilitychange", onVisibility);
        rail.classList.remove("bc-v11-smooth-rail", "bc-v11-paused", "bc-v11-dragging");
        parent.classList.remove("bc-v11-smooth-wrap");
        rail.style.removeProperty("--bc-v11-distance");
        rail.style.removeProperty("--bc-v11-duration");
        rail.style.removeProperty("--bc-v11-delay");
        rail.style.removeProperty("transform");
        rail.style.removeProperty("-webkit-transform");
      });
    };

    const scan = () => {
      root.querySelectorAll<HTMLElement>(".bc-v8-scroll").forEach(install);
    };

    const scheduleScan = () => {
      cancelAnimationFrame(scanFrame);
      scanFrame = requestAnimationFrame(scan);
    };

    // Safari/iOS dispara resize quando a barra de endereco aparece/some durante
    // o scroll vertical. Isso NAO pode reinstalar a animacao. So recalculamos
    // quando a largura realmente mudou (rotacao, split view, resize desktop).
    const resetForMeaningfulResize = () => {
      const nextWidth = window.innerWidth;
      if (Math.abs(nextWidth - viewportWidth) < 2) return;
      viewportWidth = nextWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cleanups.forEach((cleanup) => cleanup());
        cleanups.clear();
        scheduleScan();
      }, 180);
    };

    const observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", resetForMeaningfulResize, { passive: true });
    reduced.addEventListener?.("change", resetForMeaningfulResize);
    scheduleScan();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(scanFrame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resetForMeaningfulResize);
      reduced.removeEventListener?.("change", resetForMeaningfulResize);
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
          touch-action: pan-y pinch-zoom !important;
          overscroll-behavior-x: none !important;
          animation-name: bc-v11-marquee;
          animation-duration: var(--bc-v11-duration, 28s);
          animation-delay: var(--bc-v11-delay, 0s);
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          -webkit-transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          cursor: grab;
        }
        .bc-v11-smooth-rail.bc-v11-paused {
          animation-play-state: paused !important;
        }
        .bc-v11-smooth-rail.bc-v11-dragging {
          animation: none !important;
          cursor: grabbing;
          user-select: none;
          -webkit-user-select: none;
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
            touch-action: pan-x pan-y !important;
          }
        }
      `}</style>
      <BioCommerceLandingV10 {...props} />
    </div>
  );
}
