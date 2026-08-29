import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, Check, LogIn, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/acesso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seu acesso — Fidelize" },
      { name: "description", content: "Entre automaticamente na sua conta Fidelize e veja seus dados de acesso." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Seu acesso — Fidelize" },
      { property: "og:description", content: "Entre automaticamente na sua conta Fidelize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

function decodeSecret(hash: string): string | null {
  const match = /(?:^|[#&])p=([^&]+)/.exec(hash);
  if (!match?.[1]) return null;
  try {
    const b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return null;
  }
}

function AccessPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"loading" | "signed" | "manual">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mail = params.get("e") ?? "";
    const token = params.get("t");
    setEmail(mail);
    setPassword(decodeSecret(window.location.hash));

    (async () => {
      const { data: current } = await supabase.auth.getSession();
      if (current.session) { setStatus("signed"); return; }
      if (!token || !mail) { setStatus("manual"); return; }
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      setStatus(error ? "manual" : "signed");
    })();
  }, []);

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Logo />
          <h1 className="text-xl font-semibold">Seu acesso está pronto</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4">
          {status === "loading" && <p className="text-sm text-muted-foreground">Validando seu link de acesso…</p>}

          {status === "signed" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Login automático concluído.
            </p>
          )}

          {status === "manual" && (
            <p className="text-sm text-muted-foreground">
              O link de entrada automática expirou ou já foi usado. Use o e-mail e a senha abaixo para entrar.
            </p>
          )}

          {email && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">E-mail</span>
              <p className="font-mono text-sm break-all">{email}</p>
            </div>
          )}

          {password && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Senha temporária</span>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm flex-1 rounded-lg border bg-muted/40 px-3 py-2 break-all">
                  {reveal ? password : "•".repeat(password.length)}
                </p>
                <Button type="button" variant="secondary" size="icon" onClick={() => setReveal((v) => !v)} aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}>
                  {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="secondary" size="icon" onClick={copyPassword} aria-label="Copiar senha">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Recomendamos alterar a senha no primeiro acesso.</p>
            </div>
          )}

          <Button
            className="w-full gradient-brand text-primary-foreground"
            onClick={() => navigate({ to: status === "signed" ? "/app" : "/auth" })}
            disabled={status === "loading"}
          >
            <LogIn className="h-4 w-4 mr-2" />
            {status === "signed" ? "Entrar no painel" : "Ir para o login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
