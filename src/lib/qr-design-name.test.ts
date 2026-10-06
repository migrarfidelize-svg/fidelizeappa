import { describe, it, expect } from "vitest";
import { buildDefaultDesignName, QR_DEST_LABEL } from "./qr-design-name";

describe("buildDefaultDesignName", () => {
  it("uses destination label as the base name", () => {
    expect(QR_DEST_LABEL.reviews).toBe("Avaliação");
    expect(QR_DEST_LABEL.landing).toBe("Cartão Fidelidade");
    expect(QR_DEST_LABEL.linktree).toBe("Bio Commerce");
  });

  it("starts at 1 when there are no existing designs", () => {
    expect(buildDefaultDesignName("reviews")).toBe("Avaliação 1");
    expect(buildDefaultDesignName("landing", [], [])).toBe("Cartão Fidelidade 1");
    expect(buildDefaultDesignName("linktree", null, null)).toBe("Bio Commerce 1");
  });

  it("increments per destination independently", () => {
    const cloud = [{ name: "Avaliação 1" }, { name: "Avaliação 2" }];
    expect(buildDefaultDesignName("reviews", cloud)).toBe("Avaliação 3");
    // Different destination is not affected by other destinations' names.
    expect(buildDefaultDesignName("landing", cloud)).toBe("Cartão Fidelidade 1");
    expect(buildDefaultDesignName("linktree", cloud)).toBe("Bio Commerce 1");
  });

  it("takes the maximum across cloud and local sources", () => {
    const cloud = [{ name: "Cartão Fidelidade 2" }];
    const local = [{ name: "Cartão Fidelidade 5" }, { name: "Cartão Fidelidade 3" }];
    expect(buildDefaultDesignName("landing", cloud, local)).toBe("Cartão Fidelidade 6");
  });

  it("ignores unrelated names and different destination prefixes", () => {
    const cloud = [
      { name: "Meu design" },
      { name: "Avaliação 4" },
      { name: "Bio Commerce 9" },
      { name: null },
      {},
    ];
    expect(buildDefaultDesignName("reviews", cloud)).toBe("Avaliação 5");
    expect(buildDefaultDesignName("landing", cloud)).toBe("Cartão Fidelidade 1");
    expect(buildDefaultDesignName("linktree", cloud)).toBe("Bio Commerce 10");
  });

  it("matches case-insensitively and trims whitespace", () => {
    const cloud = [{ name: "  avaliação 7  " }];
    expect(buildDefaultDesignName("reviews", cloud)).toBe("Avaliação 8");
  });

  it("ignores names that do not end in a number", () => {
    const cloud = [{ name: "Avaliação especial" }, { name: "Avaliação" }];
    expect(buildDefaultDesignName("reviews", cloud)).toBe("Avaliação 1");
  });
});
