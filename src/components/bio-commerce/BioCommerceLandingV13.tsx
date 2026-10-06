import { useEffect, useRef } from "react";
import {
  BioCommerceLanding as BioCommerceLandingV12,
  type BioCommerceBlockData,
  type BioCommerceLandingData,
  type BioCommerceProduct,
  type BioCommerceReview,
} from "./BioCommerceLandingV12";

export type { BioCommerceBlockData, BioCommerceLandingData, BioCommerceProduct, BioCommerceReview };

/**
 * Compatibilidade especifica para o navegador interno do Instagram.
 *
 * O WebView do Instagram pode alterar a altura visual da viewport varias vezes
 * durante o scroll (barra superior/inferior aparecendo e sumindo). Em paginas
 * com dvh + camadas fixed/blur isso pode gerar reflow, compositing thrash e o
 * efeito de "piscar"/convergir quando o usuario chega ao fim da pagina.
 *
 * Aqui estabilizamos a altura enquanto a largura nao mudar, sincronizamos o
 * fundo de html/body com a landing para o rubber-band nao revelar branco, e
 * transformamos o ambient fixo em camada absoluta somente no Instagram.
 */
function useInstagramWebViewStability(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined" || typeof document === "undefined") return;

    const ua = navigator.userAgent || "";
    const isInstagram = /Instagram/i.test(ua);
    if (!isInstagram) return;

    const html = document.documentElement;
    const body = document.body;
    const shell = root.querySelector<HTMLElement>(".bc-v9-shell") ?? root;

    const previous = {
      htmlBackground: html.style.backgroundColor,
      bodyBackground: body.style.backgroundColor,
      htmlOverscrollY: html.style.overscrollBehaviorY,
      bodyOverscrollY: body.style.overscrollBehaviorY,
    };

    root.classList.add("bc-v13-instagram");

    let stableWidth = window.innerWidth;
    let resizeTimer = 0;
    let orientationTimer = 0;

    const syncStableViewport = () => {
      const height = Math.max(1, window.innerHeight);
      const heroHeight = Math.max(520, Math.round(height * 0.72));
      root.style.setProperty("--bc-v13-page-vh", `${height}px`);
      root.style.setProperty("--bc-v13-hero-vh", `${heroHeight}px`);

      const bg = window.getComputedStyle(shell).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
        html.style.backgroundColor = bg;
        body.style.backgroundColor = bg;
      }
    };

    syncStableViewport();

    // Evita o bounce encadear scroll no final da pagina dentro do WebView.
    html.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";

    // O Instagram dispara resize ao esconder/mostrar chrome mesmo sem mudar a
    // largura. Ignoramos esses eventos para nao recalcular a landing no scroll.
    const onResize = () => {
      const nextWidth = window.innerWidth;
      if (Math.abs(nextWidth - stableWidth) < 2) return;
      stableWidth = nextWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(syncStableViewport, 180);
    };

    const onOrientationChange = () => {
      window.clearTimeout(orientationTimer);
      orientationTimer = window.setTimeout(() => {
        stableWidth = window.innerWidth;
        syncStableViewport();
      }, 320);
    };

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onOrientationChange, { passive: true });

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(orientationTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrientationChange);

      root.classList.remove("bc-v13-instagram");
      root.style.removeProperty("--bc-v13-page-vh");
      root.style.removeProperty("--bc-v13-hero-vh");

      html.style.backgroundColor = previous.htmlBackground;
      body.style.backgroundColor = previous.bodyBackground;
      html.style.overscrollBehaviorY = previous.htmlOverscrollY;
      body.style.overscrollBehaviorY = previous.bodyOverscrollY;
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
  useInstagramWebViewStability(rootRef);

  return (
    <div ref={rootRef} className="bc-v13-runtime">
      <style>{`
        .bc-v13-instagram .bc-v9-public {
          min-height: var(--bc-v13-page-vh, 100svh) !important;
          overscroll-behavior-y: none !important;
          -webkit-overflow-scrolling: touch;
        }

        .bc-v13-instagram .bc-v9-public > div > .relative.z-10 > section:first-of-type > div,
        .bc-v13-instagram .bc-v9-public > div > .relative.z-10 > section:first-of-type > div > div.relative.z-10 {
          min-height: var(--bc-v13-hero-vh, 72svh) !important;
        }

        /* Camadas fixed com blur + transform sao uma fonte conhecida de
           flicker no WebView do Instagram. Mantemos o mesmo glow, mas preso a
           landing e sem animacao de compositor adicional nesse navegador. */
        .bc-v13-instagram .bc-v9-public .fixed.pointer-events-none.inset-0.z-0 {
          position: absolute !important;
        }

        .bc-v13-instagram .bc-v9-public .fixed.pointer-events-none.inset-0.z-0 > * {
          transform: none !important;
          -webkit-transform: none !important;
          animation: none !important;
          will-change: auto !important;
        }

        .bc-v13-instagram .bc-v9-public > footer {
          padding-bottom: calc(2.5rem + env(safe-area-inset-bottom)) !important;
        }
      `}</style>
      <BioCommerceLandingV12 {...props} />
    </div>
  );
}
