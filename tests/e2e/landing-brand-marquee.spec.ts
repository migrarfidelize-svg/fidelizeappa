import { expect, test } from "@playwright/test";

/**
 * Fidelize homepage: carrossel premium de marcas.
 * Verifica que Cimed/WePink e demais imagens do Admin nao mudem o tamanho nem a cor do loop.
 */
test("brand marquee stays black, regular-sized and seamless on desktop/mobile", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const marquee = page.locator(".fidelize-brand-marquee");
  await expect(marquee).toBeVisible();
  await expect(marquee).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const groups = marquee.locator(".fidelize-brand-sequence");
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(1)).toHaveAttribute("aria-hidden", "true");
  const groupCount = await groups.first().locator(".fidelize-brand-cell").count();
  expect(groupCount).toBeGreaterThanOrEqual(4);
  await expect(groups.nth(1).locator(".fidelize-brand-cell")).toHaveCount(groupCount);

  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const geometry = await marquee.evaluate((root) => {
      const groups = root.querySelectorAll<HTMLElement>(".fidelize-brand-sequence");
      const marks = root.querySelectorAll<HTMLElement>(".fidelize-brand-cell");
      const images = root.querySelectorAll<HTMLImageElement>(".fidelize-brand-logo-image");
      return {
        rect: root.getBoundingClientRect(),
        groupA: groups[0]?.getBoundingClientRect().width ?? 0,
        groupB: groups[1]?.getBoundingClientRect().width ?? 0,
        markSizes: Array.from(marks).map((el) => ({
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
        })),
        imageStyles: Array.from(images).map((el) => ({
          filter: getComputedStyle(el).filter,
          fit: getComputedStyle(el).objectFit,
        })),
      };
    });
    expect(geometry.rect.width).toBeLessThanOrEqual(width + 1);
    expect(Math.abs(geometry.groupA - geometry.groupB)).toBeLessThanOrEqual(1);
    const heights = new Set(geometry.markSizes.map((s) => Math.round(s.height)));
    const widths = new Set(geometry.markSizes.map((s) => Math.round(s.width)));
    expect(heights.size).toBe(1);
    expect(widths.size).toBe(1);
    // Fundos opacos não podem receber brightness(0), pois viram blocos pretos.
    expect(geometry.imageStyles.every((s) =>
      s.filter === "none" && s.fit === "contain"
    )).toBeTruthy();
  }
});
