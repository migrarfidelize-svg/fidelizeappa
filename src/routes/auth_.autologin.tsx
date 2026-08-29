import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { exchangeAutologinToken } from "@/lib/autologin.functions";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/auth_/autologin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrando na sua conta — Fidelize" },
      { name: "description", content: "Login automático seguro na sua conta Fidelize." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Entrando na sua conta — Fidelize" },
      { property: "og:description", content: "Login automático seguro na sua conta Fidelize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutologinPage,
});

function AutologinPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Validando seu acesso…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const token = new URLSearchParams(window.location.search).get("token") ?? "";
      if (!token) {
        setStatus("error");
        setMessage("Link de acesso inválido.");
        return;
      }
      try {
        const res = await exchangeAutologinToken({ data: { token } });
        if (!res.ok) {
          setStatus("error");
          setMessage(res.message);
          return;
        }
        const { error } = await supabase.auth.verifyOtp({
          email: res.email,
          token_hash: res.token_hash,
          type: "magiclink",
        });
        if (error) {
          console.error("[autologin] verifyOtp", error);
          setStatus("error");
          setMessage("Não foi possível abrir a sessão automática. Entre com e-mail e senha.");
          return;
        }
        // Limpa o token da URL antes de seguir.
        window.history.replaceState({}, "", "/auth/autologin");
        setStatus("ok");
        setMessage("Login concluído. Redirecionando…");
        navigate({ to: "/app" });
      } catch {
        setStatus("error");
        setMessage("Não foi possível validar seu acesso.");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Logo />
          <h1 className="text-xl font-semibold">Acesso automático</h1>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-4 text-center">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === "ok" && <ShieldCheck className="h-4 w-4 text-primary" />}
            {status === "error" && <TriangleAlert className="h-4 w-4 text-destructive" />}
            {message}
          </p>

          {status === "error" && (
            <Button className="w-full gradient-brand text-primary-foreground" onClick={() => navigate({ to: "/auth" })}>
              Ir para o login
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
