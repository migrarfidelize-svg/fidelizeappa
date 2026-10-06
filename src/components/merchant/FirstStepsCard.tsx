import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Circle, Rocket, X, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMyFeature } from "@/hooks/useMyFeature";
import { getMyLinkTree } from "@/lib/linktree.functions";
import { getMyMenuOverview } from "@/lib/menu.functions";
import { getReviewStats } from "@/lib/reviews.functions";
import { getEstablishmentFull } from "@/lib/settings.functions";

type Step = {
  key: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
  /** Passos sem sinal automático podem ser marcados manualmente. */
  manual?: boolean;
};

const STORAGE_KEY = "fidelize:first-steps:v1";

export function FirstStepsCard({
  establishmentId,
  hasCampaign,
  customersCount,
  stampsCount,
  teamCount,
}: {
  establishmentId: string;
  hasCampaign: boolean;
  customersCount: number;
  stampsCount: number;
  teamCount: number;
}) {
  const key = `${STORAGE_KEY}:${establishmentId}`;
  const [manualDone, setManualDone] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);


  const { allowed: menuAllowed } = useMyFeature(establishmentId, "digital_menu");

  const getLinkTree = useServerFn(getMyLinkTree);
  const getMenu = useServerFn(getMyMenuOverview);
  const getReviews = useServerFn(getReviewStats);
  const getEst = useServerFn(getEstablishmentFull);

  const { data: linkTree } = useQuery({
    queryKey: ["fs-linktree", establishmentId],
    queryFn: () => getLinkTree({ data: { establishment_id: establishmentId } }),
    staleTime: 60_000,
  });
  const { data: menu } = useQuery({
    enabled: menuAllowed,
    queryKey: ["fs-menu", establishmentId],
    queryFn: () => getMenu({ data: { establishment_id: establishmentId } }),
    staleTime: 60_000,
  });
  const { data: reviews } = useQuery({
    queryKey: ["fs-reviews", establishmentId],
    queryFn: () => getReviews({ data: { establishmentId, days: 365 } }),
    staleTime: 60_000,
  });
  const { data: estFull } = useQuery({
    queryKey: ["fs-est", establishmentId],
    queryFn: () => getEst({ data: { establishment_id: establishmentId } }),
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { manual?: string[]; hidden?: boolean; open?: boolean };
        setManualDone(parsed.manual ?? []);
        setHidden(!!parsed.hidden);
        setOpen(!!parsed.open);
      }
    } catch { /* noop */ }
  }, [key]);

  function persist(next: { manual?: string[]; hidden?: boolean; open?: boolean }) {
    const payload = {
      manual: next.manual ?? manualDone,
      hidden: next.hidden ?? hidden,
      open: next.open ?? open,
    };
    try { localStorage.setItem(key, JSON.stringify(payload)); } catch { /* noop */ }
  }


  const est = estFull?.establishment as Record<string, any> | undefined;
  const profileDone = !!est
    && !!est.logo_url
    && !!(est.phone || est.whatsapp)
    && !!est.address
    && !!est.city
    && !!est.state
    && !!est.cep;

  const steps: Step[] = [
    {
      key: "campaign",
      label: "Configurar seu cartão fidelidade",
      hint: "Defina carimbos, recompensa e visual",
      to: "/app/campanhas",
      done: hasCampaign,
    },
    {
      key: "profile",
      label: "Completar o perfil do estabelecimento",
      hint: "Logo, contato e endereço completo (CEP, cidade e UF)",
      to: "/app/perfil",
      done: profileDone,
    },
    {
      key: "qr",
      label: "Imprimir seu QR Code",
      hint: "Material pronto para balcão e mesa",
      to: "/app/qr",
      done: manualDone.includes("qr"),
      manual: true,
    },
    {
      key: "customer",
      label: "Cadastrar o primeiro cliente",
      hint: "Pela busca ou lendo o QR do cliente",
      to: "/app/carimbar",
      done: customersCount > 0,
    },
    {
      key: "stamp",
      label: "Dar o primeiro carimbo",
      hint: "O coração da operação do dia a dia",
      to: "/app/carimbar",
      done: stampsCount > 0,
    },
    {
      key: "linktree",
      label: "Criar sua Bio Commerce",
      hint: "Reúna WhatsApp, redes e cardápio em um link só",
      to: "/app/linktree",
      done: !!linkTree?.page && (linkTree?.links?.length ?? 0) > 0,
    },
    ...(menuAllowed
      ? [{
          key: "menu",
          label: "Publicar seu cardápio digital",
          hint: "Adicione pratos e deixe o cardápio no ar",
          to: "/app/cardapio",
          done: (menu?.counts?.items ?? 0) > 0 && (menu?.menu as any)?.status === "published",
        } as Step]
      : []),
    {
      key: "reviews",
      label: "Ativar avaliações de atendimento",
      hint: "Peça a primeira avaliação e acompanhe a nota",
      to: "/app/avaliacoes",
      done: (reviews?.count ?? 0) > 0,
    },
    {
      key: "team",
      label: "Convidar sua equipe",
      hint: "Atendentes com permissões próprias",
      to: "/app/equipe",
      done: teamCount > 1,
    },
  ];


  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  if (hidden || doneCount === steps.length) return null;

  const nextStep = steps.find((s) => !s.done);

  return (
    <div className="dash-card dash-card-accent relative p-3 md:p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="card-icon card-icon-accent shrink-0" aria-hidden><Rocket /></span>

        <button
          type="button"
          onClick={() => { setOpen(!open); persist({ open: !open }); }}
          aria-expanded={open}
          className="min-w-0 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="sec-title truncate text-base">Primeiros passos</h3>
            <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary">
              {doneCount}/{steps.length}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {open ? "Toque para recolher" : nextStep ? `Próximo: ${nextStep.label}` : ""}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => { setOpen(!open); persist({ open: !open }); }}
            aria-label={open ? "Recolher primeiros passos" : "Expandir primeiros passos"}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => { setHidden(true); persist({ hidden: true }); }}
            aria-label="Ocultar primeiros passos"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
      <ul className="mt-4 space-y-2">

        {steps.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border/60 bg-card/40 p-3"
          >
            {s.manual && !s.done ? (
              <button
                type="button"
                aria-label={`Marcar "${s.label}" como concluído`}
                onClick={() => {
                  const next = [...manualDone, s.key];
                  setManualDone(next);
                  persist({ manual: next });
                }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-primary/40 text-muted-foreground hover:text-primary"
              >
                <Circle className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  s.done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                }`}
                aria-hidden
              >
                {s.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium leading-snug break-words ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {s.label}
              </div>
              <div className="line-clamp-2 text-xs leading-snug text-muted-foreground">{s.hint}</div>
            </div>

            <Button asChild size="sm" variant={s.done ? "ghost" : "outline"} className="shrink-0 px-2.5 sm:px-3">
              <Link to={s.to}>
                {s.done ? "Ver" : "Fazer"}
                <ArrowRight className="ml-1 hidden h-3.5 w-3.5 min-[380px]:inline" />
              </Link>
            </Button>

          </li>
        ))}
      </ul>
      )}

    </div>
  );
}
