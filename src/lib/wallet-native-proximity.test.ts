import { describe, expect, it } from "vitest";
import { buildApplePassJson } from "./apple-pass.server";
import { buildObject } from "./google-wallet.server";
import { defaultWalletSettings, type WalletPassModel } from "./wallet-pass.server";

const makeModel = (enabled: boolean): WalletPassModel => ({
  establishment: {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Loja Piloto",
    slug: "loja-piloto",
    logo_url: null,
    phone: null,
    whatsapp: null,
    address: "Centro",
    email: null,
    primary_color: "#5B21B6",
  },
  customer: {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Cliente Piloto",
    code: "CL-1",
    tier: null,
    access_token: "somente-token-de-teste",
    user_id: null,
  },
  card: null,
  points: 1,
  expiresAt: null,
  settings: {
    ...defaultWalletSettings("00000000-0000-0000-0000-000000000001"),
    proximity_enabled: enabled,
    proximity_latitude: -22.31,
    proximity_longitude: -49.11,
    proximity_message: "Seu cartão está aqui!",
  },
});

const apple = (model: WalletPassModel) => buildApplePassJson({
  model,
  origin: "https://afidelize.app",
  passTypeId: "pass.app.fidelize.card",
  teamId: "TEST",
  serialNumber: "AP-TEST",
  authenticationToken: "test-token",
});

const google = (model: WalletPassModel) => buildObject({
  issuerId: "123456789",
  clientEmail: "test@example.com",
  privateKey: "unused-for-pure-object-build",
}, model, "https://afidelize.app");

describe("aviso nativo de proximidade", () => {
  it("Apple inclui relevantText no local do estabelecimento", () => {
    expect(apple(makeModel(true)).locations).toEqual([
      { latitude: -22.31, longitude: -49.11, relevantText: "Seu cartão está aqui!" },
    ]);
  });
  it("Apple omite locais quando desativado", () => {
    expect(apple(makeModel(false)).locations).toBeUndefined();
  });
  it("Google utiliza merchantLocations e limpa ao desativar", () => {
    expect(google(makeModel(true)).merchantLocations).toEqual([
      { latitude: -22.31, longitude: -49.11 },
    ]);
    expect(google(makeModel(false)).merchantLocations).toEqual([]);
  });
});
