import { useEffect, useState } from "react";
import { DEFAULT_BRANDS, type BrandItem } from "@/lib/landing-content";

/**
 * Fidelize: marcas com dimensão visual padronizada e tinta monocromática.
 * O logo enviado no Admin continua valendo; não alteramos os dados cadastrados.
 */
const DEFAULT_SVGS: Record<string, React.ReactNode> = {
  nike: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z" />
    </svg>
  ),
  adidas: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m24 19.535-8.697-15.07-4.659 2.687 7.145 12.383Zm-8.287 0L9.969 9.59 5.31 12.277l4.192 7.258ZM4.658 14.723l2.776 4.812H1.223L0 17.41Z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.422-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  ),
};

/**
 * Converte uma marca enviada ao Admin para tinta preta, preservando transparência.
 * Se o PNG/GIF tiver fundo branco, remove o fundo antes de aplicar a tinta preta.
 * Canvas só roda no cliente e em resolução limitada; o URL original é mantido no banco.
 * Cache evita repetir o trabalho nas cópias do loop infinito.
 */
const blackLogoCache = new Map<string, Promise<string | null>>();

/**
 * Logotipos com fundo opaco não podem receber brightness(0) diretamente:
 * isso pinta TAMBÉM o fundo de preto. Removemos o fundo uniforme pela cor
 * das bordas ANTES de transformar os pixels visíveis em tinta preta.
 *
 * Imagem ilegível (foto, CORS bloqueado, placa sólida) => wordmark em texto.
 * Assim nenhuma marca vira um retângulo/oval preto no carrossel.
 */
function toBlackLogo(source: string): Promise<string | null> {
  const previous = blackLogoCache.get(source);
  if (previous) return previous;

  const promise = new Promise<string | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const naturalWidth = image.naturalWidth;
        const naturalHeight = image.naturalHeight;
        if (!naturalWidth || !naturalHeight) return resolve(null);

        const scale = Math.min(1, 900 / Math.max(naturalWidth, naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(naturalHeight * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = pixels.data;
        const width = canvas.width;
        const height = canvas.height;

        // Amostra um pequeno quadrado em cada canto: tolera JPEG/WebP e
        // bordas suavizadas sem usar a cor de uma letra como cor do fundo.
        const corner = (cx: number, cy: number) => {
          const size = Math.max(1, Math.min(4, Math.floor(Math.min(width, height) / 8)));
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          for (let y = cy; y < cy + size && y < height; y++) {
            for (let x = cx; x < cx + size && x < width; x++) {
              const idx = (y * width + x) * 4;
              r += data[idx]; g += data[idx + 1];
              b += data[idx + 2]; a += data[idx + 3];
              count++;
            }
          }
          return { r: r / count, g: g / count, b: b / count, a: a / count };
        };
        const corners = [
          corner(0, 0), corner(Math.max(0, width - 4), 0),
          corner(0, Math.max(0, height - 4)),
          corner(Math.max(0, width - 4), Math.max(0, height - 4)),
        ];
        const opaqueCorners = corners.every((c) => c.a > 238);
        const background = {
          r: corners.reduce((sum, c) => sum + c.r, 0) / 4,
          g: corners.reduce((sum, c) => sum + c.g, 0) / 4,
          b: corners.reduce((sum, c) => sum + c.b, 0) / 4,
        };
        const cornerDelta = Math.max(...corners.map((c) =>
          Math.max(
            Math.abs(c.r - background.r),
            Math.abs(c.g - background.g),
            Math.abs(c.b - background.b),
          ),
        ));
        // Imagem opaca com fundo multicolorido não tem remoção confiável.
        // Preferimos o nome legível da marca a produzir uma placa escura.
        if (opaqueCorners && cornerDelta > 44) return resolve(null);

        let visible = 0;
        let strong = 0;
        let minX = width, minY = height, maxX = -1, maxY = -1;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const originalAlpha = data[idx + 3];
            if (!originalAlpha) continue;

            let newAlpha = originalAlpha;
            if (opaqueCorners) {
              // Diferença para a cor do fundo em vez de brightness(0)
              // da imagem inteira (que destruía os arquivos enviados).
              const contrast = Math.max(
                Math.abs(data[idx] - background.r),
                Math.abs(data[idx + 1] - background.g),
                Math.abs(data[idx + 2] - background.b),
              );
              newAlpha = Math.min(originalAlpha, Math.max(0, Math.round(contrast * 5 - 24)));
            }

            // Símbolos e letras tornam-se pretos; o fundo fica transparente.
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = newAlpha;

            if (newAlpha <= 24) continue;
            visible++;
            if (newAlpha >= 140) strong++;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }

        const surface = width * height;
        if (visible < 12 || maxX < minX || maxY < minY) return resolve(null);

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const occupancy = strong / Math.max(1, cropW * cropH);
        // Um fundo residual/placa de cor sólida não é uma logo legível.
        if (occupancy > 0.68 || strong / surface > 0.66) return resolve(null);

        ctx.putImageData(pixels, 0, 0);
        const padding = Math.max(2, Math.round(Math.max(cropW, cropH) * 0.03));
        const cropped = document.createElement("canvas");
        cropped.width = cropW + padding * 2;
        cropped.height = cropH + padding * 2;
        cropped.getContext("2d")?.drawImage(
          canvas, minX, minY, cropW, cropH,
          padding, padding, cropW, cropH,
        );
        resolve(cropped.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
  blackLogoCache.set(source, promise);
  return promise;
}

function BrandLogo({ item }: { item: BrandItem }) {
  const [monochromeUrl, setMonochromeUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const name = item.name?.trim() || "Marca";
  const svg = DEFAULT_SVGS[name.toLowerCase()];

  useEffect(() => {
    let active = true;
    setMonochromeUrl(null);
    setFailed(false);
    if (item.img) {
      toBlackLogo(item.img).then((url) => {
        if (active) {
          setMonochromeUrl(url);
          setFailed(!url);
        }
      });
    }
    return () => { active = false; };
  }, [item.img]);

  // SVGs nativos continuam nítidos quando não existe imagem personalizada.
  if (!item.img && svg) {
    return <span className="fidelize-brand-logo-vector" role="img" aria-label={name}>{svg}</span>;
  }

  if (item.img && monochromeUrl && !failed) {
    return (
      <img
        className="fidelize-brand-logo-image"
        src={monochromeUrl}
        alt={name}
        width={180}
        height={68}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    );
  }

  // Mantém a marca legível enquanto a conversão ocorre e também quando
  // o arquivo original possui fundo impossível de remover com segurança.
  return <span className="fidelize-brand-logo-word" role="img" aria-label={name}>{name}</span>;
}

function BrandSequence({ brands, duplicate = false }: { brands: BrandItem[]; duplicate?: boolean }) {
  return (
    <div className="fidelize-brand-sequence" aria-hidden={duplicate ? true : undefined}>
      {brands.map((brand, index) => (
        <div className="fidelize-brand-cell" key={`${brand.name}-${index}`} title={brand.name}>
          <BrandLogo item={brand} />
        </div>
      ))}
    </div>
  );
}

export function BrandMarquee({ brands }: { brands?: BrandItem[] } = {}) {
  const source = (brands?.length ? brands : DEFAULT_BRANDS.brands)
    .filter((item) => typeof item.name === "string" && item.name.trim().length > 0);

  return (
    <div className="fidelize-brand-marquee" aria-label="Marcas em destaque" role="region">
      <style>{`
        .fidelize-brand-marquee{
          --logo-gap:clamp(18px,3vw,40px);
          width:min(100% - 28px,1280px);margin:0 auto;overflow:hidden;
          position:relative;isolation:isolate;border-radius:24px;
          border:1px solid rgba(17,24,39,.08);background:#fff;
          box-shadow:0 18px 55px rgba(0,0,0,.09);
          -webkit-mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent);
          mask-image:linear-gradient(to right,transparent,#000 7%,#000 93%,transparent);
        }
        .fidelize-brand-track{display:flex;align-items:center;width:max-content;animation:fidelize-brand-scroll var(--brand-speed,44s) linear infinite}
        .fidelize-brand-sequence{display:flex;align-items:center;flex:none;gap:var(--logo-gap);padding-right:var(--logo-gap)}
        .fidelize-brand-cell{display:flex;flex:none;align-items:center;justify-content:center;width:188px;height:100px;min-width:0;padding:16px 8px;color:#101010}
        .fidelize-brand-logo-image{
          display:block;width:172px;height:64px;max-width:100%;max-height:100%;
          object-fit:contain;object-position:center;
          filter:none;mix-blend-mode:normal;
        }
        .fidelize-brand-logo-vector{display:grid;place-items:center;width:68px;height:62px;color:#101010}
        .fidelize-brand-logo-vector svg{display:block;width:100%;height:100%;object-fit:contain}
        .fidelize-brand-logo-word{display:block;max-width:100%;color:#101010;font-size:clamp(20px,2.6vw,28px);font-weight:850;letter-spacing:-.055em;line-height:1.08;text-align:center;text-transform:uppercase;overflow-wrap:anywhere}
        @keyframes fidelize-brand-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
        @media(max-width:640px){
          .fidelize-brand-marquee{width:calc(100% - 20px);border-radius:18px;--logo-gap:14px}
          .fidelize-brand-cell{width:156px;height:88px;padding:12px 8px}
          .fidelize-brand-logo-image{width:144px;height:60px}
          .fidelize-brand-logo-vector{width:62px;height:60px}
          .fidelize-brand-logo-word{font-size:23px}
        }
        @media(prefers-reduced-motion:reduce){.fidelize-brand-track{animation:none}}
      `}</style>
      <div className="fidelize-brand-track" style={{ animationDuration: `${Math.max(36, source.length * 3.8)}s` }}>
        <BrandSequence brands={source} />
        <BrandSequence brands={source} duplicate />
      </div>
    </div>
  );
}
