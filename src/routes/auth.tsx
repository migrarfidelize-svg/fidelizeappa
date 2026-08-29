import { RouteLoading } from "@/components/RouteLoading";
import { cn } from "@/lib/utils";

import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { motion, AnimatePresence } from "framer-motion";

import { getWalletHint, setWalletHint, formatWalletHint } from "@/lib/wallet-hint";
import { getKeepSignedIn, setKeepSignedIn } from "@/lib/session-keeper";
import { getSettledSession } from "@/lib/session-ready";
import { setPlanIntent } from "@/lib/plan-intent";
import { trackPlanFunnel, rememberSelectedPlan } from "@/lib/plan-funnel";

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Coffee, Check, ArrowRight, Sparkles, Wifi, Store, User, Loader2, Eye, EyeOff, Building2, Phone, MessageCircle, AlertCircle } from "lucide-react";

export const ONBOARDING_PREFILL_KEY = "fidelize:onboarding-prefill";
import { claimCustomerByToken, attachEstablishmentBySlug } from "@/lib/my-wallet.functions";
import { DISCOVER_CATEGORIES } from "@/lib/discover-categories";
import { getCaptchaConfig, verifyCaptcha } from "@/lib/captcha.functions";
import { guardAuthAttempt, reportAuthAttempt } from "@/lib/auth-guard.functions";
import { Turnstile, resetTurnstile } from "@/components/Turnstile";
import { useIsMobile } from "@/hooks/use-mobile";
import { requestOTP, verifyOTP } from "@/lib/otp.functions";

const AUTH_SYNC_CHANNEL = "fidelize-auth-sync";

function notifyAuthSync(type: "SIGNED_IN" | "SIGNED_UP") {
  try {
    localStorage.setItem("fidelize:last-auth-sync", JSON.stringify({ type, at: Date.now(), host: window.location.host }));
  } catch {}
  try {
    const bc = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    bc.postMessage({ type: "SIGNED_IN", source: "auth-route", at: Date.now() });
    bc.close();
  } catch {}
}

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).default("signin"),
  as: z.enum(["customer", "establishment"]).optional(),
  claim: z.string().optional(),
  est_slug: z.string().optional(),
  next: z.string().optional(),
  source: z.string().optional(),
  plan: z.string().optional(),
});

async function routeAfterAuth(opts: { claim?: string; est_slug?: string; next?: string; role?: "customer" | "establishment" }): Promise<{ to: string; toast?: string; toastKind?: "success" | "error" | "info" }> {
  if (opts.est_slug) {
    try {
      const r = await attachEstablishmentBySlug({ data: { slug: opts.est_slug } });
      const msg = r.status === "created"
        ? `Bem-vindo à ${r.name}! Um novo cartão foi criado na sua carteira.`
        : r.status === "adopted"
        ? `Encontramos um cadastro antigo em ${r.name} com o seu WhatsApp — vinculamos à sua conta e mantivemos seu histórico.`
        : `Você já tinha cartão em ${r.name}. Nada mudou no seu cadastro anterior.`;
      return { to: `/carteira/${r.slug}`, toast: msg, toastKind: "success" };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const name = (err as { establishmentName?: string })?.establishmentName;
      const slug = (err as { slug?: string })?.slug ?? opts.est_slug;
      if (code === "inactive") {
        return { to: "/carteira", toast: `${name ?? slug} está inativo/suspenso.`, toastKind: "error" };
      }
      if (code === "not_found") {
        return { to: "/carteira", toast: `Estabelecimento "${slug}" não encontrado.`, toastKind: "error" };
      }
    }
  }
  if (opts.claim) {
    try {
      const r = await claimCustomerByToken({ data: { token: opts.claim } });
      return { to: `/carteira/${r.slug}`, toast: "Cartão salvo na sua carteira!", toastKind: "success" };
    } catch {}
  }
  if (opts.next && opts.next.startsWith("/")) return { to: opts.next };

  try {
    const { resolveAuthenticatedDestination } = await import("@/lib/destination-resolver");
    const to = await resolveAuthenticatedDestination();
    return { to };
  } catch (error) {
    console.error("[auth] falha ao carregar papel após login", error);
    return { to: "/carteira" };
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  ssr: false,
  beforeLoad: async ({ search }) => {
    const session = await getSettledSession();
    if (session?.user) {
      const dest = await routeAfterAuth({ claim: search.claim, est_slug: search.est_slug, next: search.next, role: search.as });
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    // Head metadata is now handled by the central SEO configuration.
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const router = useRouter();
  const { mode } = search;
  const trackedPlanRef = useRef<string | null>(null);

  useEffect(() => {
    if (!search.plan) return;
    setPlanIntent(search.plan);
    rememberSelectedPlan(search.plan);
    if (trackedPlanRef.current === search.plan) return;
    trackedPlanRef.current = search.plan;
    trackPlanFunnel({ stage: "auth_intent", plan_slug: search.plan, source: "auth" });
  }, [search.plan]);

  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState(() => formatWalletHint(getWalletHint()));
  const [company, setCompany] = useState("");
  const [segment, setSegment] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [keepSignedIn, setKeepSignedInState] = useState<boolean>(() => getKeepSignedIn());

  // OTP State
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpStatus, setOtpStatus] = useState<"default" | "verifying" | "success" | "error">("default");
  const otpVerifyingRef = useRef(false);
  const otpAutoSubmittedRef = useRef(false);


  useEffect(() => { setKeepSignedIn(keepSignedIn); }, [keepSignedIn]);

  const [role, setRole] = useState<"customer" | "establishment">(
    search.as ?? (search.claim || search.est_slug || search.source === "pwa" || (typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches) ? "customer" : "establishment"),
  );

  const isSignup = mode === "signup";
  const isCustomer = role === "customer";
  const isEstablishmentSignup = isSignup && role === "establishment";
  const walletFlow = isCustomer;

  async function completeAuthRedirect(to: string, type: "SIGNED_IN" | "SIGNED_UP") {
    notifyAuthSync(type);
    const session = await getSettledSession(3000);
    if (!session) {
      setRedirecting(false);
      toast.info("Não conseguimos iniciar sua sessão. Tente novamente.");
      return;
    }
    setRedirecting(true);
    try { await router.invalidate(); } catch {}
    await router.navigate({ to, replace: true, search: (prev: any) => ({ ...prev, source: undefined }) });
    window.setTimeout(() => {
      if (window.location.pathname.startsWith("/auth")) setRedirecting(false);
    }, 2500);
  }

  function formatWhatsapp(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  const isMobile = useIsMobile();
  const [captcha, setCaptcha] = useState<{ enabled: boolean; siteKey: string } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  useEffect(() => {
    if (isMobile) return;
    let alive = true;
    getCaptchaConfig().then((c) => { if (alive) setCaptcha(c); }).catch(() => { if (alive) setCaptcha({ enabled: false, siteKey: "" }); });
    return () => { alive = false; };
  }, [isMobile]);
  const captchaRequired = !isMobile && !!captcha?.enabled;

  const [honeypot, setHoneypot] = useState("");
  const formOpenedAt = useRef(Date.now());
  useEffect(() => { formOpenedAt.current = Date.now(); }, [mode, role]);

  const currentIdentifier = () => walletFlow ? whatsapp.replace(/\D/g, "") : email.trim().toLowerCase();

  async function handleRequestOtp() {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (isSignup && name.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }

    setLoading(true);
    try {
      const result = await requestOTP({ data: { whatsapp: digits, name: isSignup ? name : undefined } });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setOtpStep(true);
      setOtpCooldown(60);
      toast.success("Código enviado para seu WhatsApp!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  async function handleVerifyOtp(codeOverride?: string) {
    const code = codeOverride || otpCode;
    if (code.length !== 6) {
      toast.error("O código deve ter 6 dígitos.");
      return;
    }
    
    if (otpVerifyingRef.current) return;
    otpVerifyingRef.current = true;
    
    setLoading(true);
    setOtpStatus("verifying");
    
    try {
      // Chamada paralela: validação no backend + tempo mínimo de animação
      const [res] = await Promise.all([
        verifyOTP({ data: { whatsapp: whatsapp.replace(/\D/g, ""), code } }),
        new Promise(resolve => setTimeout(resolve, 800)) // Tempo para animação de decifrando
      ]);

      if (res.ok && res.hashed_token) {
        // MANTER otpStatus = verifying enquanto valida sessão Supabase
        
        const { data: authData, error } =
          await supabase.auth.verifyOtp({
            token_hash: res.hashed_token,
            type: "email",
          });

        if (error) {
          setOtpStatus("error");
          console.error("[auth] Falha ao criar sessão após OTP:", error);
          throw error;
        }

        if (!authData.session || !authData.user) {
          setOtpStatus("error");
          throw new Error("Sessão não estabelecida. Solicite um novo código.");
        }

        // AGORA SIM: Sucesso confirmado com sessão e usuário
        setOtpStatus("success");
        
        if (walletFlow) {
          setWalletHint(whatsapp);
        }

        const dest = await routeAfterAuth({
          claim: search.claim,
          est_slug: search.est_slug,
          next: search.next,
          role,
        });

        // Delay visual curto para o usuário ver o "verde" antes do redirect
        await new Promise(resolve => setTimeout(resolve, 500));

        await completeAuthRedirect(
          dest.to,
          isSignup ? "SIGNED_UP" : "SIGNED_IN"
        );
      } else {
        setOtpStatus("error");
        toast.error("Código inválido. Confira os números e tente novamente.");
      }
    } catch (err) {
      setOtpStatus("error");
      const msg = err instanceof Error ? err.message : "Erro ao validar código.";
      toast.error(msg);
    } finally {
      setLoading(false);
      otpVerifyingRef.current = false;
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (walletFlow) {
      if (otpStep) await handleVerifyOtp();
      else await handleRequestOtp();
      return;
    }

    // Standard Establishment Login/Signup
    const action = isSignup ? ("signup" as const) : ("login" as const);
    const identifier = currentIdentifier();

    const guard = await guardAuthAttempt({ data: { identifier, action, honeypot, elapsedMs: Date.now() - formOpenedAt.current } }).catch(() => null);
    if (guard && !guard.ok) {
      toast.error(guard.message);
      return;
    }

    if (captchaRequired) {
      if (!captchaToken) { toast.error("Confirme o desafio de segurança."); return; }
      const check = await verifyCaptcha({ data: { token: captchaToken } }).catch(() => null);
      if (!check?.ok) { toast.error("Falha no desafio de segurança."); setCaptchaToken(null); resetTurnstile(); return; }
      setCaptchaToken(null); resetTurnstile();
    }

    setLoading(true);
    const markAttempt = (success: boolean) => void reportAuthAttempt({ data: { identifier, action, success } }).catch(() => null);
    
    try {
      if (isSignup) {
        if (company.trim().length < 2) throw new Error("Informe o nome do seu negócio.");
        if (!segment) throw new Error("Selecione a categoria do seu negócio.");
        
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name: name, company_name: company.trim() },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (error) throw error;
        
        const session = (await supabase.auth.getSession()).data.session;
        const uid = session?.user?.id || signUpData.user?.id;
        if (uid) {
          await supabase.from("profiles").upsert({ id: uid, full_name: name, account_type: "establishment" });
          localStorage.setItem(ONBOARDING_PREFILL_KEY, JSON.stringify({ name: company.trim(), segment, at: Date.now() }));
        }
        markAttempt(true);
        await completeAuthRedirect("/onboarding", "SIGNED_UP");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        markAttempt(true);
        const dest = await routeAfterAuth({ next: search.next, role: "establishment" });
        await completeAuthRedirect(dest.to, "SIGNED_IN");
      }
    } catch (err) {
      markAttempt(false);
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-cinema relative min-h-dvh w-full overflow-hidden bg-background px-6 py-4">
      {redirecting && <RouteLoading label="Carregando seu painel…" />}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />
      <div className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="text-foreground"><Logo className="text-foreground" /></Link>
        <Link to="/" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary">← Voltar</Link>
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100dvh-5rem)] max-w-6xl grid-cols-1 items-center gap-8 lg:gap-12 lg:grid-cols-2">
        <div className="hidden flex-col items-center space-y-6 lg:flex lg:items-start">
          <div className="auth-card-stage group [perspective:2200px]">
             {/* Animacion visual del card omitida para brevedad pero mantenida en el real */}
             <div className="auth-loyalty-card relative aspect-[1.6/1] w-[460px] max-w-full rounded-[26px] bg-card border border-white/10 shadow-2xl overflow-hidden" data-no-fx>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/10 z-0" />
                <div className="relative z-10 p-8 flex flex-col h-full">
                   <div className="flex items-center justify-between">
                     <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-black">Fidelize Rewards</div>
                     <div className="h-8 w-8 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                        <Sparkles className="h-4 w-4" />
                     </div>
                   </div>
                   
                   <div className="mt-auto">
                     <div className="text-2xl font-black text-foreground tracking-tighter leading-tight">Sua fidelidade<br />digital agora é <span className="text-primary">real.</span></div>
                     
                     <div className="mt-6 flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="h-8 w-8 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                              <Check className="h-4 w-4 text-primary" />
                            </div>
                          ))}
                          <div className="h-8 w-8 rounded-full border-2 border-card bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                            +5
                          </div>
                        </div>
                        <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full w-2/3 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                        </div>
                     </div>
                   </div>
                </div>
             </div>
          </div>
          <div className="max-w-md text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold leading-tight text-foreground">Onde a lealdade vira <span className="text-primary">experiência.</span></h1>
            <p className="mt-2 text-sm text-muted-foreground">O programa de fidelidade que seus clientes amam usar.</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-border bg-card/80 p-5 backdrop-blur-xl sm:p-6">
            <div className="relative mb-6 grid grid-cols-2 rounded-full border border-border bg-muted p-1">
              <span className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-[0_0_24px_rgba(167,139,250,0.45)] transition-transform duration-500" style={{ transform: isSignup ? "translateX(100%)" : "translateX(0%)" }} />
              <Link to="/auth" search={{ ...search, mode: "signin" }} className={"relative z-10 rounded-full py-2 text-center text-sm font-semibold " + (isSignup ? "text-muted-foreground" : "text-primary-foreground")}>Entrar</Link>
              <Link to="/auth" search={{ ...search, mode: "signup" }} className={"relative z-10 rounded-full py-2 text-center text-sm font-semibold " + (isSignup ? "text-primary-foreground" : "text-muted-foreground")}>Criar conta</Link>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {search.source !== "wallet" && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button type="button" onClick={() => { setRole("customer"); setOtpStep(false); }} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${role === "customer" ? "border-primary bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}><User className="h-4 w-4" /> Cliente</button>
                  <button type="button" onClick={() => setRole("establishment")} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${role === "establishment" ? "border-primary bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}><Store className="h-4 w-4" /> Negócio</button>
                </div>
              )}

              {!otpStep ? (
                <>
                  {isSignup && (
                    <div className="space-y-1">
                      <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">Seu Nome</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} required className="auth-input" placeholder="Como quer ser chamado" />
                    </div>
                  )}

                  {walletFlow ? (
                    <div className="space-y-1">
                      <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsapp(e.target.value))} required className="auth-input pl-11" placeholder="(00) 00000-0000" />
                      </div>
                    </div>
                  ) : (
                    <>
                      {isEstablishmentSignup && (
                        <div className="space-y-1">
                          <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">Nome do Negócio</label>
                          <input value={company} onChange={(e) => setCompany(e.target.value)} required className="auth-input" placeholder="Ex: Pizzaria do Vale" />
                        </div>
                      )}
                      {isEstablishmentSignup && (
                        <div className="space-y-1">
                          <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">Categoria do Negócio</label>
                          <select
                            value={segment}
                            onChange={(e) => setSegment(e.target.value)}
                            required
                            className="auth-input appearance-none bg-card"
                          >
                            <option value="">Selecione uma categoria</option>
                            {DISCOVER_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.emoji} {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">E-mail</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-input" placeholder="seu@email.com" />
                      </div>
                      <div className="space-y-1">
                        <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-primary">Senha</label>
                        <div className="relative">
                          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="auth-input" placeholder="••••••••" />
                          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                        </div>
                        {!isSignup && (
                          <div className="pt-1 text-right">
                            <Link to="/auth/recuperar" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                              Esqueci minha senha
                            </Link>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    x: otpStatus === "error" ? [0, -10, 10, -10, 10, 0] : 0
                  }}
                  transition={{ 
                    duration: otpStatus === "error" ? 0.4 : 0.5,
                    ease: otpStatus === "error" ? "easeInOut" : "easeOut"
                  }}
                  className="space-y-6 py-2"
                >
                  <div className="text-center space-y-3">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"
                    >
                      <MessageCircle className="h-7 w-7 text-primary" />
                    </motion.div>
                    <div className="space-y-1">
                      <h3 className="font-display text-xl font-bold">Confirme seu WhatsApp</h3>
                      <p className="text-sm text-muted-foreground">
                        Enviamos um código para <br />
                        <span className="font-bold text-foreground text-base">{whatsapp}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      disabled={loading || otpStatus === "success"}
                      onComplete={(val) => {
                        if (!otpAutoSubmittedRef.current) {
                          otpAutoSubmittedRef.current = true;
                          handleVerifyOtp(val);
                        }
                      }}
                      onChange={(val) => {
                        setOtpCode(val);
                        if (otpStatus === "error") setOtpStatus("default");
                        otpAutoSubmittedRef.current = false;
                      }}
                    >
                      <InputOTPGroup className="gap-2 sm:gap-3">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <InputOTPSlot
                            key={idx}
                            index={idx}
                            status={otpStatus}
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <AnimatePresence mode="wait">
                    {otpStatus === "error" ? (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center justify-center gap-2 text-xs font-medium text-destructive"
                      >
                        <AlertCircle className="h-3 w-3" />
                        Código inválido. Confira os números e tente novamente.
                      </motion.div>
                    ) : otpStatus === "success" ? (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="flex items-center justify-center gap-2 text-xs font-medium text-success"
                      >
                        <Check className="h-3 w-3" />
                        Código confirmado
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <button 
                          type="button" 
                          disabled={otpCooldown > 0 || loading} 
                          onClick={handleRequestOtp} 
                          className="text-xs font-semibold text-primary transition-colors hover:text-primary/80 disabled:text-muted-foreground"
                        >
                          {otpCooldown > 0 ? `Reenviar código em ${otpCooldown}s` : "Reenviar código"}
                        </button>
                        <button 
                          type="button" 
                          disabled={loading}
                          onClick={() => { setOtpStep(false); setOtpCode(""); setOtpStatus("default"); }} 
                          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Alterar número
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {captchaRequired && captcha?.siteKey && <div className="flex justify-center py-2"><Turnstile siteKey={captcha.siteKey} onToken={setCaptchaToken} /></div>}

              <button 
                type="submit" 
                disabled={loading || (otpStep && (otpCode.length < 6 || otpStatus === "success"))} 
                className={cn(
                  "auth-submit mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all",
                  otpStatus === "success" && "bg-success hover:bg-success ring-0 shadow-lg shadow-success/20"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : otpStatus === "success" ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Código confirmado</span>
                  </>
                ) : (
                  <>
                    <span>{otpStep ? "Confirmar Código" : (walletFlow ? "Receber Código via WhatsApp" : "Continuar")}</span>
                    {!otpStep && <ArrowRight className="h-4 w-4" />}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
