import type { PaymentProvider } from "./base";
import { paymentFields } from "./base";
import { timedFetch } from "../types";

export const asaasProvider: PaymentProvider = {
  meta: {
    id: "asaas",
    label: "Asaas",
    category: "payments",
    description: "Boleto, PIX, cartão e assinaturas. Ativação sob demanda.",
    icon: "🏦",
    docsUrl: "https://docs.asaas.com",
    supportsMode: true,
    fields: paymentFields({ accessTokenSecret: "ASAAS_ACCESS_TOKEN" }),
  },
  async testConnection(runtime, env) {
    const token = env[runtime.credentials_ref.access_token ?? "ASAAS_ACCESS_TOKEN"];
    if (!token) return { ok: false, message: "ASAAS_ACCESS_TOKEN não configurado." };
    const base = runtime.mode === "sandbox" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com";
    try {
      const { response, body, latency_ms } = await timedFetch(`${base}/v3/myAccount`, {
        headers: {
          access_token: token,
          accept: "application/json",
          // Asaas exige User-Agent no cabeçalho (erro user_agent_not_informed).
          "User-Agent": "Fidelize/1.0 (+https://afidelize.app)",
        },
      });

      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso ao Asaas." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
