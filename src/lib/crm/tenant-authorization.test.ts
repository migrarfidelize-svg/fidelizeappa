import { describe, expect, it, vi } from "vitest";
import { assertActiveCRMAssignee, authorizeCRMEstablishment } from "../atendimento.functions";

function chain(result: any) {
  const value: any = { select: vi.fn(() => value), eq: vi.fn(() => value), maybeSingle: vi.fn(async () => result) };
  return value;
}

describe("autorização explícita do CRM", () => {
  it("permite Super Admin selecionar tenant sem membership", async () => {
    const establishments = chain({ data: { id: "tenant-a" }, error: null });
    const client = { rpc: vi.fn(async () => ({ data: true, error: null })), from: vi.fn(() => establishments) };
    await expect(authorizeCRMEstablishment(client, "super-admin", "tenant-a")).resolves.toBe("tenant-a");
    expect(client.from).toHaveBeenCalledWith("establishments");
    expect(client.from).not.toHaveBeenCalledWith("establishment_members");
  });

  it("rejeita assignedTo que não pertence ao tenant selecionado", async () => {
    const client = { from: vi.fn(() => chain({ data: null, error: null })) };
    await expect(assertActiveCRMAssignee(client, "tenant-a", "operator-b")).rejects.toThrow(/não é um operador ativo/i);
  });
});

describe("CRM é exclusivo da plataforma", () => {
  it("nega owner/manager do estabelecimento", async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: false, error: null })),
      from: vi.fn(() => chain({ data: { role: "owner" }, error: null })),
    };
    await expect(authorizeCRMEstablishment(client, "lojista", "tenant-a")).rejects.toThrow(/apenas administradores da plataforma/i);
    expect(client.from).not.toHaveBeenCalled();
  });
});
