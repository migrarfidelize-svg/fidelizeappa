import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { requestPasswordRecovery } from "@/lib/email.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Mail, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth_/recuperar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Recuperar senha — Fidelize" }] }),
  component: RecoverPage,
});

function RecoverPage() {
  const navigate = useNavigate();
  const recover = useServerFn(requestPasswordRecovery);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const redirect_to = `${window.location.origin}/auth/nova-senha`;
      await recover({ data: { email: email.trim(), redirect_to } });
      setSent(true);
      toast.success("Se este e-mail existir, enviamos as instruções.");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2"><Logo /><h1 className="text-xl font-semibold">Recuperar senha</h1></div>
        {sent ? (
          <div className="rounded-2xl border bg-card p-6 space-y-3 text-center">
            <Mail className="h-10 w-10 mx-auto text-primary" />
            <h2 className="font-semibold">Verifique seu e-mail</h2>
            <p className="text-sm text-muted-foreground">
              Se <span className="font-mono">{email}</span> estiver cadastrado, você receberá um link para redefinir a senha em instantes.
            </p>
            <Button variant="secondary" className="w-full" onClick={() => navigate({ to: "/auth" })}>Voltar ao login</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="recover-email">E-mail da conta</Label>
              <Input id="recover-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" aria-describedby="recover-email-hint" />
              <p id="recover-email-hint" className="text-xs text-muted-foreground">Enviaremos um link seguro para redefinir sua senha.</p>
            </div>
            <Button type="submit" disabled={loading || !email} className="w-full gradient-brand text-primary-foreground">
              {loading ? "Enviando…" : "Enviar link de recuperação"}
            </Button>
            <Link to="/auth" className="text-xs text-muted-foreground flex items-center gap-1 justify-center hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
