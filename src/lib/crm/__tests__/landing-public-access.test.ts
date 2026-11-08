import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicLandingBySlug } from "../../linktree.server";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from },
}));

const est = {
  id: "tenant-a", slug: "cafe", name: "Cafe", active: true,
  updated_at: "2026-10-01", primary_color: "#333333", accent_color: "#999999",
  logo_url: null, cover_url: null, description: null, whatsapp: null,
  phone: null, instagram: null, facebook: null, tiktok: null,
  website: null, google_maps_url: null,
};
const page = {
  id: "page-a", establishment_id: "tenant-a", public_slug: "cafe",
  published: true, title: "Links", description: null, theme: {},
  logo_url: null, cover_url: null, updated_at: "2026-10-01",
};
const link = {
  id: "l1", label: "Instagram", url: "https://instagram.com/teste",
  kind: "instagram", sort_order: 0, enabled: true, data: {},
  page_id: "page-a",
};

type State = {
  customPage: any; establishment: any; legacyPage: any;
  links: any[]; errors: Record<string, any>;
};
let state: State;
const calls: Array<{ table: string; action: string; field?: string; value?: unknown }> = [];

function setup(patch: Partial<State> = {}) {
  state = {
    customPage: { ...page },
    establishment: { ...est },
    legacyPage: null,
    links: [{ ...link }],
    errors: {},
    ...patch,
  };
  mocks.from.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const query: any = {};
    query.select = vi.fn((columns: string) => {
      calls.push({ table, action: "select", value: columns });
      return query;
    });
    query.eq = vi.fn((field: string, value: unknown) => {
      filters[field] = value;
      calls.push({ table, action: "eq", field, value });
      return query;
    });
    query.maybeSingle = vi.fn(async () => {
      const kind = table === "link_tree_pages"
        ? ("public_slug" in filters ? "customPage" : "legacyPage")
        : "establishment";
      const error = state.errors[kind];
      let data = state[kind as "customPage" | "legacyPage" | "establishment"];
      if (kind === "customPage" && data?.public_slug !== filters.public_slug) data = null;
      if (kind === "establishment" &&
          (filters.slug && data?.slug !== filters.slug ||
           filters.id && data?.id !== filters.id)) data = null;
      if (kind === "legacyPage" && data?.establishment_id !== filters.establishment_id) data = null;
      return { data, error: error ?? null };
    });
    query.order = vi.fn(async (field: string, opts: any) => {
      calls.push({ table, action: "order", field, value: opts });
      const error = state.errors.links;
      const data = state.links
        .filter((item) => item.page_id === filters.page_id &&
          (filters.enabled === undefined || item.enabled === filters.enabled))
        .sort((a, b) => a.sort_order - b.sort_order);
      return { data, error: error ?? null };
    });
    return query;
  });
}

describe("Landing Public Access — slug customizado e compatibilidade legada", () => {
  beforeEach(() => { vi.clearAllMocks(); calls.length = 0; setup(); });

  it("1. página publicada retorna apenas conteúdo público", async () => {
    const result = await getPublicLandingBySlug("cafe");
    expect(result.establishment.name).toBe("Cafe");
    expect(result.page.title).toBe("Links");
    expect(result.links).toHaveLength(1);
  });

  it("2. estabelecimento inativo não abre página", async () => {
    setup({ establishment: { ...est, active: false } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("INACTIVE");
  });

  it("3. slug inexistente não é confundido com outro tenant", async () => {
    setup({ customPage: null, establishment: null });
    await expect(getPublicLandingBySlug("inexistente")).rejects.toThrow("NOT_FOUND");
  });

  it("4. página despublicada é bloqueada", async () => {
    setup({ customPage: { ...page, published: false } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("UNPUBLISHED");
  });

  it("5. links de outro estabelecimento não aparecem", async () => {
    setup({ links: [link, { ...link, id: "foreign", page_id: "page-b" }] });
    const result = await getPublicLandingBySlug("cafe");
    expect(result.links.map((item) => item.id)).toEqual(["l1"]);
    expect(calls).toContainEqual({
      table: "link_tree_links", action: "eq", field: "page_id", value: "page-a",
    });
  });

  it("6. falha na consulta pública não vira página vazia", async () => {
    setup({ errors: { customPage: { code: "500", message: "db-down" } } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("DATABASE_ERROR");
  });

  it("7. DTO não revela identificadores internos nem tokens", async () => {
    const result = await getPublicLandingBySlug("cafe");
    expect((result.establishment as any).id).toBeUndefined();
    expect((result.page as any).establishment_id).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("tenant-a");
    expect(JSON.stringify(result)).not.toMatch(/access_token|service_role|password/);
  });

  it("8. normaliza slug antes da resolução", async () => {
    await getPublicLandingBySlug("  Cafe  ");
    expect(calls).toContainEqual({
      table: "link_tree_pages", action: "eq", field: "public_slug", value: "cafe",
    });
  });

  it("9. erro ao consultar estabelecimento é tratado como DATABASE_ERROR", async () => {
    setup({ errors: { establishment: { message: "timeout" } } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("DATABASE_ERROR");
  });

  it("10. erro ao consultar links é tratado como DATABASE_ERROR", async () => {
    setup({ errors: { links: { message: "timeout" } } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("DATABASE_ERROR");
  });

  it("11. filtra somente links habilitados em ordem definida", async () => {
    setup({ links: [
      { ...link, id: "z", sort_order: 3 },
      { ...link, id: "disabled", enabled: false, sort_order: 1 },
      { ...link, id: "a", sort_order: 0 },
    ] });
    const result = await getPublicLandingBySlug("cafe");
    expect(result.links.map((item) => item.id)).toEqual(["a", "z"]);
    expect(calls).toContainEqual({
      table: "link_tree_links", action: "eq", field: "enabled", value: true,
    });
    expect(calls).toContainEqual({
      table: "link_tree_links", action: "order", field: "sort_order", value: { ascending: true },
    });
  });

  it("12. estabelecimento inativo não consulta links", async () => {
    setup({ establishment: { ...est, active: false } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("INACTIVE");
    expect(mocks.from).not.toHaveBeenCalledWith("link_tree_links");
  });

  it("13. fallback por slug legado mantém URL /links/:slug", async () => {
    setup({ customPage: null, legacyPage: { ...page } });
    const result = await getPublicLandingBySlug("cafe");
    expect(result.page.id).toBe("page-a");
    expect(calls).toContainEqual({
      table: "establishments", action: "eq", field: "slug", value: "cafe",
    });
  });

  it("14. todas as queries selecionam campos explícitos", async () => {
    await getPublicLandingBySlug("cafe");
    const selects = calls.filter((c) => c.action === "select").map((c) => c.value);
    expect(selects).not.toContain("*");
    expect(selects.join(",")).not.toMatch(/service_role|password|billing/);
  });
});
