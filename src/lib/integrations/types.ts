// Tipos base para todas as integrações (IA, pagamentos, e futuros).
// Contrato mínimo para adicionar novos provedores via padrão Strategy.

export type IntegrationCategory = "ai" | "payments" | "marketing" | "otp";

export type IntegrationFieldKind =
  | "text"
  | "password"
  | "secret"       // valor vive em process.env / Supabase secrets; UI mostra apenas o nome
  | "url"
  | "number"
  | "select";

export interface IntegrationField {
  name: string;                 // chave em config OU nome do secret quando kind === "secret"
  label: string;
  kind: IntegrationFieldKind;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[]; // para kind === "select"
  defaultValue?: string | number;
  secretName?: string;          // usado por kind === "secret" — nome do env var
}

export interface TestConnectionResult {
  ok: boolean;
  status?: number;              // HTTP status
  latency_ms?: number;
  message: string;              // mensagem crua da API — nunca ocultar
  details?: Record<string, string | number | boolean | null>;
}

export interface IntegrationRuntimeConfig {
  enabled: boolean;
  mode?: "sandbox" | "production" | null;
  config: Record<string, unknown>;
  credentials_ref: Record<string, string>; // { field_name: SECRET_ENV_NAME }
  db_credentials?: Record<string, string>; // Credenciais descriptografadas do DB
}

export interface IntegrationProviderMeta {
  id: string;                   // "openai", "mercadopago", ...
  label: string;                // "OpenAI"
  category: IntegrationCategory;
  description: string;
  icon?: string;                // nome opcional (lucide) ou emoji
  docsUrl?: string;
  supportsMode?: boolean;       // habilita seletor sandbox/produção
  fields: IntegrationField[];
}

export interface IntegrationProvider {
  meta: IntegrationProviderMeta;
  /**
   * Executa uma chamada real na API do provedor para validar credenciais.
   * NUNCA silenciar erros. Retornar sempre com mensagem crua.
   */
  testConnection(runtime: IntegrationRuntimeConfig, env: NodeEnv): Promise<TestConnectionResult>;
}

/** Subset de process.env usado nos providers, para permitir stub em testes. */
export type NodeEnv = Record<string, string | undefined>;

/** Helper compartilhado para chamadas HTTP com timeout + medição de latência. */
export async function timedFetch(
  input: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ response: Response; body: string; latency_ms: number }> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  // Alguns provedores (ex.: Asaas) recusam requisições sem User-Agent.
  const headers = new Headers(rest.headers as HeadersInit | undefined);
  if (!headers.has("user-agent")) {
    headers.set("User-Agent", "Fidelize/1.0 (+https://afidelize.app)");
  }
  try {
    const response = await fetch(input, { ...rest, headers, signal: controller.signal });

    const body = await response.text();
    return { response, body, latency_ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}
