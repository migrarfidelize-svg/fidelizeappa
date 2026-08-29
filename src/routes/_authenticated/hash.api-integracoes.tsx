import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Link2 as HeroIcon, Copy, KeyRound, Trash2, ExternalLink, Activity, TrendingUp, Check } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listApiKeys, createApiKey, revokeApiKey, listApiRequestLogs, getIntegrationsStats } from "@/lib/api-keys.functions";
import { API_SCOPES, DEFAULT_API_SCOPES, API_SCOPE_LABELS, type ApiScope } from "@/lib/integrations/scopes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/states";
import { adminApiHealth, adminApiCommercial } from "@/lib/provisioning-admin.functions";
import { Link } from "@tanstack/react-router";

function codeExample(kind: "curl" | "node" | "php" | "fetch", origin: string, key: string) {
  const url = `${origin}/api/public/integrations/ping-auth`;
  if (kind === "curl") return `curl -X GET "${url}" \\\n  -H "x-api-key: ${key}"`;
  if (kind === "node")
    return `const res = await fetch("${url}", {\n  headers: { "x-api-key": "${key}" },\n});\nconsole.log(await res.json());`;
  if (kind === "fetch")
    return `fetch("${url}", { headers: { "x-api-key": "${key}" } })\n  .then((r) => r.json())\n  .then(console.log);`;
  return `<?php\n$ch = curl_init("${url}");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: ${key}"]);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;`;
}

function pct(n: number) {
  return `${n.toFixed(1).replace(".", ",")}%`;
}
function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export const Route = createFileRoute("/_authenticated/hash/api-integracoes")({
  head: () => ({
    meta: [
      { title: "API de integrações — Fidelize" },
      { name: "description", content: "Gere chaves de API, acompanhe requisições e integre sistemas externos ao Fidelize." },
      { property: "og:title", content: "API de integrações — Fidelize" },
      { property: "og:description", content: "Chaves de API, limites de uso e logs de auditoria da integração externa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiPage,
});

function ApiPage() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const logs = useServerFn(listApiRequestLogs);
  const stats = useServerFn(getIntegrationsStats);
  const health = useServerFn(adminApiHealth);
  const commercial = useServerFn(adminApiCommercial);


  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [name, setName] = useState("");
  const [rate, setRate] = useState("120");
  const [origins, setOrigins] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [scopes, setScopes] = useState<ApiScope[]>([...DEFAULT_API_SCOPES]);
  const [sandbox, setSandbox] = useState(false);
  const [keyType, setKeyType] = useState<"browser" | "server">("browser");

  const [fDays, setFDays] = useState("7");
  const [fEndpoint, setFEndpoint] = useState("");
  const [fStatus, setFStatus] = useState<"all" | "success" | "client_error" | "server_error">("all");
  const [fKey, setFKey] = useState<string>("");

  const keysQ = useQuery({
    queryKey: ["api-keys", est?.id],
    queryFn: () => list({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });
  const logsQ = useQuery({
    queryKey: ["api-logs", est?.id, fDays, fEndpoint, fStatus, fKey],
    queryFn: () =>
      logs({
        data: {
          establishment_id: est!.id,
          days: Number(fDays) || 7,
          status: fStatus,
          ...(fEndpoint.trim() ? { endpoint: fEndpoint.trim() } : {}),
          ...(fKey ? { api_key_id: fKey } : {}),
        },
      }),
    enabled: !!est?.id,
  });
  const statsQ = useQuery({
    queryKey: ["api-stats", est?.id],
    queryFn: () => stats({ data: { establishment_id: est!.id } }),
    enabled: !!est?.id,
  });

  const healthQ = useQuery({ queryKey: ["api-health"], queryFn: () => health(), refetchInterval: 60_000 });
  const [commDays, setCommDays] = useState(30);
  const commQ = useQuery({ queryKey: ["api-commercial", commDays], queryFn: () => commercial({ data: { days: commDays } }) });

  const docsUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/integrations/docs` : "";

  async function handleCreate() {
    if (!est?.id) return;
    if (name.trim().length < 2) return toast.error("Informe um nome para a chave.");
    setSaving(true);
    try {
      const res = await create({
        data: {
          establishment_id: est.id,
          name: name.trim(),
          rate_limit_per_minute: Math.max(10, Math.min(6000, Number(rate) || 120)),
          allowed_origins: origins.split(",").map((o) => o.trim()).filter(Boolean),
          scopes,
          sandbox,
          key_type: keyType,
        },
      });
      setSecret(res.secret);
      setName("");
      setOrigins("");
      qc.invalidateQueries({ queryKey: ["api-keys", est.id] });
      toast.success("Chave criada. Copie agora — ela não será exibida novamente.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar a chave.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!est?.id) return;
    try {
      await revoke({ data: { establishment_id: est.id, id } });
      qc.invalidateQueries({ queryKey: ["api-keys", est.id] });
      toast.success("Chave revogada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        title="API de integrações"
        subtitle="Conecte sistemas externos ao Fidelize com chaves de API seguras, limite de requisições e auditoria."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Nova chave de API
          </CardTitle>
          <CardDescription>A chave completa aparece apenas uma vez, no momento da criação.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="key-name">Nome</Label>
              <Input id="key-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ERP da loja" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-rate">Limite por minuto</Label>
              <Input id="key-rate" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-origins">Origens permitidas (opcional)</Label>
              <Input
                id="key-origins"
                value={origins}
                onChange={(e) => setOrigins(e.target.value)}
                placeholder="https://meusistema.com, 200.10.1.5"
                disabled={keyType === "server"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo da chave</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={keyType === "browser" ? "default" : "outline"}
                onClick={() => setKeyType("browser")}
              >
                Browser
              </Button>
              <Button
                type="button"
                size="sm"
                variant={keyType === "server" ? "default" : "outline"}
                onClick={() => setKeyType("server")}
              >
                Server-to-Server
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {keyType === "server"
                ? "Autentica apenas por API Key, escopos e limite de requisições — a origem não é validada."
                : "Valida Origin/Referer da requisição contra a lista de origens permitidas."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Escopos da chave</Label>
            <div className="flex flex-wrap gap-2">
              {API_SCOPES.map((s) => {
                const active = scopes.includes(s);
                return (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() =>
                      setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                    }
                  >
                    {API_SCOPE_LABELS[s]}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              O escopo <code>provisioning</code> exige permissão de super admin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant={sandbox ? "default" : "outline"} onClick={() => setSandbox((v) => !v)}>
              Sandbox {sandbox ? "ativado" : "desativado"}
            </Button>
            <span className="text-xs text-muted-foreground">Chamadas sandbox não alteram dados reais.</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreate} disabled={saving || !est?.id}>
              {saving ? "Gerando..." : "Gerar chave"}
            </Button>
            {docsUrl && (
              <a href={docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm underline">
                Documentação Swagger <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Link to="/hash/api-auditoria" className="text-sm underline">
              Auditoria avançada da API
            </Link>
          </div>

          {secret && (
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Copie sua chave agora:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{secret}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                    toast.success("Chave copiada.");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas</CardTitle>
          <CardDescription>Uso das integrações nos últimos 30 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          {statsQ.isLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Chaves ativas", statsQ.data?.keys_active ?? 0],
                  ["Requisições (30d)", statsQ.data?.requests_30d ?? 0],
                  ["Falhas (30d)", statsQ.data?.failures_30d ?? 0],
                  ["Contas via API", statsQ.data?.accounts_provisioned ?? 0],
                  ["Chaves sandbox", statsQ.data?.keys_sandbox ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="metric-number text-2xl">{String(value)}</p>
                  </div>
                ))}
              </div>

              {Object.keys(statsQ.data?.provisions_by_plan ?? {}).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statsQ.data?.provisions_by_plan ?? {}).map(([plan, total]) => (
                    <Badge key={plan} variant="secondary">
                      {plan}: {String(total)}
                    </Badge>
                  ))}
                </div>
              )}

              {(statsQ.data?.recent_provisions ?? []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Últimos provisionamentos</p>
                  {(statsQ.data?.recent_provisions ?? []).map((p: any) => (
                    <p key={p.id} className="text-xs text-muted-foreground break-all">
                      {new Date(p.created_at).toLocaleString("pt-BR")} · {p.plan ?? "—"} · {p.email ?? p.tenant_id}
                      {p.source ? ` · origem ${p.source}` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Saúde da integração</CardTitle>
          <CardDescription>Disponibilidade, autenticação e desempenho da API de integrações.</CardDescription>
        </CardHeader>
        <CardContent>
          {healthQ.isLoading || !healthQ.data ? (
            <LoadingSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [healthQ.data.online, "API online"],
                  [healthQ.data.auth_ok, "Autenticação válida"],
                  [healthQ.data.provisioning_ok, "Provisionamento operacional"],
                  [healthQ.data.sandbox_keys > 0, `Sandbox (${healthQ.data.sandbox_keys} chave(s))`],
                  [!!healthQ.data.last_call_at, `Última chamada: ${healthQ.data.last_call_at ? new Date(healthQ.data.last_call_at).toLocaleString("pt-BR") : "—"}`],
                  [healthQ.data.avg_response_ms != null, `Tempo médio: ${healthQ.data.avg_response_ms ?? "—"} ms`],
                ].map(([ok, label]) => (
                  <div key={String(label)} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <Badge variant={ok ? "default" : "secondary"}>{ok ? "OK" : "—"}</Badge>
                    <span className="text-muted-foreground">{String(label)}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["Requisições 24h", healthQ.data.requests_24h],
                  ["Requisições 7 dias", healthQ.data.requests_7d],
                  ["Erros 24h", healthQ.data.errors_24h],
                  ["Erros 7 dias", healthQ.data.errors_7d],
                  ["Tempo médio 24h", healthQ.data.avg_response_ms_24h != null ? `${healthQ.data.avg_response_ms_24h} ms` : "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{String(label)}</p>
                    <p className="metric-number text-2xl">{String(value)}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground break-all">
                Último erro:{" "}
                {healthQ.data.last_error
                  ? `${healthQ.data.last_error.method} ${healthQ.data.last_error.path} · ${healthQ.data.last_error.status_code} ${healthQ.data.last_error.error_code ?? ""} · ${new Date(healthQ.data.last_error.created_at).toLocaleString("pt-BR")}`
                  : "nenhum registrado"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Dashboard comercial da API</CardTitle>
          <CardDescription>Receita estimada por plano, origens de provisionamento e evolução temporal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex gap-2">
            {[30, 90].map((d) => (
              <Button key={d} size="sm" variant={commDays === d ? "default" : "outline"} onClick={() => setCommDays(d)}>
                Últimos {d} dias
              </Button>
            ))}
          </div>

          {commQ.isLoading || !commQ.data ? (
            <LoadingSkeleton />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {commQ.data.by_plan.map((p) => (
                  <div key={p.plan} className="rounded-md border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.plan}</p>
                    <p className="metric-number text-2xl">{p.accounts} contas</p>
                    <p className="text-xs text-muted-foreground">
                      {pct(p.percent)} do total · {brl(p.revenue)} /mês
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                Receita estimada total: <span className="metric-number">{brl(commQ.data.revenue_total)}</span>
              </p>

              <div className="space-y-2">
                <p className="text-sm font-medium">Origens de provisionamento</p>
                {commQ.data.by_source.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma origem registrada.</p>
                ) : (
                  commQ.data.by_source.map((s) => (
                    <div key={s.source} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span className="capitalize">{s.source}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.count} · {pct(s.percent)} · evolução {s.trend >= 0 ? "+" : ""}{pct(s.trend)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Provisionamentos por dia</p>
                <div className="flex h-24 items-end gap-[2px]">
                  {commQ.data.series.map((d) => {
                    const max = Math.max(1, ...commQ.data!.series.map((x) => x.count));
                    return (
                      <div
                        key={d.date}
                        title={`${new Date(d.date).toLocaleDateString("pt-BR")}: ${d.count}`}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${Math.max(2, (d.count / max) * 100)}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chaves ativas</CardTitle>
          <CardDescription>Envie a chave no cabeçalho <code>x-api-key</code>.</CardDescription>
        </CardHeader>
        <CardContent>
          {keysQ.isLoading ? (
            <LoadingSkeleton />
          ) : (keysQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chave criada ainda.</p>
          ) : (
            <div className="space-y-2">
              {(keysQ.data ?? []).map((k: any) => (
                <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {k.name} <span className="text-muted-foreground">· fdz_{k.prefix}_••••</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(k.scopes ?? []).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          <Check className="mr-1 h-3 w-3" />
                          {API_SCOPE_LABELS[s as ApiScope] ?? s}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      criada em {new Date(k.created_at).toLocaleDateString("pt-BR")} · {k.rate_limit_per_minute} req/min ·{" "}
                      {k.requests_total ?? 0} requisições ·{" "}
                      {k.key_type === "server"
                        ? "sem validação de origem"
                        : k.allowed_origins?.length
                          ? `origens: ${k.allowed_origins.join(", ")}`
                          : "todas as origens"} ·{" "}
                      {k.last_used_at ? `último uso ${new Date(k.last_used_at).toLocaleString("pt-BR")}` : "nunca usada"}
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      último IP {k.last_ip ?? "—"} · último endpoint {k.last_endpoint ?? "—"}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {([
                        ["curl", "CURL"],
                        ["node", "Node.js"],
                        ["php", "PHP"],
                        ["fetch", "JS Fetch"],
                      ] as const).map(([kind, label]) => (
                        <Button
                          key={kind}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            const origin = typeof window !== "undefined" ? window.location.origin : "";
                            navigator.clipboard.writeText(codeExample(kind, origin, `fdz_${k.prefix}_SUA_CHAVE`));
                            toast.success(`Exemplo ${label} copiado.`);
                          }}
                        >
                          Copiar {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{k.key_type === "server" ? "Server-to-Server" : "Browser"}</Badge>
                    {k.sandbox && <Badge variant="outline">Sandbox</Badge>}
                    {k.revoked_at ? (
                      <Badge variant="secondary">Revogada</Badge>
                    ) : (
                      <>
                        <Badge>Ativa</Badge>
                        <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logs de requisições</CardTitle>
          <CardDescription>Registros imutáveis com método, rota, IP, origem, status, tempo e chave utilizada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="f-days">Período (dias)</Label>
              <Input id="f-days" value={fDays} onChange={(e) => setFDays(e.target.value)} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-endpoint">Endpoint</Label>
              <Input id="f-endpoint" value={fEndpoint} onChange={(e) => setFEndpoint(e.target.value)} placeholder="/customer" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-status">Status</Label>
              <select
                id="f-status"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value as typeof fStatus)}
              >
                <option value="all">Todos</option>
                <option value="success">Sucesso (2xx/3xx)</option>
                <option value="client_error">Erro do cliente (4xx)</option>
                <option value="server_error">Erro do servidor (5xx)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-key">Chave</Label>
              <select
                id="f-key"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={fKey}
                onChange={(e) => setFKey(e.target.value)}
              >
                <option value="">Todas</option>
                {(keysQ.data ?? []).map((k: any) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {logsQ.isLoading ? (
            <LoadingSkeleton />
          ) : (logsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma requisição registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Quando</th>
                    <th className="py-2 pr-3">Método</th>
                    <th className="py-2 pr-3">Rota</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Tempo</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Origem</th>
                    <th className="py-2 pr-3">Chave</th>
                  </tr>
                </thead>
                <tbody>
                  {(logsQ.data ?? []).map((l: any) => (
                    <tr key={l.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                      <td className="py-2 pr-3">{l.method}</td>
                      <td className="py-2 pr-3 break-all">{l.path}</td>
                      <td className="py-2 pr-3">{l.status_code}</td>
                      <td className="py-2 pr-3">{l.duration_ms != null ? `${l.duration_ms} ms` : "—"}</td>
                      <td className="py-2 pr-3">{l.ip ?? "—"}</td>
                      <td className="py-2 pr-3 break-all">{l.origin ?? "—"}</td>
                      <td className="py-2 pr-3">{l.key_prefix ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
