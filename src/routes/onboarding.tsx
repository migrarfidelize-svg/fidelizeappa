import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createEstablishment, getMyEstablishments } from "@/lib/loyalty.functions";
import { claimAffiliateReferral } from "@/lib/affiliate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { toast } from "sonner";
import {
  Upload,
  X,
  Loader2,
  LogOut,
  Building2,
  Palette,
  Gift,
  Rocket,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { LogoCropper } from "@/components/LogoCropper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STAMP_ICON_OPTIONS, getStampIcon, stampIconLabel } from "@/lib/stampIcons";
import { DISCOVER_CATEGORIES } from "@/lib/discover-categories";
import { getAuthenticatedAccountAccess } from "@/lib/account-access.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    try {
      const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
      const to = await resolveAuthenticatedDestination();
      if (to !== "/onboarding") throw redirect({ to });
    } catch (e) {
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
    }
  },
  head: () => ({ meta: [{ title: "Configurar minha empresa — Fidelize" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Onboarding,
});

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function IconRow({ value }: { value: string }) {
  const Icon = getStampIcon(value);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span>{stampIconLabel(value)}</span>
    </span>
  );
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

type StepId = "empresa" | "marca";
const STEPS: { id: StepId; label: string; icon: typeof Building2 }[] = [
  { id: "empresa", label: "Empresa", icon: Building2 },
  { id: "marca", label: "Marca", icon: Palette },
];

function Onboarding() {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const create = useServerFn(createEstablishment);
  const claimReferral = useServerFn(claimAffiliateReferral);
  const getEsts = useServerFn(getMyEstablishments);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [logoRev, setLogoRev] = useState(0);
  const [stepOverride, setStepOverride] = useState<StepId | null>(null);
  const prefill = (() => {
    try {
      const raw = localStorage.getItem("fidelize:onboarding-prefill");
      if (!raw) return { name: "", segment: "" };
      const p = JSON.parse(raw) as { name?: string; segment?: string };
      return { name: (p?.name ?? "").slice(0, 60), segment: p?.segment ?? "" };
    } catch {
      return { name: "", segment: "" };
    }
  })();
  const prefillName = prefill.name;
  const [f, setF] = useState({
    name: prefillName,
    slug: prefillName ? slugify(prefillName) : "",
    segment: prefill.segment,
    description: "",
    primary_color: "#22d3ee",
    accent_color: "#e879f9",
    logo_url: "" as string,
    campaign_name: "Cartão Fidelidade",
    stamps_required: 10,
    // Padrão pronto: o cartão pode ser ajustado depois, no painel.
    reward_title: "Brinde exclusivo",
    reward_description: "",

    stamp_icon: "coffee",
  });

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((s) => ({
      ...s,
      [k]: v,
      ...(k === "name" && !s.slug ? { slug: slugify(v as string) } : {}),
    }));
  }

  const completion = useMemo(() => {
    const checks = {
      empresa: f.name.trim().length >= 2 && slugify(f.slug).length >= 3 && !!f.segment,
      marca: !!f.logo_url || (!!f.primary_color && !!f.accent_color),
    };
    const done = Object.values(checks).filter(Boolean).length;
    return { checks, done, total: STEPS.length, pct: Math.round((done / STEPS.length) * 100) };
  }, [f]);

  const activeStep: StepId = stepOverride || (!completion.checks.empresa
    ? "empresa"
    : "marca");

  async function signOut() {
    const isPwa = window.matchMedia("(display-mode: standalone)").matches;
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      qc.clear();
      navigate({ to: isPwa ? "/auth" : "/", search: isPwa ? { source: "pwa" } : undefined });
    } catch {
      toast.error("Não foi possível encerrar a sessão.");
    } finally {
      setSigningOut(false);
    }
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      toast.error("Envie uma imagem PNG, JPG, WEBP ou SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5 MB).");
      return;
    }
    setRawFile(file);
    setCropOpen(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadCropped(blob: Blob, _shape: "circle" | "rounded" | "square") {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const path = `${uid}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from("logos").upload(path, blob, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/png",
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("logos")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr || new Error("Falha ao gerar link");
      set("logo_url", signed.signedUrl);
      setLogoRev((r) => r + 1);
      toast.success("Logo atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar logo");
    } finally {
      setUploading(false);
      setRawFile(null);
    }
  }

  function removeLogo() {
    set("logo_url", "");
    setLogoRev((r) => r + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanSlug = slugify(f.slug);
    if (cleanSlug.length < 3) {
      toast.error("O endereço público precisa ter pelo menos 3 caracteres.");
      return;
    }
    if (f.name.trim().length < 2) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (!f.segment) {
      toast.error("Selecione a categoria do seu negócio.");
      return;
    }
    // A configuração do cartão é opcional aqui: usamos um padrão e o lojista
    // ajusta depois no painel. O caminho crítico é criar a empresa e pagar o plano.
    const rewardTitle = f.reward_title.trim().length >= 2 ? f.reward_title.trim() : "Brinde exclusivo";
    setLoading(true);
    try {
      const created = await create({ data: { ...f, reward_title: rewardTitle, slug: cleanSlug } });
      // Atribuição única ao estabelecimento recém-criado; pagamento ainda NÃO gera saldo.
      try {
        const raw = localStorage.getItem("fidelize:affiliate-ref");
        if (raw) {
          const campaign = JSON.parse(raw) as { code?: string; at?: number };
          if (campaign.code && campaign.at && Date.now() - campaign.at < 30 * 24 * 60 * 60 * 1000) {
            await claimReferral({ data: { establishment_id: created.establishment_id, code: campaign.code } });
          }
          localStorage.removeItem("fidelize:affiliate-ref");
        }
      } catch (referralError) {
        // Não interrompe o cadastro nem o checkout caso haja falha de atribuição.
        console.warn("[affiliate] indicação não vinculada", referralError);
      }

      try { localStorage.removeItem("fidelize:onboarding-prefill"); } catch { /* ignore */ }
      
      // Invalidação agressiva de cache para o Subscription Gate refletir a nova empresa imediatamente
      await qc.invalidateQueries({ queryKey: ["memberships"] });
      await qc.refetchQueries({ queryKey: ["memberships"] });
      
      // Forçamos a invalidação do estado do roteador antes de navegar
      await router.invalidate();
      
      toast.success("Empresa criada! Agora escolha seu plano para ativar.");
      navigate({ to: "/app/planos" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      {/* Circuit background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] dark:opacity-[0.10]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="ob-circuit" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
              <path
                d="M0 60 H36 L48 48 H84 L96 60 H120 M60 0 V36 L72 48 V84 L60 96 V120"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
                className="text-primary"
              />
              <circle cx="48" cy="48" r="1.6" className="fill-primary" />
              <circle cx="72" cy="48" r="1.6" className="fill-primary" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ob-circuit)" />
        </svg>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(closest-side, var(--primary), transparent)" }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <Logo />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={signOut}
            disabled={signingOut}
            className="shrink-0 gap-2 border-border/60 text-muted-foreground hover:border-destructive/50 hover:text-destructive"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            <span className="hidden sm:inline">Sair da conta</span>
            <span className="sm:hidden">Sair</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        {/* Left: form */}
        <form onSubmit={submit} className="flex min-w-0 flex-col gap-6 sm:gap-8 lg:gap-10">
          {/* Stepper */}
          <nav aria-label="Progresso" className="flex items-center justify-center gap-1 sm:gap-3">
            {STEPS.map((s, i) => {
              const done = completion.checks[s.id];
              const active = activeStep === s.id;
              const StepIcon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-1.5 sm:gap-3">
                  <div
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-wide transition-all sm:px-3 sm:py-1.5 sm:text-xs ${
                      active
                        ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--primary)]"
                        : done
                          ? "border-primary/30 bg-primary/5 text-primary/80"
                          : "border-border/60 bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold sm:h-5 sm:w-5 ${
                        done
                          ? "bg-primary text-primary-foreground"
                          : active
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </span>
                    <StepIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span className="h-px w-4 bg-border sm:w-6" />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Section: Empresa */}
          {activeStep === "empresa" && (
            <Section
            icon={Building2}
            title="Configurar sua empresa"
            subtitle="Comece com a identidade base do seu negócio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da empresa">
                <Input
                  value={f.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ex: Café do Centro"
                />
              </Field>
              <Field label="Endereço público">
                <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <span className="hidden items-center border-r border-input bg-muted/50 px-3 text-xs text-muted-foreground sm:flex">
                    fidelize.app/cartao/
                  </span>
                  <Input
                    value={f.slug}
                    onChange={(e) => set("slug", slugify(e.target.value))}
                    required
                    minLength={3}
                    placeholder="cafe-do-centro"
                    className="border-0 focus-visible:ring-0"
                  />
                </div>
              </Field>
            </div>

            <Field label="Categoria do negócio">
              <Select value={f.segment} onValueChange={(v) => set("segment", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOVER_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Usada para seu negócio aparecer na categoria certa no Descobrir da carteira.
              </p>
            </Field>

            <Field label="Descrição (opcional)">
              <Textarea
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Uma frase sobre o seu negócio"
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                disabled={!completion.checks.empresa}
                onClick={() => setStepOverride("marca")}
                className="gap-2"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Section>
          )}

          {/* Section: Marca */}
          {activeStep === "marca" && (
            <Section
              icon={Palette}
              title="Identidade visual"
              subtitle="Cores e logo que aparecem no cartão dos seus clientes."
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-2 -ml-2 text-muted-foreground"
                onClick={() => setStepOverride("empresa")}
              >
                ← Voltar para Empresa
              </Button>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cor principal">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={f.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                  />
                  <Input
                    value={f.primary_color}
                    onChange={(e) => set("primary_color", e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Cor de destaque">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={f.accent_color}
                    onChange={(e) => set("accent_color", e.target.value)}
                    className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                  />
                  <Input
                    value={f.accent_color}
                    onChange={(e) => set("accent_color", e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <Field label="Logo do seu negócio (opcional)">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted/40">
                  {f.logo_url ? (
                    <img
                      key={logoRev}
                      src={f.logo_url}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="font-display text-xs font-bold text-muted-foreground">
                      {(f.name || "?")
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={onPickLogo}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {f.logo_url ? "Trocar logo" : "Enviar logo"}
                    </Button>
                    {f.logo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                        <X className="mr-1 h-4 w-4" /> Remover
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WEBP ou SVG. Até 5 MB. Você recorta antes de enviar.
                  </p>
                </div>
              </div>
            </Field>
          </Section>
          )}

          {/* CTA */}
          <div className="sticky bottom-4 z-50 flex flex-col items-stretch gap-4 rounded-2xl border border-border/60 bg-card/80 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground sm:justify-start">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>
                {completion.done}/{completion.total} etapas concluídas · {completion.pct}%
              </span>
            </div>
            {activeStep === "marca" && (
              <Button
                type="submit"
                disabled={loading || completion.done < completion.total}
              size="lg"
              className="group relative overflow-hidden bg-gradient-to-r from-primary to-accent font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--primary)]"
            >
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <Rocket className="mr-2 h-4 w-4" />
              {loading ? "Criando…" : "Concluir configuração"}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            )}
          </div>
        </form>

        {/* Right: sticky preview */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-40 blur-3xl animate-pulse"
                style={{
                  background:
                    "conic-gradient(from 0deg, var(--primary), var(--accent), var(--primary))",
                }}
              />
              <div className="relative rounded-[2rem] border border-border/60 bg-card/70 p-5 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Prévia ao vivo
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    LIVE
                  </span>
                </div>
                <StampCard
                  key={logoRev}
                  brandName={f.name || "Sua empresa"}
                  logoUrl={f.logo_url || undefined}
                  customerName="Cliente exemplo"
                  stamps={Math.min(3, f.stamps_required)}
                  required={f.stamps_required}
                  reward={f.reward_title || "Sua recompensa aqui"}
                  primary={f.primary_color}
                  accent={f.accent_color}
                  icon={f.stamp_icon}
                />
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                  Este é o cartão que seus clientes verão ao escanear o QR Code do seu
                  estabelecimento. Ajuste e veja em tempo real.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <LogoCropper
        file={rawFile}
        open={cropOpen}
        onOpenChange={(o) => {
          setCropOpen(o);
          if (!o) setRawFile(null);
        }}
        onCropped={uploadCropped}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Building2;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-fade-in space-y-4 rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm sm:p-5 md:p-7 lg:space-y-5">
      <header className="flex items-center gap-4">
        <span className="card-icon shrink-0">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-bold md:text-xl">{title}</h2>
          <p className="text-xs text-muted-foreground md:text-sm">{subtitle}</p>
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:text-[11px] sm:tracking-[0.15em]">
        {label}
      </Label>
      {children}
    </div>
  );
}
