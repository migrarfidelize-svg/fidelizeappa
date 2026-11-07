import { describe, expect, it } from "vitest";
import { getProximityLocations } from "./wallet-proximity";
describe("proximidade da carteira nativa", () => {
  it("mantém desligado por padrão", () => {
    expect(getProximityLocations({ proximity_enabled: false, proximity_latitude: -22.3, proximity_longitude: -49.1 })).toEqual([]);
  });
  it("publica as coordenadas da loja quando habilitado", () => {
    expect(getProximityLocations({ proximity_enabled: true, proximity_latitude: -22.3, proximity_longitude: -49.1 })).toEqual([{latitude: -22.3, longitude: -49.1}]);
  });
  it("recusa valores ausentes ou inválidos", () => {
    expect(getProximityLocations({proximity_enabled:true,proximity_latitude:null,proximity_longitude:null})).toEqual([]);
    expect(getProximityLocations({proximity_enabled:true,proximity_latitude:100,proximity_longitude:0})).toEqual([]);
    expect(getProximityLocations({proximity_enabled:true,proximity_latitude:0,proximity_longitude:Infinity})).toEqual([]);
  });
});
