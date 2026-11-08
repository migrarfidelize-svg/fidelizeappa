import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWalletCache,
  readWalletCache,
  saveWalletCache,
  totalStampsFromCache,
} from "./offline-wallet-cache";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  };
}

describe("snapshot offline da carteira", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("não persiste tokens do cliente nem credenciais em objetos aninhados", () => {
    saveWalletCache([{
      customer: { id: A, token: "BEARER_SECRET", code: "card-code" },
      card: { stamps: 3, campaign: { id: "x" } },
      hidden: { access_token: "SECRET", password: "SECRET" },
    }], A);
    const cached = readWalletCache<any>(A);
    expect(cached?.items[0].customer.token).toBeUndefined();
    expect(cached?.items[0].hidden.access_token).toBeUndefined();
    expect(cached?.items[0].hidden.password).toBeUndefined();
    expect(cached?.items[0].card.stamps).toBe(3);
    expect(JSON.stringify(cached)).not.toContain("BEARER_SECRET");
  });

  it("não mistura cartões quando troca de conta", () => {
    saveWalletCache([{ card: { stamps: 5 } }], A);
    expect(readWalletCache(B)).toBeNull();
    expect(readWalletCache(A)?.items).toHaveLength(1);
    expect(totalStampsFromCache(A)).toBe(5);
    expect(totalStampsFromCache()).toBe(0);
  });

  it("remove automaticamente o cache antigo compartilhado", () => {
    localStorage.setItem("fidelize:wallet-cache:v1", "DADOS ANTIGOS");
    readWalletCache(A);
    expect(localStorage.getItem("fidelize:wallet-cache:v1")).toBeNull();
  });

  it("limpa dados de todas as contas ao sair", () => {
    saveWalletCache([{ card: { stamps: 1 } }], A);
    saveWalletCache([{ card: { stamps: 2 } }], B);
    clearWalletCache();
    expect(readWalletCache(A)).toBeNull();
    expect(readWalletCache(B)).toBeNull();
  });
});
