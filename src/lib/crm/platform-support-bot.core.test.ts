import { describe, expect, it } from "vitest";
import { formatPlatformPlans, platformSupportMode, resolvePlatformSupportChoice, PLATFORM_SUPPORT_OPTIONS, SUPPORT_NO_PLANS_TEXT } from "./platform-support-bot.core";

describe("Atendimento institucional de baixo custo", () => {
  it("apresenta exatamente 3 botões com IDs estáveis", () => {
    expect(PLATFORM_SUPPORT_OPTIONS).toHaveLength(3);
    expect(PLATFORM_SUPPORT_OPTIONS.map((x) => x.label)).toEqual(["Suporte", "Planos", "Sugestões"]);
    expect(PLATFORM_SUPPORT_OPTIONS.every((x) => x.label.length <= 20)).toBe(true);
  });

  it.each([
    ["fidelize_support","support"],["Suporte","support"],
    ["fidelize_plans","plans"],["Planos","plans"],
    ["fidelize_suggestions","suggestions"],["Sugestões","suggestions"],
    ["menu","menu"],["voltar","menu"],
  ] as const)("normaliza botão e fallback %s", (input, expected) => {
    expect(resolvePlatformSupportChoice(input)).toBe(expected);
  });

  it("não trata toda mensagem livre como acionamento do suporte", () => {
    expect(resolvePlatformSupportChoice("Bom dia, queria ajuda")).toBeNull();
    expect(resolvePlatformSupportChoice("1")).toBeNull();
    expect(resolvePlatformSupportChoice("2")).toBeNull();
    expect(resolvePlatformSupportChoice("3")).toBeNull();
  });

  it("modo econômico é padrão; IA só é ativada explicitamente", () => {
    expect(platformSupportMode(undefined)).toBe("bot");
    expect(platformSupportMode("bot")).toBe("bot");
    expect(platformSupportMode("ai")).toBe("ai");
  });

  it("apresenta preços recebidos do banco e não oferece valores inventados", () => {
    const text = formatPlatformPlans([
      { name: "Plano Teste", price_monthly: "32.90", price_yearly: "329.00", currency: "BRL", description: "Para testar" },
      { name: "Sob consulta", price_monthly: null, price_yearly: null },
    ]);
    expect(text).toContain("R$ 32,90");
    expect(text).toContain("Anual:");
    expect(text).toContain("Valor sob consulta");
    expect(text).not.toContain("119,90");
    expect(formatPlatformPlans([])).toBe(SUPPORT_NO_PLANS_TEXT);
  });
});
