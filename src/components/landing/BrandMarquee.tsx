import { useState } from "react";
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

function BrandLogo({ item }: { item: BrandItem }) {
  const [broken, setBroken] = useState(false);
  const name = item.name?.trim() || "Marca";
  const svg = DEFAULT_SVGS[name.toLowerCase()];

  if (item.img && !broken) {
    return (
      <img
        className="fidelize-brand-logo-image"
        src={item.img}
        alt={name}
        width={180}
        height={68}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBroken(true)}
      />
    );
  }

  return svg ? (
    <span className="fidelize-brand-logo-vector" role="img" aria-label={name}>{svg}</span>
  ) : (
    <span className="fidelize-brand-logo-word" role="img" aria-label={name}>{name}</span>
  );
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
          filter:grayscale(1) brightness(0);mix-blend-mode:multiply;
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
