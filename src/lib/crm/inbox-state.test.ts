import { describe, expect, it } from "vitest";
import { canTransition, INBOX_TRANSITIONS } from "./inbox.functions";

describe("máquina de estados do Atendimento", () => {
  it("permite takeover a partir do bot e da fila", () => {
    expect(canTransition("bot", "assigned")).toBe(true);
    expect(canTransition("waiting", "assigned")).toBe(true);
  });

  it("permite pausar e devolver ao bot somente a partir de atendimento humano", () => {
    expect(canTransition("assigned", "paused")).toBe(true);
    expect(canTransition("paused", "bot")).toBe(true);
    expect(canTransition("bot", "paused")).toBe(false);
  });

  it("permite reabrir conversas finalizadas", () => {
    expect(canTransition("closed", "waiting")).toBe(true);
    expect(canTransition("closed", "paused")).toBe(false);
  });

  it("cobre todos os estados conhecidos", () => {
    expect(Object.keys(INBOX_TRANSITIONS).sort()).toEqual(["assigned", "bot", "closed", "paused", "waiting"]);
  });
});
