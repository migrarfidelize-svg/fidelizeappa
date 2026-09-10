const PRODUCTION_ORIGIN = "https://afidelize.app";

const isLocalOrPreview = (origin: string) =>
  /(^|\.)localhost(?::\d+)?$|127\.0\.0\.1|lovable\.app$/i.test(
    origin.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  );

/** Builds merchant-facing public links without leaking a local/preview origin. */
export function getPublicLinkTreeUrl(slug: string, browserOrigin?: string): string {
  const configured = String(import.meta.env.VITE_APP_URL ?? "").trim();
  const candidate = configured || browserOrigin || PRODUCTION_ORIGIN;
  const origin = isLocalOrPreview(candidate) ? PRODUCTION_ORIGIN : candidate.replace(/\/+$/, "");
  return `${origin}/${slug.trim().toLowerCase()}`;
}
