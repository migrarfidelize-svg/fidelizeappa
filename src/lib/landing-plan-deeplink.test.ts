import { describe, expect, it } from "vitest";
import { getLandingPlanIndex, LANDING_PLAN_SLUGS } from "./landing-plan-deeplink";

describe("Landing Fidelize — seleção de plano via WhatsApp", () => {
  it.each([
    ["essencial", 0],
    ["profissional", 1],
    ["ilimitado", 2],
    ["premium", 2],
    ["empresarial", 3],
  ])("seleciona ?plano=%s no card correto", (slug, index) => {
    expect(getLandingPlanIndex(`?plano=${slug}`)).toBe(index);
    expect(LANDING_PLAN_SLUGS[index]).toBe(slug === "premium" ? "ilimitado" : slug);
  });

  it("aceita parâmetros adicionais da campanha sem perder o plano", () => {
    expect(getLandingPlanIndex("?utm_source=whatsapp&plano=essencial#precos")).toBe(0);
    expect(getLandingPlanIndex("?plano=EMPRESARIAL&utm_medium=cta")).toBe(3);
  });

  it("não força o Profissional quando o parâmetro estiver vazio ou inválido", () => {
    expect(getLandingPlanIndex("")).toBeNull();
    expect(getLandingPlanIndex("?plano=")).toBeNull();
    expect(getLandingPlanIndex("?plano=inexistente")).toBeNull();
  });
});
