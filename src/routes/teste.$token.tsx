import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getTrialInvitePublic, registerTrialInviteVisit } from "@/lib/trial-invites.functions";
import { Loader2, ShieldCheck, Gift, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/teste/$token")({
  ssr: false,
  component: TrialInviteEntry,
  head: () => ({ meta: [
    { title: "Convite para testar a Fidelize" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
});

function TrialInviteEntry() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const started = useRef(false);
  const [state, setState] = useState<"loading" | "expired" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      try {
        const invitation = await getTrialInvitePublic({ data: { token } });
        if (cancelled) return;
        if (!invitation.available) {
          setState("expired");
          setMessage(invitation.reason);
          return;
        }
        const storageKey = "fidelize:trial-visitor:" + token;
        let visitor = localStorage.getItem(storageKey);
        if (!visitor || !/^[0-9a-f-]{36}$/i.test(visitor)) {
          visitor = crypto.randomUUID();
          localStorage.setItem(storageKey, visitor);
        }
        const params = new URLSearchParams(window.location.search);
        const tracked = await registerTrialInviteVisit({ data: {
          token,
          visitor_id: visitor,
          referrer: document.referrer.slice(0, 500),
          utm_source: (params.get("utm_source") ?? "").slice(0, 80),
          utm_medium: (params.get("utm_medium") ?? "").slice(0, 80),
          utm_campaign: (params.get("utm_campaign") ?? "").slice(0, 80),
        } });
        if (!tracked.ok) throw new Error("Não foi possível registrar o acesso ao convite.");
        localStorage.setItem("fidelize:pending-trial", JSON.stringify({ token, visitor_id: visitor, at: Date.now() }));
        if (!cancelled) {
          window.location.replace("/auth?mode=signup&as=establishment&trial=" + encodeURIComponent(token));
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Erro ao abrir convite.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-5">
      <div className="w-full max-w-md rounded-3xl border border-border/70 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex justify-center"><Logo /></div>
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          {state === "loading" ? <Loader2 className="h-7 w-7 animate-spin" /> : state === "expired" ? <Gift className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {state === "loading" ? "Preparando sua experiência" : state === "expired" ? "Convite indisponível" : "Não foi possível abrir"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state === "loading" ? "Você será direcionado ao cadastro da Fidelize." : message}
        </p>
        {state !== "loading" && (
          <button type="button" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-4 w-4" /> Conhecer a Fidelize
          </button>
        )}
      </div>
    </div>
  );
}
