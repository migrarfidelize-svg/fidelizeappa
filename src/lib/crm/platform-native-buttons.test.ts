import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uazapiOtp } from "../integrations/otp/uazapi";
import { PLATFORM_SUPPORT_OPTIONS } from "./platform-support-bot.core";

const runtime = {
  enabled: true,
  config: { baseUrl: "https://teste.uazapi.example" },
  credentials_ref: {},
  db_credentials: { token: "secret-test-token" },
};

const mockResponse = (ok: boolean) => ({
  ok,
  status: ok ? 200 : 500,
  text: async () => JSON.stringify(ok ? { messageId: "m-123" } : { error: "interactive buttons not supported" }),
});
let requests: ReturnType<typeof vi.fn>;

describe("UAZAPI — menu Fidelize somente com botões", () => {
  beforeEach(() => {
    requests = vi.fn().mockResolvedValue(mockResponse(true));
    vi.stubGlobal("fetch", requests);
  });
  afterEach(() => vi.unstubAllGlobals());

  const options = {
    type: "options",
    options: PLATFORM_SUPPORT_OPTIONS,
    nativeButtonsOnly: true,
  };

  it("envia menu interativo com três botões e IDs fixos (não numerados)", async () => {
    const result = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "Escolha uma opção:", options);
    expect(result.ok).toBe(true);
    expect(requests).toHaveBeenCalledTimes(1);
    const [url, init] = requests.mock.calls[0];
    expect(url).toBe("https://teste.uazapi.example/send/menu");
    const payload = JSON.parse(init.body);
    expect(payload.type).toBe("button");
    expect(payload.choices).toEqual([
      "Suporte|fidelize_support",
      "Planos|fidelize_plans",
      "Sugestões|fidelize_suggestions",
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/responda com o número|1\\. Suporte/i);
  });

  it("se a API rejeitar botões, falha sem enviar números por texto", async () => {
    requests.mockResolvedValue(mockResponse(false));
    const result = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "Escolha uma opção:", options);
    expect(result.ok).toBe(false);
    expect(requests).toHaveBeenCalledTimes(1);
    expect(requests.mock.calls[0][0]).toContain("/send/menu");
    expect(requests.mock.calls.some(([url]) => String(url).includes("/send/text"))).toBe(false);
  });

  it("envia CTA de URL por plano e retorno como botões separados", async () => {
    const url = "https://afidelize.app/?plano=essencial#precos";
    const first = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "*Essencial*", {
      type: "options", options: [{ label: "Conhecer plano", value: url }], nativeButtonsOnly: true,
    });
    const second = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "Voltar às opções?", {
      type: "options", options: [{ label: "Voltar ao menu", value: "fidelize_menu" }], nativeButtonsOnly: true,
    });
    expect(first.ok && second.ok).toBe(true);
    expect(requests).toHaveBeenCalledTimes(2);
    expect(JSON.parse(requests.mock.calls[0][1].body).choices).toEqual(["Conhecer plano|" + url]);
    expect(JSON.parse(requests.mock.calls[1][1].body).choices).toEqual(["Voltar ao menu|fidelize_menu"]);
  });

  it("envia duas opções reais ao aguardar suporte, incluindo Encerrar atendimento", async () => {
    const result = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "Você está na fila de suporte.", {
      type: "options", nativeButtonsOnly: true,
      options: [
        { label: "Voltar ao menu", value: "fidelize_menu" },
        { label: "Encerrar atendimento", value: "fidelize_end_support" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(requests).toHaveBeenCalledTimes(1);
    const [url, init] = requests.mock.calls[0];
    expect(url).toContain("/send/menu");
    expect(JSON.parse(init.body).choices).toEqual([
      "Voltar ao menu|fidelize_menu",
      "Encerrar atendimento|fidelize_end_support",
    ]);
  });

  it("não envia listagem ou texto se opções nativas estiverem incompletas", async () => {
    const result = await uazapiOtp.sendTestMessage(runtime, {}, "5511999999999", "Escolha:", {
      ...options,
      options: [],
    });
    expect(result.ok).toBe(false);
    expect(requests).not.toHaveBeenCalled();
  });
});
