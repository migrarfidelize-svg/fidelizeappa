import { describe, expect, it } from "vitest";
import { getPublicLinkTreeUrl } from "./public-link-url";

describe("getPublicLinkTreeUrl", () => {
  it("uses the public route and normalizes the slug", () => {
    expect(getPublicLinkTreeUrl(" Cafe-Aurora ", "https://afidelize.app")).toBe(
      "https://afidelize.app/cafe-aurora",
    );
  });

  it("never exposes localhost or a Lovable preview in merchant links", () => {
    expect(getPublicLinkTreeUrl("cafe", "http://localhost:3000")).toBe(
      "https://afidelize.app/cafe",
    );
    expect(getPublicLinkTreeUrl("cafe", "https://my-preview.lovable.app")).toBe(
      "https://afidelize.app/cafe",
    );
  });
});
