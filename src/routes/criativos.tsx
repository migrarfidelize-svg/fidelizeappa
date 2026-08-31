import { createFileRoute } from "@tanstack/react-router";
import {
  QrCode,
  UtensilsCrossed,
  Star,
  BellRing,
  Link2,
  Megaphone,
  Users,
  BarChart3,
  Gift,
  Check,
  ShoppingBag,
} from "lucide-react";

export const Route = createFileRoute("/criativos")({
  head: () => ({
    meta: [
      { title: "Fidelize — Criativos de campanha" },
      {
        name: "description",
        content:
          "Peças de campanha 1080x1350 do Fidelize renderizadas com o próprio design system: fidelidade, cardápio, avaliações, push e árvore de links.",
      },
      { property: "og:title", content: "Fidelize — Criativos de campanha" },
      {
        property: "og:description",
        content:
          "Criativos de feed do Fidelize construídos com o design system oficial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CriativosPage,
});

/* ---------------- shared atoms ---------------- */

const CANVAS =
  "relative isolate overflow-hidden w-[1080px] h-[1350px] shrink-0 text-white";

function Backdrop({ variant = "aurora" }: { variant?: "aurora" | "beam" | "grid" }) {
  return (
    <>
      <div className="absolute inset-0 -z-30 bg-[#0b0713]" />
      {/* aurora blobs */}
      <div
        className="absolute -z-20 blur-[120px] opacity-[0.55]"
        style={{
          top: variant === "beam" ? -260 : -220,
          left: -180,
          width: 760,
          height: 760,
          borderRadius: "9999px",
          background:
            "radial-gradient(circle at 40% 40%, #7c3aed 0%, rgba(124,58,237,0.35) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute -z-20 blur-[130px] opacity-[0.45]"
        style={{
          top: variant === "grid" ? 420 : -160,
          right: -220,
          width: 720,
          height: 720,
          borderRadius: "9999px",
          background:
            "radial-gradient(circle at 50% 50%, #4f46e5 0%, rgba(79,70,229,0.3) 45%, transparent 72%)",
        }}
      />
      <div
        className="absolute -z-20 blur-[140px] opacity-[0.4]"
        style={{
          bottom: -320,
          left: 160,
          width: 820,
          height: 620,
          borderRadius: "9999px",
          background:
            "radial-gradient(circle at 50% 50%, #a855f7 0%, rgba(168,85,247,0.22) 50%, transparent 75%)",
        }}
      />
      {/* fine grid */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(167,139,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.5) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(circle at 50% 45%, black 10%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 45%, black 10%, transparent 78%)",
        }}
      />
      {/* vignette + grain */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, transparent 40%, rgba(5,2,12,0.85) 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.16] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.55'/></svg>\")",
        }}
      />
    </>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className="grid size-9 place-items-center rounded-[10px]"
        style={{
          background: "linear-gradient(140deg,#8b5cf6,#4f46e5)",
          boxShadow: "0 0 28px rgba(139,92,246,0.55)",
        }}
      >
        <Check className="size-5" strokeWidth={3} />
      </div>
      <span className="text-[30px] font-semibold tracking-tight text-white/90">
        fidelize
      </span>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-[17px] font-medium tracking-[0.18em] text-violet-200 uppercase">
      {children}
    </div>
  );
}

function StampCard() {
  return (
    <div
      className="w-[560px] rounded-[30px] border border-white/12 p-8 backdrop-blur-xl"
      style={{
        background:
          "linear-gradient(155deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
        boxShadow:
          "0 40px 120px -30px rgba(124,58,237,0.65), inset 0 1px 0 rgba(255,255,255,0.18)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] tracking-[0.24em] text-violet-200/80 uppercase">
            Cartão fidelidade
          </p>
          <p className="mt-1 text-[27px] font-semibold">Blackstone Burger</p>
        </div>
        <div className="grid size-14 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/15">
          <Gift className="size-7 text-violet-200" />
        </div>
      </div>

      <div className="mt-7 grid grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="grid aspect-square place-items-center rounded-2xl border"
            style={
              i < 9
                ? {
                    borderColor: "rgba(167,139,250,0.55)",
                    background:
                      "linear-gradient(150deg, rgba(139,92,246,0.45), rgba(79,70,229,0.25))",
                    boxShadow: "0 0 22px rgba(139,92,246,0.35)",
                  }
                : {
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.03)",
                    borderStyle: "dashed",
                  }
            }
          >
            {i < 9 ? (
              <Check className="size-8 text-white" strokeWidth={3} />
            ) : (
              <span className="text-[22px] font-semibold text-white/35">10</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between text-[17px] text-white/70">
          <span>9 de 10 carimbos</span>
          <span className="text-violet-200">falta 1 pro brinde</span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full w-[90%] rounded-full"
            style={{
              background: "linear-gradient(90deg,#6d28d9,#a78bfa)",
              boxShadow: "0 0 20px rgba(167,139,250,0.7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FeatureChip({
  icon: Icon,
  label,
  sub,
  className = "",
  style,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`flex w-[268px] items-center gap-4 rounded-3xl border border-white/12 px-5 py-4 backdrop-blur-xl ${className}`}
      style={{
        background:
          "linear-gradient(150deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))",
        boxShadow: "0 24px 70px -28px rgba(124,58,237,0.75)",
        ...style,
      }}
    >
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/15">
        <Icon className="size-6 text-violet-200" />
      </div>
      <div className="min-w-0">
        <p className="text-[19px] leading-tight font-semibold">{label}</p>
        <p className="text-[15px] leading-tight text-white/55">{sub}</p>
      </div>
    </div>
  );
}

/* ---------------- creative 1 ---------------- */

function CreativeOne() {
  return (
    <div id="c1" className={CANVAS}>
      <Backdrop variant="aurora" />

      <div className="flex h-full flex-col px-[72px] pt-[76px] pb-[64px]">
        <div className="flex items-center justify-between">
          <Wordmark />
          <Eyebrow>plataforma completa</Eyebrow>
        </div>

        <h1 className="mt-12 text-[86px] leading-[0.94] font-bold tracking-[-0.03em]">
          Muito mais que
          <br />
          um cartão de
          <br />
          <span
            style={{
              background: "linear-gradient(100deg,#c4b5fd,#8b5cf6 55%,#6366f1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            fidelidade.
          </span>
        </h1>

        <p className="mt-7 max-w-[760px] text-[26px] leading-snug text-white/60">
          Fidelidade, cardápio digital, avaliações, notificações e árvore de
          links — tudo em um só QR Code do seu negócio.
        </p>

        <div className="mt-auto flex justify-center">
          <StampCard />
        </div>

        <div className="mt-12 grid grid-cols-2 gap-5">
          <FeatureChip
            icon={UtensilsCrossed}
            label="Cardápio digital"
            sub="Fotos, preços e stories"
            className="w-full"
          />
          <FeatureChip
            icon={BellRing}
            label="Notificação push"
            sub="Traz o cliente de volta"
            className="w-full"
          />
          <FeatureChip
            icon={Star}
            label="Avaliações"
            sub="Reputação no automático"
            className="w-full"
          />
          <FeatureChip
            icon={Link2}
            label="Árvore de links"
            sub="Sua bio profissional"
            className="w-full"
          />
        </div>


        <div className="mt-12 flex items-center justify-between border-t border-white/10 pt-7 text-[21px] text-white/55">
          <span>afidelize.app</span>
          <span className="text-violet-200">A partir de R$ 29,90/mês</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- creative 2 ---------------- */

const MODULES = [
  { icon: QrCode, t: "QR Code único", d: "Um código, vários destinos" },
  { icon: UtensilsCrossed, t: "Cardápio Story", d: "Menu digital em stories" },
  { icon: ShoppingBag, t: "Catálogo digital", d: "Vitrine de produtos" },
  { icon: Star, t: "Avaliações", d: "Feedback e reputação" },
  { icon: BellRing, t: "Push nativo", d: "Reengajamento automático" },
  { icon: Link2, t: "Árvore de links", d: "Bio que converte" },
  { icon: Megaphone, t: "Campanhas", d: "Promoções segmentadas" },
  { icon: Users, t: "Base de clientes", d: "CRM com histórico" },
  { icon: BarChart3, t: "Analytics", d: "Retorno em números" },
];

function CreativeTwo() {
  return (
    <div id="c2" className={CANVAS}>
      <Backdrop variant="grid" />

      <div className="flex h-full flex-col px-[72px] pt-[80px] pb-[70px]">
        <Eyebrow>1 assinatura · 9 módulos</Eyebrow>

        <h1 className="mt-8 text-[80px] leading-[0.95] font-bold tracking-[-0.03em]">
          Seu negócio
          <br />
          inteiro dentro
          <br />
          <span
            style={{
              background: "linear-gradient(100deg,#c4b5fd,#8b5cf6 55%,#6366f1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            de um QR Code.
          </span>
        </h1>

        <div className="mt-14 grid grid-cols-3 gap-5">
          {MODULES.map((m) => (
            <div
              key={m.t}
              className="rounded-3xl border border-white/12 px-6 py-7 backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(150deg, rgba(255,255,255,0.085), rgba(255,255,255,0.02))",
                boxShadow: "0 30px 80px -34px rgba(124,58,237,0.8)",
              }}
            >
              <div className="grid size-14 place-items-center rounded-2xl border border-violet-300/25 bg-violet-500/15">
                <m.icon className="size-7 text-violet-200" />
              </div>
              <p className="mt-5 text-[24px] leading-tight font-semibold">
                {m.t}
              </p>
              <p className="mt-1.5 text-[17px] leading-snug text-white/50">
                {m.d}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-white/10 pt-8">
          <div>
            <p className="text-[20px] text-white/50">A partir de</p>
            <p className="text-[52px] leading-none font-bold tracking-tight">
              R$ 29,90
              <span className="text-[24px] font-medium text-white/45">/mês</span>
            </p>
          </div>
          <Wordmark />
        </div>
      </div>
    </div>
  );
}

/* ---------------- creative 3 ---------------- */

function CreativeThree() {
  return (
    <div id="c3" className={CANVAS}>
      <Backdrop variant="beam" />

      <div className="flex h-full flex-col px-[72px] pt-[80px] pb-[70px]">
        <div className="flex items-center justify-between">
          <Eyebrow>antes · agora</Eyebrow>
          <Wordmark />
        </div>

        <h1 className="mt-11 text-[82px] leading-[0.94] font-bold tracking-[-0.03em]">
          O cartão de papel
          <br />
          <span
            style={{
              background: "linear-gradient(100deg,#c4b5fd,#8b5cf6 55%,#6366f1)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            virou plataforma.
          </span>
        </h1>

        <div className="mt-14 grid flex-1 grid-cols-2 items-stretch gap-8">
          <div
            className="flex h-full flex-col rounded-[28px] border border-white/8 p-10"
            style={{ background: "rgba(255,255,255,0.028)" }}
          >
            <p className="text-[16px] tracking-[0.22em] text-white/35 uppercase">
              Cartão de papel
            </p>
            <ul className="mt-9 flex flex-1 flex-col justify-center space-y-7 text-[21px] leading-snug text-white/40">
              {[
                "Some na carteira do cliente",
                "Sem dados de quem volta",
                "Fraude com carimbo copiado",
                "Nenhum canal de contato",
                "Zero cardápio ou avaliação",
              ].map((t) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-3 h-px w-6 shrink-0 bg-white/25" />
                  <span className="line-through decoration-white/20">{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="flex h-full flex-col rounded-[28px] border border-violet-300/25 p-10"
            style={{
              background:
                "linear-gradient(155deg, rgba(139,92,246,0.20), rgba(79,70,229,0.08))",
              boxShadow: "0 40px 110px -34px rgba(124,58,237,0.9)",
            }}
          >
            <p className="text-[16px] tracking-[0.22em] text-violet-200 uppercase">
              Com o Fidelize
            </p>
            <ul className="mt-9 flex flex-1 flex-col justify-center space-y-7 text-[21px] leading-snug text-white/85">
              {[
                "Cartão sempre no celular",
                "Base de clientes com CRM",
                "Carimbo validado por QR",
                "Push que traz o cliente",
                "Cardápio e avaliações",
              ].map((t) => (
                <li key={t} className="flex gap-4">
                  <Check
                    className="mt-1 size-6 shrink-0 text-violet-200"
                    strokeWidth={3}
                  />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-5">
          {[
            { k: "1 QR Code", v: "Fidelidade, cardápio, avaliação ou links" },
            { k: "9 módulos", v: "Na mesma assinatura, sem plugin extra" },
            { k: "100% digital", v: "Sem app para o cliente instalar" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-3xl border border-white/10 px-7 py-9"
              style={{ background: "rgba(255,255,255,0.035)" }}
            >
              <p className="text-[30px] leading-none font-bold tracking-tight text-violet-200">
                {s.k}
              </p>
              <p className="mt-3 text-[17px] leading-snug text-white/50">
                {s.v}
              </p>
            </div>
          ))}
        </div>



        <div className="mt-10 flex items-center justify-between rounded-3xl border border-white/12 px-9 py-7 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(150deg, rgba(255,255,255,0.09), rgba(255,255,255,0.02))",
          }}
        >
          <p className="max-w-[560px] text-[26px] leading-snug font-medium">
            Fidelidade, cardápio, avaliações e automação na mesma assinatura.

          </p>
          <div
            className="rounded-2xl px-8 py-4 text-[24px] font-semibold"
            style={{
              background: "linear-gradient(120deg,#7c3aed,#4f46e5)",
              boxShadow: "0 0 40px rgba(124,58,237,0.6)",
            }}
          >
            Criar minha conta
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

/**
 * Os criativos têm tamanho fixo de 1080x1350 (formato de post).
 * No mobile isso forçava scroll horizontal na página inteira; aqui a arte é
 * reduzida proporcionalmente e o contêiner reserva exatamente a altura visível.
 */
function CreativeScaler({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden">
      <div className="mx-auto h-[380px] w-[275px] sm:h-[608px] sm:w-[486px] md:h-[810px] md:w-[648px] xl:h-[1350px] xl:w-[1080px]">
        <div className="origin-top-left scale-[0.2547] sm:scale-[0.45] md:scale-[0.6] xl:scale-100">
          {children}
        </div>
      </div>
    </div>
  );
}

function CriativosPage() {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#070510] py-16">
      <div className="mx-auto flex w-full max-w-full flex-col items-center gap-12 px-2 sm:gap-16">
        <CreativeScaler><CreativeOne /></CreativeScaler>
        <CreativeScaler><CreativeTwo /></CreativeScaler>
        <CreativeScaler><CreativeThree /></CreativeScaler>
      </div>
    </div>
  );
}

