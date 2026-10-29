import { expect, test } from "@playwright/test";

/**
 * GYNRACE mobile acceptance test.
 * Run with PLAYWRIGHT_BASE_URL=http://127.0.0.1:3070 bunx playwright test
 * tests/e2e/gynrace-mobile.spec.ts --project=mobile-chrome
 */
const screens = [320, 360, 375, 390, 430, 768] as const;

test("Racing Edition keeps content, buttons and captions inside mobile viewport", async ({ page }) => {
  await page.goto("/links/gynrace", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-gynrace-edition="racing-photo-original-2026-10-29"]')).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /SUA MOTO/ })).toBeVisible();

  for (const width of screens) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(90);

    const geometry = await page.evaluate(() => {
      const rectangle = (selector: string) => {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      const title = document.querySelector<HTMLElement>(".gr-hero-title");
      const loc = document.querySelector<HTMLElement>("#localizacao a");
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        heroTitle: rectangle(".gr-hero-title"),
        heroNote: rectangle(".gr-hero-note"),
        heroImage: rectangle(".gr-hero-image"),
        photoCaption: rectangle(".gr-hero-image-label"),
        nextSection: rectangle("section.gr-shell.grid.gap-3"),
        projectTitle: rectangle(".gr-project-title"),
        projectAction: rectangle(".gr-project-action"),
        locationButton: rectangle("#localizacao a"),
        headlineFits: title ? title.scrollWidth <= title.clientWidth + 2 : false,
        locationFits: loc ? loc.scrollWidth <= loc.clientWidth + 2 : false,
      };
    });

    expect(geometry.documentWidth, `Horizontal overflow at ${width}px`).toBeLessThanOrEqual(width + 2);
    expect(geometry.headlineFits, `Hero headline clipped at ${width}px`).toBeTruthy();
    expect(geometry.locationFits, `Location button clipped at ${width}px`).toBeTruthy();
    expect(geometry.heroTitle, `Missing title at ${width}px`).not.toBeNull();
    expect(geometry.heroTitle!.left).toBeGreaterThanOrEqual(-2);
    expect(geometry.heroTitle!.right).toBeLessThanOrEqual(width + 2);

    if (geometry.heroNote && geometry.heroImage) {
      expect(geometry.heroNote.top,
        `Hero badge covers the photo caption at ${width}px`).toBeGreaterThanOrEqual(geometry.heroImage.bottom - 1);
    }
    if (geometry.photoCaption && geometry.heroNote) {
      expect(geometry.photoCaption.bottom,
        `Hero note overlays caption text at ${width}px`).toBeLessThanOrEqual(geometry.heroNote.top + 1);
    }
    if (width < 768 && geometry.heroNote && geometry.nextSection) {
      expect(geometry.heroNote.bottom, `Hero photo badge overlaps next section at ${width}px`).toBeLessThanOrEqual(geometry.nextSection.top + 1);
    }
    if (width < 768 && geometry.projectTitle && geometry.projectAction) {
      const t = geometry.projectTitle;
      const a = geometry.projectAction;
      const overlap = Math.max(0, Math.min(t.right, a.right) - Math.max(t.left, a.left)) *
        Math.max(0, Math.min(t.bottom, a.bottom) - Math.max(t.top, a.top));
      expect(overlap, `Project gallery action overlaps text at ${width}px`).toBe(0);
    }
  }
});

test("Mobile navigation opens and links to services", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/links/gynrace", { waitUntil: "domcontentloaded" });

  const open = page.getByRole("button", { name: "Abrir menu" });
  await expect(open).toBeVisible();
  await open.click();

  const nav = page.getByRole("navigation", { name: "Navegação GYNRACE" });
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Serviços" }).click();

  await expect(nav).toBeHidden();
  expect(new URL(page.url()).hash).toBe("#servicos");
});
