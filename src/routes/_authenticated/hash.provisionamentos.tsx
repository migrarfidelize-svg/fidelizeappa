import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ServerCog as HeroIcon, MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminProvisioningOverview,
  adminProvisioningAction,
  adminProvisioningDetail,
} from "@/lib/provisioning-admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSkeleton } from "@/components/states";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/hash/provisionamentos")({
  head: () => ({
    meta: [
      { title: "Provisionamentos — Fidelize Admin" },
      { name: "description", content: "Central de provisionamentos: busca, filtros, ações rápidas e auditoria das contas criadas via API." },
      { property: "og:title", content: "Provisionamentos — Fidelize Admin" },
      { property: "og:description", content: "Central de operação das contas provisionadas pela API de integrações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminProvisionamentos,
});

const ACTION_LABEL: Record<string, string> = {
  api_provision_account: "Criação de conta",
  api_provision_resend_access: "Reenvio de acesso",
  api_change_plan: "Alteração de plano",
  api_suspend_account: "Suspensão",
  api_reactivate_account: "Reativação",
};

type StatusFilter = "todos" | "ativos" | "suspensos" | "falha" | "teste";
type PeriodFilter = "sempre" | "hoje" | "7d" | "30d";

const STATUS_FILTERS: Array<[StatusFilter, string]> = [
  ["todos", "Todos"],
  ["ativos", "Ativos"],
  ["suspensos", "Suspensos"],
  ["falha", "Falha"],
  ["teste", "Teste"],
];
const PERIOD_FILTERS: Array<[PeriodFilter, string]> = [
  ["sempre", "Todo período"],
  ["hoje", "Hoje"],
  ["7d", "Últimos 7 dias"],
  ["30d", "Últimos 30 dias"],
];

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copiado.`);
}

function AdminProvisionamentos() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(adminProvisioningOverview);
  const runAction = useServerFn(adminProvisioningAction);
  const fetchDetail = useServerFn(adminProvisioningDetail);

  const { data, isLoading } = useQuery({ queryKey: ["admin-provisioning"], queryFn: () => fetchOverview() });

  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [period, setPeriod] = useState<PeriodFilter>("sempre");
  const [confirm, setConfirm] = useState<null | { tenantId: string; action: "resend_access" | "new_password" | "suspend" | "reactivate"; name: string }>(null);
  const [detailTenant, setDetailTenant] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (v: { tenant_id: string; action: "resend_access" | "new_password" | "suspend" | "reactivate" }) =>
      runAction({ data: v }),
    onSuccess: (res: Record<string, unknown>, v) => {
      qc.invalidateQueries({ queryKey: ["admin-provisioning"] });
      if (v.action === "suspend") toast.success("Conta suspensa.");
      else if (v.action === "reactivate") toast.success("Conta reativada.");
      else {
        const pwd = String(res["temporary_password"] ?? "");
        toast.success(pwd ? `Nova senha temporária: ${pwd}` : "Acesso reenviado.", {
          duration: 15000,
          action: pwd ? { label: "Copiar", onClick: () => copy(pwd, "Senha temporária") } : undefined,
        });
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha na ação."),
  });

  const detailQ = useQuery({
    queryKey: ["admin-provisioning-detail", detailTenant],
    queryFn: () => fetchDetail({ data: { tenant_id: detailTenant! } }),
    enabled: !!detailTenant,
  });

  const accounts = useMemo(() => {
    const list = data?.accounts ?? [];
    const q = term.trim().toLowerCase();
    const now = Date.now();
    const since =
      period === "hoje"
        ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
        : period === "7d"
          ? now - 7 * 86400_000
          : period === "30d"
            ? now - 30 * 86400_000
            : 0;

    return list.filter((a) => {
      if (since && new Date(a.created_at).getTime() < since) return false;
      if (status === "ativos" && a.status !== "ativa") return false;
      if (status === "suspensos" && a.status !== "suspensa") return false;
      if (status === "falha" && a.status !== "erro") return false;
      if (status === "teste" && !a.sandbox) return false;
      if (!q) return true;
      const haystack = [a.name, a.email, a.tenant_id, a.plan, a.source, a.slug]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [data, term, status, period]);

  if (isLoading || !data) return <LoadingSkeleton variant="page" />;

  const cards: Array<[string, string]> = [
    ["Total provisionado", String(data.total)],
    ["Ativos", String(data.active)],
    ["Suspensos", String(data.suspended)],
    ["Falhas", String(data.errored)],
    ["Taxa de sucesso", `${(data.success_rate ?? 100).toFixed(1).replace(".", ",")}%`],
  ];

  const loginUrlOf = (email: unknown) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/auth${email ? `?email=${encodeURIComponent(String(email))}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow="Super Admin · Provisionamentos"
        title="Central de provisionamentos"
        subtitle="Busque, filtre e opere as contas criadas via API com auditoria completa."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="metric-number text-2xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Último provisionamento</CardTitle>
          <CardDescription>Conta mais recente criada pela API de integrações.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.last_provision ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{data.last_provision.tenant_name ?? data.last_provision.tenant_id}</p>
              <p className="text-xs text-muted-foreground break-all">
                {new Date(data.last_provision.created_at).toLocaleString("pt-BR")} ·{" "}
                plano {String(data.last_provision.plan ?? "—")} · {String(data.last_provision.email ?? "—")}
                {data.last_provision.source ? ` · origem ${String(data.last_provision.source)}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum provisionamento registrado.</p>
          )}

          {Object.keys(data.by_plan).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(data.by_plan).map(([plan, total]) => (
                <Badge key={plan} variant="secondary">
                  {plan}: {String(total)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas provisionadas</CardTitle>
          <CardDescription>Busque por empresa, e-mail, tenant ID, plano ou origem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar empresa, e-mail, tenant ID, plano ou origem…"
              className="pl-9"
              aria-label="Busca de provisionamentos"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map(([value, label]) => (
              <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>
                {label}
              </Button>
            ))}
            <span className="mx-1 hidden w-px bg-border sm:block" />
            {PERIOD_FILTERS.map(([value, label]) => (
              <Button key={value} size="sm" variant={period === value ? "secondary" : "ghost"} onClick={() => setPeriod(value)}>
                {label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">{accounts.length} registro(s) encontrados.</p>

          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta encontrada com esses critérios.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Criada em</th>
                    <th className="py-2 pr-3">Empresa</th>
                    <th className="py-2 pr-3">E-mail</th>
                    <th className="py-2 pr-3">Plano</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(a.created_at).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-3">{a.name}</td>
                      <td className="py-2 pr-3 break-all">{String(a.email ?? "—")}</td>
                      <td className="py-2 pr-3">{String(a.plan ?? "—")}</td>
                      <td className="py-2 pr-3">{String(a.source ?? "—")}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={a.status === "ativa" ? "default" : a.status === "suspensa" ? "secondary" : "outline"}>
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" aria-label={`Ações de ${a.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              disabled={!a.tenant_id}
                              onSelect={() => a.tenant_id && setConfirm({ tenantId: a.tenant_id, action: "resend_access", name: a.name })}
                            >
                              Reenviar acesso
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!a.tenant_id}
                              onSelect={() => a.tenant_id && setConfirm({ tenantId: a.tenant_id, action: "new_password", name: a.name })}
                            >
                              Gerar nova senha temporária
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => copy(String(a.login_url ?? loginUrlOf(a.email)), "URL de acesso")}>
                              Copiar URL de acesso
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!a.email} onSelect={() => copy(String(a.email ?? ""), "Login")}>
                              Copiar login
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled={!a.tenant_id} onSelect={() => a.tenant_id && setDetailTenant(a.tenant_id)}>
                              Visualizar auditoria completa
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {a.status === "suspensa" ? (
                              <DropdownMenuItem
                                disabled={!a.tenant_id}
                                onSelect={() => a.tenant_id && setConfirm({ tenantId: a.tenant_id, action: "reactivate", name: a.name })}
                              >
                                Reativar conta
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={!a.tenant_id}
                                className="text-destructive"
                                onSelect={() => a.tenant_id && setConfirm({ tenantId: a.tenant_id, action: "suspend", name: a.name })}
                              >
                                Suspender conta
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria de provisionamento</CardTitle>
          <CardDescription>Registros imutáveis: ação, tenant, IP, chave, payload e resposta.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-2">
              {data.events.slice(0, 50).map((e) => (
                <div key={e.id} className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{ACTION_LABEL[e.action] ?? e.action}</Badge>
                    <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                    <span className="text-muted-foreground break-all">
                      {e.tenant_name ?? e.tenant_id ?? "—"} · IP {e.ip ?? "—"} · chave {String(e.api_key_id ?? "—")}
                    </span>
                  </div>
                  {(e.payload || e.response) && (
                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                      {JSON.stringify({ payload: e.payload, response: e.response }, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "suspend"
                ? "Suspender conta"
                : confirm?.action === "reactivate"
                  ? "Reativar conta"
                  : confirm?.action === "new_password"
                    ? "Gerar nova senha temporária"
                    : "Reenviar acesso"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "suspend"
                ? `A empresa ${confirm?.name} perderá o acesso imediatamente e a assinatura será cancelada.`
                : confirm?.action === "reactivate"
                  ? `A empresa ${confirm?.name} voltará a ter acesso e a assinatura será renovada por 30 dias.`
                  : `Uma nova senha temporária será gerada para ${confirm?.name} e enviada por e-mail. A senha atual deixa de funcionar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) mutation.mutate({ tenant_id: confirm.tenantId, action: confirm.action });
                setConfirm(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detailTenant} onOpenChange={(o) => !o && setDetailTenant(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auditoria completa</DialogTitle>
            <DialogDescription>Histórico de eventos registrados para esta conta.</DialogDescription>
          </DialogHeader>
          {detailQ.isLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-3">
              {detailQ.data?.account && (
                <pre className="overflow-x-auto rounded bg-muted p-2 text-[11px]">
                  {JSON.stringify(detailQ.data.account, null, 2)}
                </pre>
              )}
              {(detailQ.data?.audit ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem eventos de auditoria.</p>
              ) : (
                (detailQ.data?.audit ?? []).map((a) => (
                  <div key={a.id} className="rounded-md border p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{ACTION_LABEL[a.action] ?? a.action}</Badge>
                      <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                      <span className="text-muted-foreground">IP {a.ip ?? "—"}</span>
                    </div>
                    {a.metadata && (
                      <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(a.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
