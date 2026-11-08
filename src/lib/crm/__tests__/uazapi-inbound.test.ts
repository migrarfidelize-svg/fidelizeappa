import { describe, expect, it } from "vitest";
import { uazapiOtp } from "../../integrations/otp/uazapi";

describe("UAZAPI inbound safety", () => {
  it("23. fromMe nunca retorna como inbound", () => {
    expect(uazapiOtp.parseWebhook?.({ key: { id: "m1", fromMe: true, remoteJid: "5511999999999@s.whatsapp.net" }, text: "oi" }, {})).toBeNull();
  });
  it("24. usa o provider message id real", () => {
    expect(uazapiOtp.parseWebhook?.({ key: { id: "provider-123", remoteJid: "5511999999999@s.whatsapp.net" }, text: "oi" }, {})?.remoteMessageId).toBe("provider-123");
  });
  it("25. aceita resposta interativa numerada", () => {
    expect(uazapiOtp.parseWebhook?.({ key: { id: "m2", remoteJid: "5511999999999@s.whatsapp.net" }, selectedRowId: "5" }, {})?.text).toBe("5");
  });
  it("recebe o ID de botão da UAZAPI sem depender do texto", () => {
    const payload = {
      key: { id: "button-1", remoteJid: "5511999999999@s.whatsapp.net" },
      buttonOrListid: "fidelize_support",
    };
    expect(uazapiOtp.parseWebhook?.(payload, {})?.text).toBe("fidelize_support");
  });
  it("recebe botão interativo da Cloud API", () => {
    const payload = {
      key: { id: "button-2", remoteJid: "5511999999999@s.whatsapp.net" },
      interactive: { button_reply: { id: "fidelize_plans", title: "Planos" } },
    };
    expect(uazapiOtp.parseWebhook?.(payload, {})?.text).toBe("fidelize_plans");
  });
  it("prioriza o ID nativo do botão mesmo se webhook contiver texto", () => {
    const payload = {
      key: { id: "button-3", remoteJid: "5511999999999@s.whatsapp.net" },
      text: "Mensagem de interface genérica",
      buttonOrListid: "fidelize_suggestions",
    };
    expect(uazapiOtp.parseWebhook?.(payload, {})?.text).toBe("fidelize_suggestions");
  });

  it("preserva JID LID para respostas ao remetente", () => {
    const inbound = uazapiOtp.parseWebhook?.({
      message: { messageid: "lid-reply-1", sender: "123456789012345@lid", chatid: "123456789012345@lid", text: "oi" },
    }, {});
    expect(inbound?.fromPhone).toBe("123456789012345");
    expect(inbound?.replyJid).toBe("123456789012345@lid");
  });

  it("prioriza PN resolvido em vez de interpretar LID como telefone", () => {
    const inbound = uazapiOtp.parseWebhook?.({
      message: {
        messageid: "pn-reply-1",
        sender: "123456789012345@lid",
        sender_pn: "5511999999999@s.whatsapp.net",
        chatid: "123456789012345@lid",
        text: "oi",
      },
    }, {});
    expect(inbound?.fromPhone).toBe("5511999999999");
    expect(inbound?.replyJid).toBe("5511999999999@s.whatsapp.net");
  });
  it("26. rejeita grupo", () => {
    expect(uazapiOtp.parseWebhook?.({ key: { id: "m3", remoteJid: "123@g.us" }, text: "oi" }, {})).toBeNull();
  });
});
