import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from },
}));

import { authorizeInbox } from "./inbox.functions";

const PLATFORM_ID = "f406351f-487b-47db-b0d3-bd5cb918b6c3";
const FOREIGN_ID = "a0000000-0000-4000-8000-000000000001";

function query(data: unknown) {
  const q: any = {};
  q.select = vi.fn(() => q);
  q.eq = vi.fn(() => q);
  q.maybeSingle = vi.fn(async () => ({ data, error: null }));
  return q;
}

describe("Central de Atendimento Fidelize - isolamento institucional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((table: string) => {
      if (table === "app_roles") return query({ user_id: "admin-1" });
      if (table === "establishments") return query({ id: PLATFORM_ID });
      throw new Error("Consulta inesperada: " + table);
    });
  });

  it("resolve somente o workspace institucional, sem buscar memberships", async () => {
    const auth = await authorizeInbox({}, "admin-1");
    expect(auth).toEqual({ establishmentId: PLATFORM_ID, isSuper: true, role: "super" });
    expect(mocks.from).toHaveBeenCalledWith("app_roles");
    expect(mocks.from).toHaveBeenCalledWith("establishments");
    expect(mocks.from).not.toHaveBeenCalledWith("establishment_members");
  });

  it("bloqueia a tentativa de selecionar uma empresa cliente", async () => {
    await expect(authorizeInbox({}, "admin-1", FOREIGN_ID))
      .rejects.toThrow(/somente conversas da Fidelize/i);
  });

  it("rejeita usuarios sem papel administrativo", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "app_roles") return query(null);
      throw new Error("Nao deveria consultar: " + table);
    });
    await expect(authorizeInbox({}, "lojista-1"))
      .rejects.toThrow(/acesso restrito/i);
    expect(mocks.from).not.toHaveBeenCalledWith("establishments");
  });

  it("falha de forma segura se o workspace institucional nao existir", async () => {
    mocks.from.mockImplementation((table: string) => (
      table === "app_roles" ? query({ user_id: "admin-1" }) : query(null)
    ));
    await expect(authorizeInbox({}, "admin-1"))
      .rejects.toThrow(/workspace.*nao configurado/i);
  });
});
