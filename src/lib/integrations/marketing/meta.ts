import { timedFetch } from "../types";
import type { IntegrationProvider, IntegrationProviderMeta, NodeEnv, TestConnectionResult } from "../types";

export type MarketingProviderMeta = IntegrationProviderMeta & { category: "marketing" };
export type MarketingProvider = IntegrationProvider & { meta: MarketingProviderMeta };

/** Pixel ID do Meta: apenas dígitos (14 a 17). Usado para bloquear injeção no snippet. */
export const META_PIXEL_ID_RE = /^\d{14,17}$/;
/** Código de teste do Events Manager: TEST12345 */
const TEST_EVENT_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

const DEFAULT_VERSION = "v21.0";

function graphVersion(config: Record<string, unknown>): string {
  const raw = String(config.api_version ?? "").trim();
  return /^v\d{1,2}\.\d{1,2}$/.test(raw) ? raw : DEFAULT_VERSION;
}

export const metaPixelProvider: MarketingProvider = {
  meta: {
    id: "meta_pixel",
    label: "Meta Pixel + Conversions API",
    category: "marketing",
    description:
      "Rastreamento de páginas públicas (Pixel) e envio de eventos server-side pela Conversions API do Facebook/Instagram.",
    docsUrl: "https://developers.facebook.com/docs/marketing-api/conversions-api",
    supportsMode: false,
    fields: [
      {
        name: "pixel_id",
        label: "Pixel ID (Dataset ID)",
        kind: "text",
        required: true,
        placeholder: "1234567890123456",
        helpText: "Somente números. Events Manager → Fontes de dados → seu Pixel → ID do conjunto de dados.",
      },
      {
        name: "api_version",
        label: "Versão da Graph API",
        kind: "text",
        defaultValue: DEFAULT_VERSION,
        placeholder: DEFAULT_VERSION,
        helpText: "Formato vXX.X. Deixe o padrão se não tiver um motivo específico.",
      },
      {
        name: "test_event_code",
        label: "Código de teste (opcional)",
        kind: "text",
        placeholder: "TEST12345",
        helpText: "Events Manager → Testar eventos. Se preenchido, o teste envia um PageView real para essa aba.",
      },
      {
        name: "track_public_pages",
        label: "Rastrear páginas públicas",
        kind: "select",
        defaultValue: "1",
        options: [
          { value: "1", label: "Sim — carregar o Pixel no site público" },
          { value: "0", label: "Não — apenas Conversions API (server-side)" },
        ],
        helpText: "O Pixel nunca é carregado em páginas autenticadas do painel.",
      },
      {
        name: "access_token",
        label: "Token de acesso (Conversions API)",
        kind: "secret",
        required: true,
        secretName: "META_CAPI_TOKEN",
        helpText:
          "Events Manager → Configurações → Conversions API → Gerar token de acesso. Guardado apenas no backend, nunca exposto ao navegador.",
      },
    ],
  },

  async testConnection(runtime, env: NodeEnv): Promise<TestConnectionResult> {
    const config = runtime.config ?? {};
    const pixelId = String(config.pixel_id ?? "").trim();
    const version = graphVersion(config);
    const tokenEnv = runtime.credentials_ref.access_token ?? "META_CAPI_TOKEN";
    const token = env[tokenEnv];

    if (!pixelId) {
      return { ok: false, message: "Informe o Pixel ID na aba Configuração antes de testar." };
    }
    if (!META_PIXEL_ID_RE.test(pixelId)) {
      return { ok: false, message: `Pixel ID inválido: "${pixelId}". Deve conter apenas dígitos (14 a 17).` };
    }
    if (!token) {
      return { ok: false, message: "Token de acesso ausente. Salve-o na aba Credenciais." };
    }

    const testCode = String(config.test_event_code ?? "").trim();
    if (testCode && !TEST_EVENT_CODE_RE.test(testCode)) {
      return { ok: false, message: `Código de teste inválido: "${testCode}".` };
    }

    // 1) Valida token + Pixel lendo o dataset (só id,name — owner_business exige permissão extra).
    const endpoint = `https://graph.facebook.com/${version}/${pixelId}?fields=id,name`;
    let latency = 0;
    try {
      const { response, body, latency_ms } = await timedFetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 15_000,
      });
      latency = latency_ms;
      const json = safeJson(body);

      let pixelName = "sem nome";
      let readOnly = false;

      if (!response.ok) {
        const err = json?.error ?? {};
        const code = Number(err.code ?? 0);
        const sub = Number(err.error_subcode ?? 0);
        const permissionIssue = code === 100 || code === 200 || code === 10 || code === 278 || sub === 33;

        // Tokens de Conversions API costumam poder ENVIAR eventos sem poder LER o dataset.
        // Nesse caso validamos disparando um evento real em vez de falhar.
        if (!permissionIssue) {
          return {
            ok: false,
            status: response.status,
            latency_ms,
            message: `${err.type ?? "Erro"} (${err.code ?? response.status}): ${err.message ?? body.slice(0, 300)}`,
            details: { endpoint, pixel_id: pixelId, api_version: version },
          };
        }

        const probe = await sendTestEvent(version, pixelId, token, testCode || undefined);
        if (!probe.ok) {
          return {
            ok: false,
            status: probe.status ?? response.status,
            latency_ms: latency_ms + probe.latency_ms,
            message:
              `${err.type ?? "Erro"} (${err.code ?? response.status}): ${err.message ?? "Missing Permission"} — ` +
              `o envio de evento também falhou: ${probe.message}. ` +
              `Gere o token em Events Manager → Configurações → Conversions API do MESMO conjunto de dados ${pixelId}, ` +
              `com o usuário sendo administrador do Pixel.`,
            details: { endpoint, pixel_id: pixelId, api_version: version, fallback: "capi_event" },
          };
        }

        readOnly = true;
        return {
          ok: true,
          status: probe.status,
          latency_ms: latency_ms + probe.latency_ms,
          message:
            `Conexão validada pelo envio de evento (${probe.received} evento(s) aceitos)${testCode ? ` em ${testCode}` : ""}. ` +
            `O token não tem permissão de leitura do dataset (#${err.code ?? 100}), mas envia eventos normalmente.`,
          details: {
            endpoint,
            pixel_id: pixelId,
            api_version: version,
            validated_via: "conversions_api_event",
            dataset_read: false,
          },
        };
      }

      pixelName = String(json?.name ?? "sem nome");
      void readOnly;

      // 2) Opcional: dispara um PageView de teste na Conversions API.
      if (testCode) {
        const evt = await sendTestEvent(version, pixelId, token, testCode);
        return {
          ok: evt.ok,
          status: evt.status,
          latency_ms: latency_ms + evt.latency_ms,
          message: evt.ok
            ? `Pixel "${pixelName}" (${pixelId}) validado · PageView de teste aceito (${evt.received} evento(s)) em ${testCode}.`
            : `Pixel "${pixelName}" validado, mas o evento de teste falhou: ${evt.message}`,
          details: { endpoint, pixel_id: pixelId, api_version: version, pixel_name: pixelName, test_event_code: testCode },
        };
      }

      return {
        ok: true,
        status: response.status,
        latency_ms,
        message: `Conectado ao Pixel "${pixelName}" (${pixelId}).`,
        details: { endpoint, pixel_id: pixelId, api_version: version, pixel_name: pixelName },
      };
    } catch (e: any) {
      return {
        ok: false,
        latency_ms: latency,
        message: e?.name === "AbortError" ? "Timeout ao contatar a Graph API do Meta." : String(e?.message ?? e),
        details: { endpoint, pixel_id: pixelId, api_version: version },
      };
    }
  },
};

async function sendTestEvent(version: string, pixelId: string, token: string, testCode?: string) {
  const url = `https://graph.facebook.com/${version}/${pixelId}/events`;
  const payload = {
    data: [
      {
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: "https://afidelize.app/",
        user_data: {
          // hash fixo de teste (sha256 de "teste@fidelize.app") — nenhum dado real de usuário.
          em: ["6a1f0a3c9fbb1a8d94b0a2f2f4b1f5f2f3b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5"],
        },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
  try {
    const { response, body, latency_ms } = await timedFetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 15_000,
    });
    const json = safeJson(body);
    if (!response.ok) {
      const err = json?.error ?? {};
      return { ok: false, status: response.status, latency_ms, received: 0, message: `${err.message ?? body.slice(0, 300)}` };
    }
    return { ok: true, status: response.status, latency_ms, received: Number(json?.events_received ?? 0), message: "ok" };
  } catch (e: any) {
    return { ok: false, status: undefined, latency_ms: 0, received: 0, message: String(e?.message ?? e) };
  }
}

function safeJson(body: string): any {
  try { return JSON.parse(body); } catch { return null; }
}
