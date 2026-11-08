import { describe, expect, it } from "vitest";
import {
  BIO_COMMERCE_NICHES,
  BIO_COMMERCE_PRESETS,
  getBioCommercePreset,
} from "./bio-commerce-theme";

describe("Bio Commerce V4 - biblioteca opt-in", () => {
  it("oferece tres direcoes por nicho sem duplicar IDs", () => {
    const ids = BIO_COMMERCE_PRESETS.map((item) => item.preset_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BIO_COMMERCE_PRESETS).toHaveLength(27);
    for (const niche of BIO_COMMERCE_NICHES) {
      expect(BIO_COMMERCE_PRESETS.filter((theme) => theme.niche_id === niche.id)).toHaveLength(3);
    }
  });

  it("mantem a escolha de temas anteriores e nao ativa V4 automaticamente", () => {
    expect(BIO_COMMERCE_NICHES.find((n) => n.id === "beauty")?.default_preset)
      .toBe("beauty-glass");
    expect(BIO_COMMERCE_NICHES.find((n) => n.id === "food")?.default_preset)
      .toBe("aurora-commerce");
    expect(getBioCommercePreset("beauty-glass")?.preset_id).toBe("beauty-glass");
  });

  it("V4 inclui composicoes diferentes de hero e produtos", () => {
    const v4 = BIO_COMMERCE_PRESETS.filter((item) => item.preset_id.startsWith("v4-"));
    expect(v4).toHaveLength(17);
    expect(new Set(v4.map((x) => x.hero_style)).size).toBeGreaterThan(1);
    expect(new Set(v4.map((x) => x.product_style))).toEqual(new Set(["grid", "editorial"]));
    expect(v4.some((theme) => theme.hero_style === "split")).toBe(true);
    expect(v4.some((theme) => theme.hero_style === "minimal")).toBe(true);
    expect(v4.some((theme) => theme.hero_style === "brand")).toBe(true);
  });
});
