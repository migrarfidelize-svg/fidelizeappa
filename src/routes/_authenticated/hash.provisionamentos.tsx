import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ServerCog as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminProvisioningOverview } from "@/lib/provisioning-admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/hash/provisionamentos")({
  head: () => ({
    meta: [
      { title: "Provisionamentos — Fidelize Admin" },
      { name: "description", content: "Acompanhe contas criadas via API: ativas, suspensas, com erro e o último provisionamento." },
      { property: "og:title", content: "Provisionamentos — Fidelize Admin" },
      { property: "og:description", content: "Painel de contas provisionadas pela API de integrações." },
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

function AdminProvisionamentos() {
  const fetchOverview = useServerFn(adminProvisioningOverview);
  const { data, isLoading } = useQuery({ queryKey: ["admin-provisioning"], queryFn: () => fetchOverview() });

  if (isLoading || !data) return <LoadingSkeleton variant="page" />;

  const cards: Array<[string, number | string]> = [
    ["Criadas hoje", data.created_today],
    ["Contas ativas", data.active],
    ["Contas suspensas", data.suspended],
    ["Contas com erro", data.errored],
    ["Total provisionado", data.total],
  ];

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow="Super Admin · Provisionamentos"
        title="Provisionamentos via API"
        subtitle="Contas criadas por integrações externas, com status, planos e auditoria completa."
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
          <CardDescription>Últimas 100 contas criadas via API.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta provisionada.</p>
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
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
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
              {data.events.map((e) => (
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
    </div>
  );
}
