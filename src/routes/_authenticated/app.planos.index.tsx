import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Crown as HeroIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPlanIntent, clearPlanIntent } from "@/lib/plan-intent";
import { trackCheckoutOpen, trackPlanFunnel } from "@/lib/plan-funnel";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { listActivePlans, changeEstablishmentPlan, getMyPlanUsage } from "@/lib/plans.functions";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Star, Check, Loader2, Users, Sparkles, UserCog, ArrowUp, ArrowDown,
  ChevronRight, Shield, Zap, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/PaymentDialog";

export const Route = createFileRoute("/_authenticated/app/planos/")({
  component: MerchantPlansPage,
});

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtLimit(v: number | null | undefined) { return v == null ? "Ilimitado" : v.toString(); }

const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3, business: 4 };
const TIER_ICON: Record<string, any> = { free: Shield, starter: Zap, pro: Sparkles, enterprise: Crown };

function MerchantPlansPage() {
  const list = useServerFn(listActivePlans);
  const change = useServerFn(changeEstablishmentPlan);
  const getEsts = useServerFn(getMyEstablishments);
  const getUsage = useServerFn(getMyPlanUsage);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; plan?: string } | undefined;
  const { data: plans, isLoading } = useQuery({ queryKey: ["active-plans"], queryFn: () => list() });
  const { data: usage } = useQuery({
    queryKey: ["plan-usage", activeEst?.id],
    queryFn: () => getUsage({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });
  const originNoticeFn = useServerFn(getSubscriptionOriginNotice);
  const { data: originNotice } = useQuery({
    queryKey: ["subscription-origin", activeEst?.id],
    queryFn: () => originNoticeFn({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  const currentTier = usage?.plan?.tier;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<null | { slug: string; name: string; tier: string; price: number; kind: "upgrade" | "downgrade" | "plan_change" }>(null);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState<null | { slug: string; name: string; price_monthly: number; tier: string }>(null);
  const [quoteFor, setQuoteFor] = useState<null | { slug: string; name: string; price: number }>(null);

  const isSalesPlan = (p: any) =>
    !!(p?.features && typeof p.features === "object" && (p.features.sales_contact || p.features.quote_flow));

  function openQuote(p: any, source: string) {
    const price = Number(p.price_monthly ?? 0);
    setQuoteFor({ slug: p.slug, name: p.name, price });
    trackPlanFunnel({
      stage: "checkout_open",
      plan_slug: p.slug,
      plan_name: p.name,
      amount: price,
      source,
      provider: "sales_quote",
      meta: { quote_flow: true },
    });
  }

  function askChange(p: any) {
    if (!activeEst || !currentTier) return;
    if (p.tier === currentTier) return;
    if (isSalesPlan(p)) {
      openQuote(p, "app_planos");
      return;
    }
    const kind: "upgrade" | "downgrade" | "plan_change" =
      (PLAN_RANK[p.tier] ?? 0) > (PLAN_RANK[currentTier] ?? 0) ? "upgrade"
      : (PLAN_RANK[p.tier] ?? 0) < (PLAN_RANK[currentTier] ?? 0) ? "downgrade" : "plan_change";
    const price = Number(p.price_monthly ?? 0);
    if (price > 0 && kind !== "downgrade") {
      setPayFor({ slug: p.slug, name: p.name, price_monthly: price, tier: p.tier });
      trackCheckoutOpen({ slug: p.slug, name: p.name, amount: price, source: "app_planos" });
    } else {
      setPending({ slug: p.slug, name: p.name, tier: p.tier, price, kind });
    }
  }

  // Abre automaticamente o checkout do plano escolhido na landing (uma única vez).
  const intentHandled = useRef(false);
  useEffect(() => {
    if (intentHandled.current) return;
    if (!plans?.length || !activeEst || !currentTier) return;
    const slug = getPlanIntent();
    if (!slug) return;
    intentHandled.current = true;
    clearPlanIntent();
    const p = (plans as any[]).find((x) => x.slug === slug);
    if (!p) {
      trackPlanFunnel({ stage: "checkout_mismatch", plan_slug: slug, source: "plan_intent", meta: { reason: "plan_not_found" } });
      return;
    }
    if (p.tier === currentTier) return;
    if (isSalesPlan(p)) {
      openQuote(p, "plan_intent");
      return;
    }
    const price = Number(p.price_monthly ?? 0);
    if (price > 0) {
      setPayFor({ slug: p.slug, name: p.name, price_monthly: price, tier: p.tier });
      trackCheckoutOpen({ slug: p.slug, name: p.name, amount: price, source: "plan_intent" });
    }
  }, [plans, activeEst, currentTier]);


  async function confirmChange() {
    if (!pending || !activeEst) return;
    setSaving(true);
    try {
      const res: any = await change({ data: { establishment_id: activeEst.id, plan_slug: pending.slug } });
      toast.success(
        res.kind === "upgrade" ? `Upgrade concluído! Bem-vindo ao ${pending.name}.`
        : res.kind === "downgrade" ? `Downgrade aplicado para ${pending.name}.`
        : `Plano alterado para ${pending.name}.`
      );
      setPending(null);
      qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["establishment"] }); qc.invalidateQueries({ queryKey: ["est-full"] }); qc.invalidateQueries({ queryKey: ["memberships"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao alterar plano.");
    } finally {
      setSaving(false);
    }
  }

  const totalPlans = plans?.length ?? 0;

  return (
    <div className="space-y-10">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Plano · Upgrade"}
        title={"Planos & upgrade"}
        subtitle={"Compare limites e mude de plano em um clique — sem burocracia."}
      />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assinatura</div>
        <h1 className="font-display text-4xl font-bold tracking-tight mt-1">Planos e Preços</h1>
        <p className="text-sm text-muted-foreground mt-2">Cresça no seu ritmo — mude de plano quando quiser, sem burocracia.</p>
      </motion.div>

      {usage?.plan && <CurrentPlanPanel usage={usage} />}

      {/* Grid de planos — permite que o painel lateral escape para fora do grid sem clipping */}
      {isLoading ? (
        <RouteLoading fullscreen={false} className="min-h-[40vh]" />
      ) : (
        <div className="grid gap-6 md:grid-cols-3 items-start pt-4 [overflow:visible]">
          {(plans ?? []).map((p: any, idx: number) => {
            // último card abre para a esquerda; demais para a direita
            const openLeft = idx === totalPlans - 1 && totalPlans > 1;
            return (
              <PlanCard
                key={p.id}
                plan={p}
                index={idx}
                isCurrent={p.tier === currentTier}
                canAct={!!activeEst}
                expanded={expanded === p.id}
                onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                onAct={() => askChange(p)}
                currentRank={currentTier ? PLAN_RANK[currentTier] ?? 0 : 0}
                openLeft={openLeft}
              />
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              {pending?.kind === "upgrade" && <ArrowUp className="h-5 w-5 text-primary" />}
              {pending?.kind === "downgrade" && <ArrowDown className="h-5 w-5 text-destructive" />}
              {pending?.kind === "upgrade" ? "Confirmar upgrade"
                : pending?.kind === "downgrade" ? "Confirmar downgrade"
                : "Confirmar mudança de plano"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  Você está prestes a mudar de <strong>{usage?.plan?.name ?? currentTier}</strong> para <strong>{pending?.name}</strong>.
                </div>
                <div className="rounded-lg border p-3 bg-muted/40">
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor mensal</span><span className="font-semibold">{pending ? fmtBRL(pending.price) : "—"}</span></div>
                </div>
                {pending?.kind === "downgrade" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                    Ao fazer downgrade você poderá perder acesso a recursos e ficar acima dos limites do novo plano.
                  </div>
                )}
                <div className="text-xs text-muted-foreground">A alteração é registrada em histórico de assinaturas e auditoria.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando…</> : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!quoteFor} onOpenChange={(o) => !o && setQuoteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              <Crown className="h-5 w-5 text-primary" />
              Orçamento {quoteFor?.name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  O plano <strong>{quoteFor?.name}</strong> ({fmtBRL(quoteFor?.price ?? 0)}/mês) é contratado com
                  o time comercial: múltiplas unidades, onboarding assistido e SLA prioritário.
                </p>
                <p className="text-muted-foreground">
                  Abra um chamado comercial e nosso time responde com a proposta e o link de pagamento.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                trackPlanFunnel({
                  stage: "checkout_open",
                  plan_slug: quoteFor?.slug ?? null,
                  plan_name: quoteFor?.name ?? null,
                  amount: quoteFor?.price ?? null,
                  source: "quote_dialog",
                  provider: "sales_quote",
                  meta: { action: "open_ticket" },
                });
                window.location.href = "/app/fidelize?assunto=orcamento-empresarial";
              }}
            >
              Falar com vendas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentDialog
        open={!!payFor}
        onOpenChange={(o) => !o && setPayFor(null)}
        plan={payFor}
        establishmentId={activeEst?.id ?? ""}
        onPaid={() => navigate({ to: "/app", search: { pagamento: "aprovado" } as any })}
      />

    </div>
  );
}

/* ================== LED Border — trilha luminosa percorrendo a borda com respiração ================== */
function LedBorder({ radius = 16, intense = false }: { radius?: number; intense?: boolean }) {
  // Duas trilhas defasadas percorrendo o perímetro do card. Fica contida dentro do bloco (overflow-hidden).
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
      style={{ borderRadius: radius }}
    >
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`led-grad-${intense ? "hi" : "lo"}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0)" />
            <stop offset="45%" stopColor="hsl(var(--primary) / 0.9)" />
            <stop offset="55%" stopColor="hsl(var(--primary) / 0.9)" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
          </linearGradient>
        </defs>
        {/* trilha base sutil */}
        <rect
          x="0" y="0" width="100%" height="100%"
          rx={radius} ry={radius}
          fill="none"
          stroke="hsl(var(--primary) / 0.12)"
          strokeWidth="1.5"
        />
        {/* LED em movimento + respiração via opacity */}
        <motion.rect
          x="0" y="0" width="100%" height="100%"
          rx={radius} ry={radius}
          fill="none"
          stroke={`url(#led-grad-${intense ? "hi" : "lo"})`}
          strokeWidth={intense ? 2 : 1.5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.18 0.82"
          initial={{ strokeDashoffset: 0, opacity: 0.55 }}
          animate={{
            strokeDashoffset: [0, -1],
            opacity: intense ? [0.6, 1, 0.6] : [0.4, 0.85, 0.4],
          }}
          transition={{
            strokeDashoffset: { duration: intense ? 5 : 7, repeat: Infinity, ease: "linear" },
            opacity: { duration: intense ? 2.4 : 3.2, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ filter: intense ? "drop-shadow(0 0 6px hsl(var(--primary) / 0.55))" : "drop-shadow(0 0 4px hsl(var(--primary) / 0.35))" }}
        />
      </svg>
    </div>
  );
}

/* ================== Seu plano atual — adaptativo light/dark ================== */
function CurrentPlanPanel({ usage }: { usage: any }) {
  const plan = usage.plan;
  const u = usage.usage;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-lg"
    >
      {/* fundo adaptativo */}
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: "linear-gradient(hsl(var(--foreground) / 0.035) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.035) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)" }} />

      <LedBorder radius={16} />

      <div className="relative grid gap-8 p-8 md:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Assinatura ativa
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Seu plano atual</div>
            <div className="font-display text-3xl font-bold tracking-tight mt-1">{plan.name}</div>
            <div className="text-sm text-muted-foreground mt-1">{plan.description ?? "Tudo funcionando perfeitamente."}</div>
          </div>
          <div className="flex items-baseline gap-1 pt-2">
            <span className="font-display text-4xl font-bold">{fmtBRL(Number(plan.price_monthly ?? 0))}</span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <RadialUsage label="Clientes" icon={Users} used={u.customers} limit={plan.customer_limit} />
          <RadialUsage label="Campanhas" icon={Sparkles} used={u.campaigns} limit={plan.campaign_limit} />
          <RadialUsage label="Equipe" icon={UserCog} used={u.employees} limit={plan.employee_limit} />
        </div>
      </div>
    </motion.div>
  );
}

function RadialUsage({ label, icon: Icon, used, limit }: { label: string; icon: any; used: number; limit: number | null }) {
  const pct = limit == null ? 100 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const near = pct >= 80 && limit != null;
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const color = limit == null ? "hsl(var(--primary))" : near ? "#f97316" : "hsl(var(--primary))";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative rounded-xl border border-border bg-muted/40 p-4 backdrop-blur"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--foreground) / 0.08)" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="none"
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div>
          <div className="font-display text-2xl font-bold leading-none">{used}</div>
          <div className="text-[11px] text-muted-foreground mt-1">de {limit == null ? "∞" : limit}</div>
          {near && <div className="text-[10px] text-orange-500 mt-1 uppercase tracking-wider">quase no limite</div>}
        </div>
      </div>
    </motion.div>
  );
}

/* ================== PlanCard adaptativo + expansão lateral ================== */
function PlanCard({
  plan, index, isCurrent, canAct, expanded, onToggle, onAct, currentRank, openLeft,
}: {
  plan: any; index: number; isCurrent: boolean; canAct: boolean;
  expanded: boolean; onToggle: () => void; onAct: () => void; currentRank: number; openLeft: boolean;
}) {
  const featured = plan.is_featured;
  const Icon = TIER_ICON[plan.tier] ?? Sparkles;
  const rank = PLAN_RANK[plan.tier] ?? 0;
  const isUpgrade = rank > currentRank;
  const isDowngrade = rank < currentRank;
  const features: any[] = plan.features ?? [];
  const primary = features.slice(0, 4);
  const rest = features.slice(4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`relative group ${featured ? "md:-my-3" : ""} ${expanded ? "z-30" : "z-10"}`}
    >
      <motion.div
        whileHover={{ y: featured ? -6 : -3 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className={[
          "relative flex flex-col rounded-2xl overflow-hidden transition-colors",
          "bg-card text-card-foreground border",
          featured
            ? "border-primary/40 shadow-[0_20px_60px_-25px_hsl(var(--primary)/0.55)]"
            : "border-border shadow-sm hover:shadow-lg hover:border-primary/25",
        ].join(" ")}
      >
        {/* fundo adaptativo do featured */}
        {featured && (
          <>
            <div className="pointer-events-none absolute inset-0 opacity-60"
              style={{ backgroundImage: "linear-gradient(hsl(var(--foreground) / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.03) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
            <div className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(120% 60% at 100% 0%, hsl(var(--primary) / 0.14), transparent 60%)" }} />
          </>
        )}

        {/* LED contido no card (não vaza) */}
        <LedBorder radius={16} intense={featured} />

        {/* Ribbon Mais popular */}
        {featured && (
          <div className="absolute top-4 right-4 z-10">
            <motion.div
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 260 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground shadow-lg"
            >
              <Star className="h-3 w-3 fill-current" /> Mais popular
            </motion.div>
          </div>
        )}

        {isCurrent && (
          <div className="absolute top-4 left-4 z-10">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-background/80 backdrop-blur">
              Ativo
            </Badge>
          </div>
        )}

        <div className="relative p-6 pt-14">
          <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${featured ? "bg-primary/15 text-primary" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-display text-2xl font-bold mt-4 tracking-tight">{plan.name}</h3>
          <p className="text-sm mt-1 text-muted-foreground leading-relaxed min-h-[3.75rem]">
            {plan.description?.trim() || "Plano Fidelize com cartão fidelidade digital e ferramentas de retenção."}
          </p>


          <div className="mt-5 flex items-baseline gap-1">
            <span className="font-display text-5xl font-bold tracking-tight">
              {fmtBRL(Number(plan.price_monthly))}
            </span>
            <span className="text-sm text-muted-foreground">/mês</span>
          </div>
        </div>

        <div className="relative px-6 pb-6 flex-1 flex flex-col gap-5">
          {/* Limites em pills */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "clientes", value: fmtLimit(plan.customer_limit) },
              { label: "campanhas", value: fmtLimit(plan.campaign_limit) },
              { label: "equipe", value: fmtLimit(plan.employee_limit) },
            ].map((it) => (
              <div key={it.label} className="rounded-lg py-2 px-1 text-xs bg-muted/60 border border-border/60">
                <div className="font-display font-bold text-sm">{it.value}</div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{it.label}</div>
              </div>
            ))}
          </div>

          {/* Features primárias */}
          <ul className="space-y-2.5 text-sm flex-1">
            {primary.map((f: any) => (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="flex items-start gap-2"
              >
                <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </div>
                <span>{f.feature_name}</span>
              </motion.li>
            ))}
          </ul>

          {rest.length > 0 && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1 self-start text-xs font-medium transition-colors text-muted-foreground hover:text-primary"
            >
              {expanded ? "Fechar recursos" : `Ver mais ${rest.length} recurso${rest.length > 1 ? "s" : ""}`}
              <motion.span animate={{ rotate: expanded ? (openLeft ? -180 : 180) : 0 }} transition={{ duration: 0.25 }}>
                <ChevronRight className="h-3.5 w-3.5" />
              </motion.span>
            </button>
          )}

          {/* CTA */}
          <motion.div whileTap={{ scale: 0.98 }}>
            <Button
              className={`w-full h-11 relative overflow-hidden group/btn ${
                featured ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25" : ""
              }`}
              variant={featured ? "default" : "outline"}
              disabled={isCurrent || !canAct}
              onClick={onAct}
            >
              {featured && !isCurrent && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
                />
              )}
              <span className="relative inline-flex items-center gap-2">
                {isCurrent ? "Plano atual" : isUpgrade ? <><ArrowUp className="h-4 w-4" /> Fazer upgrade</> : isDowngrade ? <><ArrowDown className="h-4 w-4" /> Fazer downgrade</> : (plan.button_text ?? `Assinar ${plan.name}`)}
              </span>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* ===== Painel lateral com recursos extras — expande para o lado sem sair da linha ===== */}
      <AnimatePresence>
        {expanded && rest.length > 0 && (
          <motion.aside
            key="side-panel"
            initial={{ opacity: 0, x: openLeft ? 24 : -24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: openLeft ? 24 : -24, scale: 0.96 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className={[
              "absolute top-0 z-40 w-[280px] max-w-[80vw]",
              openLeft ? "right-full mr-3" : "left-full ml-3",
              // em telas pequenas, cai abaixo do card em vez de sair da tela
              "hidden md:block",
            ].join(" ")}
          >
            <div className="relative rounded-2xl border border-primary/30 bg-card text-card-foreground shadow-[0_20px_60px_-25px_hsl(var(--primary)/0.55)] overflow-hidden">
              <LedBorder radius={16} />
              {/* seta de conexão */}
              <div
                aria-hidden
                className={`absolute top-8 h-3 w-3 rotate-45 border border-primary/30 bg-card ${openLeft ? "-right-1.5 border-l-0 border-b-0" : "-left-1.5 border-r-0 border-t-0"}`}
              />
              <div className="relative p-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Também inclui</div>
                <div className="font-display text-lg font-bold mt-1">Recursos adicionais</div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {rest.map((f: any, i: number) => (
                    <motion.li
                      key={f.id}
                      initial={{ opacity: 0, x: openLeft ? 8 : -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.04 }}
                      className="flex items-start gap-2"
                    >
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" />
                      </div>
                      <span>{f.feature_name}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Fallback mobile: acordeon vertical (só quando o painel lateral está oculto) */}
      <AnimatePresence>
        {expanded && rest.length > 0 && (
          <motion.div
            key="mobile-extra"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden overflow-hidden mt-3 rounded-2xl border border-primary/30 bg-card"
          >
            <ul className="p-4 space-y-2 text-sm">
              {rest.map((f: any) => (
                <li key={f.id} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{f.feature_name}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
