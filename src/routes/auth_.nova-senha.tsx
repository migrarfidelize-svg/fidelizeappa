import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/auth_/nova-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nova senha — Fidelize" }] }),
  component: NewPasswordPage,
});

function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase envia tokens no hash; detecta sessão de recovery
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Mínimo de 6 caracteres."); return; }
    if (password.length > 15) { toast.error("Máximo de 15 caracteres."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada!");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2"><Logo /><h1 className="text-xl font-semibold">Definir nova senha</h1></div>
        <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-6 space-y-4">
          {!ready && <p className="text-xs text-muted-foreground">Validando link… se você abriu por engano, solicite outro link.</p>}
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input id="new-password" type="password" required minLength={6} maxLength={15} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="new-password-hint" />
            <p id="new-password-hint" className="text-xs text-muted-foreground">De 6 a 15 caracteres. Pode ser só números.</p>
          </div>
          <Button type="submit" disabled={loading || !ready} className="w-full gradient-brand text-primary-foreground">
            {loading ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
