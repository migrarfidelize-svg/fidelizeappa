import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ShieldCheck as HeroIcon } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminApiAuditLogs } from "@/lib/provisioning-admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/hash/api-auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria da API — Fidelize Admin" },
      { name: "description", content: "Auditoria avançada das chamadas da API de integrações com filtros por chave, origem, endpoint, status e período." },
      { property: "og:title", content: "Auditoria da API — Fidelize Admin" },
      { property: "og:description", content: "Rastreabilidade completa das requisições recebidas pela API de integrações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiAuditoria,
});

type StatusOpt = "all" | "success" | "client_error" | "server_error";

function ApiAuditoria() {
  const fetchLogs = useServerFn(adminApiAuditLogs);

  const [days, setDays] = useState("7");
  const [endpoint, setEndpoint] = useState("");
  const [origin, setOrigin] = useState("");
  const [apiKeyId, setApiKeyId] = useState("");
  const [status, setStatus] = useState<StatusOpt>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["api-audit", days, endpoint, origin, apiKeyId, status, page],
    queryFn: () =>
      fetchLogs({
        data: {
          days: Math.max(1, Math.min(180, Number(days) || 7)),
          status,
          page,
          page_size: pageSize,
          ...(endpoint.trim() ? { endpoint: endpoint.trim() } : {}),
          ...(origin.trim() ? { origin: origin.trim() } : {}),
          ...(apiKeyId ? { api_key_id: apiKeyId } : {}),
        },
      }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow="Super Admin · Integrações"
        title="Auditoria avançada da API"
        subtitle="Rastreie cada chamada recebida: chave, origem, endpoint, status, IP e tempo de resposta."
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Refine por chave, origem, endpoint, status HTTP e período.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="a-days">Período (dias)</Label>
            <Input id="a-days" value={days} onChange={(e) => { setDays(e.target.value); setPage(1); }} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-endpoint">Endpoint</Label>
            <Input id="a-endpoint" value={endpoint} onChange={(e) => { setEndpoint(e.target.value); setPage(1); }} placeholder="/customer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-origin">Origem</Label>
            <Input id="a-origin" value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-status">Status</Label>
            <select
              id="a-status"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => { setStatus(e.target.value as StatusOpt); setPage(1); }}
            >
              <option value="all">Todos</option>
              <option value="success">Sucesso (2xx/3xx)</option>
              <option value="client_error">Erro do cliente (4xx)</option>
              <option value="server_error">Erro do servidor (5xx)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-key">Chave</Label>
            <select
              id="a-key"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={apiKeyId}
              onChange={(e) => { setApiKeyId(e.target.value); setPage(1); }}
            >
              <option value="">Todas</option>
              {(data?.keys ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chamadas registradas</CardTitle>
          <CardDescription>{data?.total ?? 0} registro(s) no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <LoadingSkeleton variant="table" rows={8} />
          ) : (data?.rows ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma requisição encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Horário</th>
                    <th className="py-2 pr-3">Método</th>
                    <th className="py-2 pr-3">Endpoint</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">Tempo</th>
                    <th className="py-2 pr-3">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows ?? []).map((r) => {
                    const code = r.status_code ?? 0;
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                        <td className="py-2 pr-3">{r.method ?? "—"}</td>
                        <td className="py-2 pr-3 break-all">{r.path ?? "—"}</td>
                        <td className="py-2 pr-3 break-all">{r.ip ?? "—"}</td>
                        <td className="py-2 pr-3 break-all">{r.origin ?? "—"}</td>
                        <td className="py-2 pr-3">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={code < 400 ? "default" : code < 500 ? "secondary" : "outline"}>
                            {code} {r.error_code ?? ""}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
