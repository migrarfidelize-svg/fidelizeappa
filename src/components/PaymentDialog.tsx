import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  createPixPayment, createCardPayment, createBoletoPayment,
  getPaymentStatus, getMercadoPagoPublicKey, getMercadoPagoAccountHint,
} from "@/lib/mercadopago.functions";
import { getActivePaymentProviders } from "@/lib/payment-providers.functions";
import { getUpgradeQuote } from "@/lib/plan-proration.functions";
import { getSubscriptionOriginNotice } from "@/lib/integrations/lifecycle-sync.functions";
import { AsaasPaymentTabs } from "@/components/AsaasPaymentTabs";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Copy, CheckCircle2, Clock, Loader2, QrCode, CreditCard, FileText, ExternalLink, Check, ShieldCheck, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

declare global { interface Window { MercadoPago?: any } }

type PlanInfo = { slug: string; name: string; price_monthly: number; tier: string };
type MercadoPagoHint = {
  account_email: string | null;
  account_nickname: string | null;
  environment: string;
  account_is_test_user?: boolean;
  configuration_issue?: string | null;
};

const MP_TEST_USERS_URL = "https://www.mercadopago.com.br/developers/panel/test-users";
const SANDBOX_APPROVED_CARDHOLDER = "APRO";
const SANDBOX_TEST_CPF = "12345678909";

function isMercadoPagoSandboxBuyerEmail(email: string) {
  const clean = email.trim().toLowerCase();
  return /^[^\s@]+@testuser\.com$/.test(clean);
}

function isOnlyMercadoPagoTestNickname(email: string) {
  return /^TESTUSER\d+$/i.test(email.trim());
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasValidBrazilianDocLength(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

function SandboxBuyerNotice() {
  return (
    <div className="rounded-md border border-amber-400/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p><strong>Sandbox/Teste ativo:</strong> o Mercado Pago exige o <strong>e-mail completo</strong> do comprador de teste gerado no painel dele.</p>
          <p>Não use Gmail/Hotmail, senha, ID ou nickname <code>TESTUSER...</code>; cole o e-mail no formato <code>test_user...@testuser.com</code>.</p>
          <a className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={MP_TEST_USERS_URL} target="_blank" rel="noreferrer">
            Gerar comprador de teste <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function validateSandboxBuyerEmail(isSandboxLike: boolean, email: string) {
  const clean = email.trim();
  if (!clean) {
    toast.error("Informe o e-mail do comprador.");
    return false;
  }
  if (isSandboxLike && isOnlyMercadoPagoTestNickname(clean)) {
    toast.error("Você informou o nickname TESTUSER. No Sandbox, use o e-mail completo do comprador de teste, terminado em @testuser.com.");
    return false;
  }
  if (isSandboxLike && !isMercadoPagoSandboxBuyerEmail(clean)) {
    toast.warning("Sandbox/Teste ativo: vamos tentar gerar o pagamento, mas se o Mercado Pago retornar 401 use um comprador de teste @testuser.com.");
  }
  return true;
}

function validateBrazilianDoc(doc: string, label = "CPF/CNPJ") {
  if (!hasValidBrazilianDocLength(doc)) {
    toast.error(`${label} inválido. Use 11 dígitos para CPF ou 14 para CNPJ. Para testes, use CPF ${SANDBOX_TEST_CPF}.`);
    return false;
  }
  return true;
}

function SandboxCardTestGuide() {
  return (
    <div className="rounded-md border border-blue-400/40 bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
      <p className="font-medium">Dados recomendados para cartão aprovado em Sandbox</p>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        <span>Nome: <code>{SANDBOX_APPROVED_CARDHOLDER}</code></span>
        <span>CPF: <code>{SANDBOX_TEST_CPF}</code></span>
        <span>Cartão: <code>5031 4332 1540 6351</code></span>
        <span>CVV/validade: <code>123</code> · <code>11/30</code></span>
      </div>
    </div>
  );
}

export function PaymentDialog({
  open, onOpenChange, plan, establishmentId, payerEmailDefault, onPaid,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plan: PlanInfo | null;
  establishmentId: string;
  payerEmailDefault?: string;
  /** Chamado quando o pagamento é concluído (destino pós-pagamento). */
  onPaid?: () => void;
}) {
  const handlePaid = () => { onOpenChange(false); onPaid?.(); };
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  const hintFn = useServerFn(getMercadoPagoAccountHint);
  const providersFn = useServerFn(getActivePaymentProviders);
  const { data: hint } = useQuery({
    queryKey: ["mp-account-hint"],
    queryFn: () => hintFn() as Promise<MercadoPagoHint>,
    enabled: open,
    staleTime: 5 * 60_000,
  });
  const { data: providersData } = useQuery({
    queryKey: ["active-payment-providers"],
    queryFn: () => providersFn() as Promise<{ providers: Array<{ id: "mercadopago" | "asaas"; enabled: boolean; mode: "sandbox" | "production" }> }>,
    enabled: open,
    staleTime: 60_000,
  });
  const activeProviders = (providersData?.providers ?? []).filter((p) => p.enabled);
  const hasMP = activeProviders.some((p) => p.id === "mercadopago") || activeProviders.length === 0;
  const hasAsaas = activeProviders.some((p) => p.id === "asaas");
  const [provider, setProvider] = useState<"mercadopago" | "asaas">("mercadopago");
  useEffect(() => {
    if (!hasMP && hasAsaas) setProvider("asaas");
    else if (hasMP && !hasAsaas) setProvider("mercadopago");
  }, [hasMP, hasAsaas]);
  const asaasMode = activeProviders.find((p) => p.id === "asaas")?.mode ?? "sandbox";
  const acctEmail = hint?.account_email ?? null;
  const isSandboxLike = (hint?.environment ?? "production") === "sandbox" || !!hint?.account_is_test_user;
  const isLive = !isSandboxLike;
  const conflicts = !!(acctEmail && payerEmailDefault && acctEmail.trim().toLowerCase() === payerEmailDefault.trim().toLowerCase());
  const configurationIssue = hint?.configuration_issue ?? null;
  const planBenefits = useMemo(() => {
    const tierMap: Record<string, string[]> = {
      starter: ["Clientes ilimitados no cartão", "Campanhas ativas", "Suporte por e-mail"],
      pro: ["Clientes ilimitados no cartão", "Múltiplas campanhas simultâneas", "Relatórios avançados", "Suporte prioritário"],
      enterprise: ["Multi-lojas e equipe", "API e integrações", "Gestor de conta dedicado", "SLA e suporte 24/7"],
    };
    return tierMap[plan?.tier ?? ""] ?? ["Ativação imediata", "Cancele quando quiser", "Nota fiscal automática", "Suporte incluso"];
  }, [plan?.tier]);

  // Crédito pró-rata: upgrade em até 7 dias da compra paga só a diferença.
  const quoteFn = useServerFn(getUpgradeQuote);
  const { data: quote } = useQuery({
    queryKey: ["upgrade-quote", establishmentId, plan?.slug],
    queryFn: () => quoteFn({ data: { establishment_id: establishmentId, plan_slug: plan!.slug } }) as Promise<{
      base_amount: number; credit: number; amount: number; is_upgrade_credit: boolean;
      days_since_payment: number | null; window_days: number; previous_plan_slug: string | null;
    }>,
    enabled: open && !!plan && !!establishmentId,
    staleTime: 30_000,
  });
  const hasCredit = !!quote?.is_upgrade_credit;
  const dueNow = hasCredit ? quote!.amount : (plan?.price_monthly ?? 0);
  const chargePlan = plan ? { ...plan, price_monthly: dueNow } : null;

  // Aviso: contas vindas de parceiro (ex.: Ronnei) têm a assinatura original encerrada.
  const originFn = useServerFn(getSubscriptionOriginNotice);
  const { data: originNotice } = useQuery({
    queryKey: ["subscription-origin", establishmentId],
    queryFn: () => originFn({ data: { establishment_id: establishmentId } }),
    enabled: open && !!establishmentId,
    staleTime: 60_000,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 gap-0 border-0 shadow-2xl sm:rounded-3xl" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Assinar {plan?.name}</DialogTitle>
          <DialogDescription>Checkout seguro para assinar o plano {plan?.name}.</DialogDescription>
        </DialogHeader>

        {plan && (
          <div className="grid max-h-[92vh] grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] overflow-hidden">
            {/* LEFT — plan summary (navy) */}
            <aside className="relative flex flex-col justify-between overflow-y-auto bg-[#0a0a1a] p-8 text-white md:p-10" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-black italic">F</div>
                  <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Fidelize</span>
                </div>

                <div className="mt-10 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300/80">Plano selecionado</span>
                  <h2 className="text-3xl font-bold leading-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{plan.name}</h2>
                  <p className="text-sm text-slate-400">Assinatura mensal · Cobrança recorrente</p>
                </div>

                <ul className="mt-8 space-y-3">
                  {planBenefits.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-slate-200">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-indigo-300">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <span className="min-w-0">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Total mensal</span>
                    <span className="text-[11px] text-slate-500">BRL</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
                    {hasCredit && <span className="mr-1 text-lg text-slate-500 line-through">{fmt(plan.price_monthly)}</span>}
                    <span className="text-4xl font-extrabold tracking-tight">{fmt(dueNow)}</span>
                    <span className="text-sm text-slate-400">{hasCredit ? "agora" : "/mês"}</span>
                  </div>
                  {hasCredit ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-200">
                      <p className="font-semibold">Crédito de upgrade aplicado — {fmt(quote!.credit)}</p>
                      <p className="mt-1 text-emerald-200/80">
                        Você assinou há {quote!.days_since_payment ?? 0} dia(s) (dentro dos {quote!.window_days} dias).
                        Descontamos o que já foi pago: você paga só a diferença. Nas próximas cobranças, o valor mensal volta a ser {fmt(plan.price_monthly)}.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">Cancele quando quiser · Sem fidelidade</p>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />PCI-DSS</span>
                  <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-indigo-300" />SSL 256-bit</span>
                  <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-indigo-300" />LGPD</span>
                </div>
              </div>
            </aside>

            {/* RIGHT — payment orchestration */}
            <section className="flex flex-col overflow-y-auto bg-white p-6 dark:bg-neutral-950 md:p-10">
              <header className="mb-6 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>Pagamento</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Confirmação automática · Ativação imediata</p>
                </div>
                {hasMP && hasAsaas && (
                  <Select value={provider} onValueChange={(v) => setProvider(v as "mercadopago" | "asaas")}>
                    <SelectTrigger className="h-9 w-[180px] shrink-0 rounded-full border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mercadopago">Mercado Pago{isSandboxLike ? " · Sandbox" : ""}</SelectItem>
                      <SelectItem value="asaas">Asaas{asaasMode === "sandbox" ? " · Sandbox" : ""}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </header>

              {provider === "mercadopago" ? (
                <div className="space-y-4">
                  {configurationIssue && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                      <strong>Mercado Pago precisa de ajuste:</strong> {configurationIssue}
                    </div>
                  )}
                  {isSandboxLike && <SandboxBuyerNotice />}
                  {isLive && acctEmail && (
                    <div className={`rounded-xl border p-3 text-xs ${conflicts ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"}`}>
                      {conflicts ? "⛔" : "⚠️"} <strong>Importante:</strong> use um e-mail e CPF/CNPJ <strong>diferentes</strong> de <code className="rounded bg-black/5 px-1 py-0.5">{acctEmail}</code>{hint?.account_nickname ? ` (${hint.account_nickname})` : ""}. O Mercado Pago bloqueia (<code>401</code>) quando o pagador é o próprio titular.
                    </div>
                  )}
                  {isLive && !acctEmail && (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                      ⚠️ Use um e-mail e CPF/CNPJ <strong>diferentes</strong> dos cadastrados na conta Mercado Pago que recebe.
                    </div>
                  )}
                  <Tabs defaultValue="pix" className="w-full">
                    <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-neutral-900">
                      <TabsTrigger value="pix" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"><QrCode className="mr-2 h-4 w-4" />PIX</TabsTrigger>
                      <TabsTrigger value="card" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"><CreditCard className="mr-2 h-4 w-4" />Cartão</TabsTrigger>
                      <TabsTrigger value="boleto" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-neutral-800"><FileText className="mr-2 h-4 w-4" />Boleto</TabsTrigger>
                    </TabsList>
                    <TabsContent value="pix" className="mt-5 focus-visible:outline-none">
                      <PixForm plan={chargePlan!} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={handlePaid} />
                    </TabsContent>
                    <TabsContent value="card" className="mt-5 focus-visible:outline-none">
                      <CardForm plan={chargePlan!} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={handlePaid} />
                    </TabsContent>
                    <TabsContent value="boleto" className="mt-5 focus-visible:outline-none">
                      <BoletoForm plan={chargePlan!} establishmentId={establishmentId} payerEmailDefault={payerEmailDefault} isSandboxLike={isSandboxLike} onDone={handlePaid} />
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <AsaasPaymentTabs
                  plan={chargePlan!}
                  establishmentId={establishmentId}
                  payerEmailDefault={payerEmailDefault}
                  isSandboxLike={asaasMode === "sandbox"}
                  onDone={handlePaid}
                />
              )}

              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                Pagamento processado com segurança via <span className="font-semibold">{provider === "mercadopago" ? "Mercado Pago" : "Asaas"}</span>
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ PIX ============
function PixForm({ plan, establishmentId, payerEmailDefault, isSandboxLike, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; isSandboxLike: boolean; onDone: () => void }) {
  const createFn = useServerFn(createPixPayment);
  const statusFn = useServerFn(getPaymentStatus);
  const qc = useQueryClient();

  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [charge, setCharge] = useState<null | { mp_payment_id: string; qr_code: string | null; qr_code_base64: string | null; expires_at: string }>(null);
  const [status, setStatus] = useState<string>("pending");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (isSandboxLike && !emailTouched && (!email || email === payerEmailDefault)) {
      setEmail("");
    }
  }, [email, emailTouched, isSandboxLike, payerEmailDefault]);

  useEffect(() => {
    if (!charge || status === "approved") return;
    const t = setInterval(async () => {
      try {
        const r: any = await statusFn({ data: { mp_payment_id: charge.mp_payment_id } });
        setStatus(r.status);
        if (r.status === "approved") {
          toast.success("Pagamento confirmado! Plano ativado.");
          qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["establishment"] }); qc.invalidateQueries({ queryKey: ["est-full"] }); qc.invalidateQueries({ queryKey: ["memberships"] });
          setTimeout(onDone, 1200);
        } else if (["rejected","cancelled","refunded"].includes(r.status)) {
          toast.error(`Pagamento ${r.status}. ${r.status_detail ?? ""}`);
        }
      } catch { /* ignore transient */ }
    }, 4000);
    return () => clearInterval(t);
  }, [charge, status, statusFn, qc, onDone]);

  useEffect(() => {
    if (!charge) return;
    const end = new Date(charge.expires_at).getTime();
    const tick = () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [charge]);

  async function create() {
    if (!validateSandboxBuyerEmail(isSandboxLike, email)) return;
    setLoading(true);
    try {
      const r: any = await createFn({ data: { establishment_id: establishmentId, plan_slug: plan.slug, payer_email: email.trim(), payer_doc: doc || undefined } });
      setCharge({ mp_payment_id: r.mp_payment_id, qr_code: r.qr_code, qr_code_base64: r.qr_code_base64, expires_at: r.expires_at });
      setStatus(r.status);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  if (!charge) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>E-mail do pagador</Label>
          <Input value={email} onChange={e => { setEmailTouched(true); setEmail(e.target.value); }} placeholder={isSandboxLike ? "test_user...@testuser.com" : "voce@empresa.com"} />
        </div>
        {isSandboxLike && <SandboxBuyerNotice />}
        <div className="space-y-2">
          <Label>CPF/CNPJ (opcional)</Label>
          <Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" />
        </div>
        <p className="text-xs text-muted-foreground">
          {isSandboxLike ? "Para testes, use o e-mail do comprador de teste gerado no Mercado Pago." : <>Use um e-mail <strong>diferente</strong> do titular da conta Mercado Pago que recebe. Em credenciais LIVE, o dono da conta não pode pagar para si mesmo.</>}
        </p>
        <Button className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all" onClick={create} disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando QR Code…</> : "Gerar QR Code PIX"}
        </Button>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant={status === "approved" ? "default" : "secondary"} className="text-sm">
          {status === "approved" ? <><CheckCircle2 className="mr-1 h-3 w-3" />Aprovado</> :
           status === "pending" ? <><Clock className="mr-1 h-3 w-3" />Aguardando pagamento</> : status}
        </Badge>
        <span className="text-sm text-muted-foreground">Expira em {mm}:{ss}</span>
      </div>

      {charge.qr_code_base64 && (
        <div className="flex justify-center rounded-lg border bg-white p-4">
          <img alt="QR Code PIX" src={`data:image/png;base64,${charge.qr_code_base64}`} className="h-64 w-64 object-contain" />
        </div>
      )}

      <div className="space-y-2">
        <Label>PIX Copia e Cola</Label>
        <div className="flex gap-2">
          <Input readOnly value={charge.qr_code ?? ""} className="font-mono text-xs" />
          <Button variant="outline" size="icon" aria-label="Copiar código PIX" onClick={() => { navigator.clipboard.writeText(charge.qr_code ?? ""); toast.success("Copiado!"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        A confirmação é automática assim que o banco enviar o retorno (em geral em segundos).
      </p>
    </div>
  );
}

// ============ Cartão ============
function CardForm({ plan, establishmentId, payerEmailDefault, isSandboxLike, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; isSandboxLike: boolean; onDone: () => void }) {
  const createFn = useServerFn(createCardPayment);
  const statusFn = useServerFn(getPaymentStatus);
  const publicKeyFn = useServerFn(getMercadoPagoPublicKey);
  const qc = useQueryClient();

  const [sdkReady, setSdkReady] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [publicKeyLoading, setPublicKeyLoading] = useState(false);
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
  const [mpInstance, setMpInstance] = useState<any>(null);
  const [number, setNumber] = useState("");
  const [name, setName] = useState(isSandboxLike ? SANDBOX_APPROVED_CARDHOLDER : "");
  const [exp, setExp] = useState("");
  const [cvv, setCvv] = useState("");
  const [installments, setInstallments] = useState("1");
  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [doc, setDoc] = useState(isSandboxLike ? SANDBOX_TEST_CPF : "");
  const [docType, setDocType] = useState<"CPF"|"CNPJ">("CPF");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  async function loadPublicKey() {
    setPublicKeyLoading(true);
    setPublicKeyError(null);
    try {
      let r: any = null;
      try {
        const res = await fetch("/api/public/mercadopago/public-key", { cache: "no-store" });
        if (res.ok) r = await res.json();
      } catch {
        // Fallback abaixo via server function.
      }
      if (!r?.public_key) r = await publicKeyFn();
      const key = typeof r?.public_key === "string" ? r.public_key.trim() : "";
      if (!key) {
        setPublicKey(null);
        setPublicKeyError("Public Key ainda não foi encontrada no backend.");
        return;
      }
      setPublicKey(key);
      if (!document.getElementById("mp-sdk-v2")) {
        const s = document.createElement("script");
        s.id = "mp-sdk-v2";
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.async = true;
        s.onload = () => setSdkReady(true);
        s.onerror = () => setPublicKeyError("Não foi possível carregar o SDK do Mercado Pago.");
        document.head.appendChild(s);
      } else {
        setSdkReady(true);
      }
    } catch (e: any) {
      setPublicKey(null);
      setPublicKeyError(e?.message ?? "Falha ao buscar a Public Key do Mercado Pago.");
    } finally {
      setPublicKeyLoading(false);
    }
  }

  useEffect(() => {
    loadPublicKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sdkReady && publicKey && window.MercadoPago) {
      setMpInstance(new window.MercadoPago(publicKey, { locale: "pt-BR" }));
    }
  }, [sdkReady, publicKey]);

  useEffect(() => {
    if (isSandboxLike && !emailTouched && (!email || email === payerEmailDefault)) {
      setEmail("");
    }
  }, [email, emailTouched, isSandboxLike, payerEmailDefault]);

  useEffect(() => {
    if (!isSandboxLike) return;
    if (!name) setName(SANDBOX_APPROVED_CARDHOLDER);
    if (!doc) setDoc(SANDBOX_TEST_CPF);
  }, [doc, isSandboxLike, name]);

  // polling if payment is pending after submit
  useEffect(() => {
    if (!paymentId || status === "approved") return;
    const t = setInterval(async () => {
      try {
        const r: any = await statusFn({ data: { mp_payment_id: paymentId } });
        setStatus(r.status);
        if (r.status === "approved") { toast.success("Pagamento aprovado! Plano ativado."); qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["establishment"] }); qc.invalidateQueries({ queryKey: ["est-full"] }); qc.invalidateQueries({ queryKey: ["memberships"] }); setTimeout(onDone, 1200); }
        else if (["rejected","cancelled"].includes(r.status)) toast.error(`Pagamento ${r.status}.`);
      } catch {}
    }, 3000);
    const stop = setTimeout(() => clearInterval(t), 60_000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [paymentId, status, statusFn, qc, onDone]);

  async function submit() {
    if (!mpInstance) { toast.error(publicKeyLoading ? "Carregando SDK do Mercado Pago…" : "SDK Mercado Pago não carregado. Verifique a Public Key em /hash/pagamentos."); return; }
    if (!validateSandboxBuyerEmail(isSandboxLike, email)) return;
    const cleanNumber = number.replace(/\s+/g, "");
    const [expMonth, expYearShort] = exp.split("/").map(s => s.trim());
    if (!cleanNumber || !expMonth || !expYearShort || !cvv || !name) { toast.error("Preencha os dados do cartão."); return; }
    if (!validateBrazilianDoc(doc, docType)) return;
    setLoading(true);
    try {
      // Tokenização no browser — dados do cartão nunca chegam ao backend
      const token = await mpInstance.createCardToken({
        cardNumber: cleanNumber,
        cardholderName: name,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYearShort.length === 2 ? `20${expYearShort}` : expYearShort,
        securityCode: cvv,
        identificationType: docType,
        identificationNumber: doc.replace(/\D/g, ""),
      });
      if (!token?.id) throw new Error(getMercadoPagoSdkErrorMessage(token?.error, "Falha ao tokenizar cartão."));

      // Descobre payment_method_id (bandeira) via BIN
      const bin = cleanNumber.slice(0, 8);
      const pm = await mpInstance.getPaymentMethods({ bin });
      const methodId = pm?.results?.[0]?.id ?? "visa";
      const issuerId = pm?.results?.[0]?.issuer?.id ? String(pm.results[0].issuer.id) : undefined;

      const r: any = await createFn({ data: {
        establishment_id: establishmentId,
        plan_slug: plan.slug,
        token: token.id,
        payment_method_id: methodId,
        issuer_id: issuerId,
        installments: Number(installments),
        payer_email: email.trim(),
        payer_doc_type: docType,
        payer_doc_number: doc,
      }});
      setPaymentId(r.mp_payment_id);
      setStatus(r.status);
      setStatusDetail(r.status_detail);
      if (r.status === "approved") {
        toast.success("Pagamento aprovado!");
        qc.invalidateQueries({ queryKey: ["billing"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["establishment"] }); qc.invalidateQueries({ queryKey: ["est-full"] }); qc.invalidateQueries({ queryKey: ["memberships"] });
        setTimeout(onDone, 1200);
      } else if (r.status === "in_process") {
        toast.info("Pagamento em análise. Aguardando confirmação…");
      } else if (r.status === "rejected") {
        toast.error(`Cartão recusado: ${translateDetail(r.status_detail)}`);
      }
    } catch (e: any) {
      toast.error(getMercadoPagoSdkErrorMessage(e, "Falha no pagamento."));
    } finally {
      setLoading(false);
    }
  }

  function fillSandboxCardData() {
    setName(SANDBOX_APPROVED_CARDHOLDER);
    setNumber(formatCardNumber("5031433215406351"));
    setExp("11/30");
    setCvv("123");
    setDocType("CPF");
    setDoc(SANDBOX_TEST_CPF);
    toast.success("Dados de cartão de teste preenchidos. Informe apenas o e-mail do comprador de teste.");
  }

  if (status === "approved") {
    return <div className="text-center py-8"><CheckCircle2 className="mx-auto h-12 w-12 text-primary" /><p className="mt-2 font-semibold">Pagamento aprovado!</p></div>;
  }

  return (
    <div className="space-y-3">
      {isSandboxLike && <SandboxBuyerNotice />}
      {isSandboxLike && (
        <div className="space-y-2">
          <SandboxCardTestGuide />
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={fillSandboxCardData}>
            Preencher cartão de teste aprovado
          </Button>
        </div>
      )}
      {!publicKey && publicKeyLoading && (
        <div className="rounded-md border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Carregando Public Key do Mercado Pago…
        </div>
      )}
      {!publicKey && !publicKeyLoading && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div>Public Key do Mercado Pago não configurada ou não carregada. Confirme em /hash/pagamentos e tente novamente.</div>
          {publicKeyError && <div className="mt-1 text-xs opacity-80">Detalhe: {publicKeyError}</div>}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={loadPublicKey}>Verificar novamente</Button>
        </div>
      )}
      <div className="space-y-2">
        <Label>Nome impresso no cartão</Label>
        <Input value={name} onChange={e => setName(e.target.value.toUpperCase())} placeholder="COMO IMPRESSO" />
      </div>
      <div className="space-y-2">
        <Label>Número do cartão</Label>
        <Input value={number} onChange={e => setNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" maxLength={19} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Validade (MM/AA)</Label><Input value={exp} onChange={e => setExp(formatExp(e.target.value))} placeholder="MM/AA" maxLength={5} /></div>
        <div className="space-y-2"><Label>CVV</Label><Input value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Parcelas</Label>
          <Select value={installments} onValueChange={setInstallments}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,6,12].map(i => <SelectItem key={i} value={String(i)}>{i}x de {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price_monthly / i)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo doc</Label>
          <Select value={docType} onValueChange={v => setDocType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="CPF">CPF</SelectItem><SelectItem value="CNPJ">CNPJ</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" /></div>
        <div className="space-y-2"><Label>E-mail do comprador</Label><Input type="email" value={email} onChange={e => { setEmailTouched(true); setEmail(e.target.value); }} placeholder={isSandboxLike ? "test_user...@testuser.com" : undefined} /></div>
      </div>

      {statusDetail && status !== "approved" && (
        <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Status: {status} — {translateDetail(statusDetail)}</div>
      )}

      <Button className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all" onClick={submit} disabled={loading || publicKeyLoading || !mpInstance}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando…</> : `Pagar ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(plan.price_monthly)}`}
      </Button>
      <p className="text-[10px] text-center text-muted-foreground">Dados do cartão tokenizados pelo SDK oficial do Mercado Pago. Nada trafega em texto puro.</p>
    </div>
  );
}

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function formatExp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d;
}
function translateDetail(d?: string | null): string {
  const map: Record<string, string> = {
    cc_rejected_insufficient_amount: "Saldo insuficiente",
    cc_rejected_bad_filled_card_number: "Número do cartão inválido",
    cc_rejected_bad_filled_date: "Validade inválida",
    cc_rejected_bad_filled_security_code: "CVV inválido",
    cc_rejected_bad_filled_other: "Dados inválidos",
    cc_rejected_call_for_authorize: "Autorize a compra com o banco emissor",
    cc_rejected_high_risk: "Recusado por prevenção a fraude",
    cc_rejected_other_reason: "Recusado pelo emissor",
    pending_contingency: "Em análise",
    pending_review_manual: "Em análise manual",
    accredited: "Aprovado",
  };
  return d ? (map[d] ?? d) : "";
}

function getMercadoPagoSdkErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const err = error as Record<string, any>;
    const cause = Array.isArray(err.cause) ? err.cause[0] : null;
    const code = cause?.code ?? err.code;
    const description = cause?.description ?? err.description ?? err.message;
    if (description && code) return `${description} (${code})`;
    if (description) return String(description);
    try { return JSON.stringify(error); } catch { return fallback; }
  }
  return fallback;
}

// ============ Boleto ============
function BoletoForm({ plan, establishmentId, payerEmailDefault, isSandboxLike, onDone }: { plan: PlanInfo; establishmentId: string; payerEmailDefault?: string; isSandboxLike: boolean; onDone: () => void }) {
  const createFn = useServerFn(createBoletoPayment);
  const [email, setEmail] = useState(payerEmailDefault ?? "");
  const [emailTouched, setEmailTouched] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | { boleto_url: string | null; expires_at: string; mp_payment_id: string }>(null);

  useEffect(() => {
    if (isSandboxLike && !emailTouched && (!email || email === payerEmailDefault)) {
      setEmail("");
    }
  }, [email, emailTouched, isSandboxLike, payerEmailDefault]);

  async function submit() {
    if (!email || !first || !last || !doc) { toast.error("Preencha todos os campos."); return; }
    if (!validateSandboxBuyerEmail(isSandboxLike, email)) return;
    if (!validateBrazilianDoc(doc)) return;
    setLoading(true);
    try {
      const r: any = await createFn({ data: { establishment_id: establishmentId, plan_slug: plan.slug, payer_email: email.trim(), payer_first_name: first, payer_last_name: last, payer_doc_number: doc } });
      setResult({ boleto_url: r.boleto_url, expires_at: r.expires_at, mp_payment_id: r.mp_payment_id });
      toast.success("Boleto gerado!");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar boleto"); }
    finally { setLoading(false); }
  }

  if (result) {
    return (
      <div className="space-y-4 text-center">
        <FileText className="mx-auto h-12 w-12 text-primary" />
        <p className="font-semibold">Boleto gerado!</p>
        <p className="text-sm text-muted-foreground">Vence em {new Date(result.expires_at).toLocaleDateString("pt-BR")}</p>
        {result.boleto_url && <a href={result.boleto_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground"><ExternalLink className="h-4 w-4" />Abrir boleto</a>}
        <p className="text-xs text-muted-foreground">Após o pagamento, a compensação leva até 3 dias úteis. O plano será ativado automaticamente.</p>
        <Button variant="outline" onClick={onDone} className="w-full">Fechar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isSandboxLike && <SandboxBuyerNotice />}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label>Nome</Label><Input value={first} onChange={e => setFirst(e.target.value)} /></div>
        <div className="space-y-2"><Label>Sobrenome</Label><Input value={last} onChange={e => setLast(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label>E-mail do comprador</Label><Input type="email" value={email} onChange={e => { setEmailTouched(true); setEmail(e.target.value); }} placeholder={isSandboxLike ? "test_user...@testuser.com" : undefined} /></div>
      <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Apenas números" /></div>
      <Button className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all" onClick={submit} disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando…</> : "Gerar boleto"}
      </Button>
    </div>
  );
}
