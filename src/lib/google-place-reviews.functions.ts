import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public Google Places reviews. The browser never receives the API key.
 * Google Places returns at most five review previews, not the full archive.
 * For all reviews, link to Google Maps or obtain merchant-authorized GBP OAuth.
 */
const Schema = z.object({ slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/) });

type GoogleReview = {
  rating: number;
  text: string;
  author: string;
  authorUri: string | null;
  authorPhoto: string | null;
  reviewUri: string | null;
  relativeTime: string | null;
  publishedAt: string | null;
};
type ReviewsResult = {
  available: boolean;
  rating: number | null;
  total: number | null;
  reviews: GoogleReview[];
  attribution: "Google Maps";
  sorting: "relevance";
};

const empty: ReviewsResult = {
  available: false, rating: null, total: null, reviews: [],
  attribution: "Google Maps", sorting: "relevance",
};

function safeGoogleUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return null;
    if (!(u.hostname === "google.com" || u.hostname.endsWith(".google.com")
      || u.hostname === "googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com")
      || u.hostname === "gstatic.com" || u.hostname.endsWith(".gstatic.com"))) return null;
    return u.href;
  } catch { return null; }
}

export const getGooglePlaceReviews = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Schema.parse(value))
  .handler(async ({ data }): Promise<ReviewsResult> => {
    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return empty;

    // Resolve only a business location linked to a published Fidelize page,
    // preventing arbitrary Places lookups with our private Google API key.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page } = await (supabaseAdmin as any).from("link_tree_pages")
      .select("theme,published,establishment_id").eq("public_slug", data.slug)
      .eq("published", true).maybeSingle();
    if (!page) return empty;
    const config = page.theme?.google_reviews;
    const placeId = typeof config?.place_id === "string" ? config.place_id : "";
    if (!/^ChIJ[a-zA-Z0-9_-]{12,80}$/.test(placeId)) return empty;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri",
          },
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!response.ok) {
        console.warn("[google-place-reviews] Google Places returned HTTP", response.status);
        return empty;
      }
      const result = await response.json() as any;
      const reviews: GoogleReview[] = Array.isArray(result.reviews)
        ? result.reviews.slice(0, 5).map((row: any) => ({
            rating: Math.min(5, Math.max(1, Number(row.rating) || 1)),
            text: String(row.text?.text || row.originalText?.text || "").slice(0, 1800),
            author: String(row.authorAttribution?.displayName || "Avaliação Google").slice(0, 100),
            authorUri: safeGoogleUrl(row.authorAttribution?.uri),
            authorPhoto: safeGoogleUrl(row.authorAttribution?.photoUri),
            reviewUri: safeGoogleUrl(row.googleMapsUri),
            relativeTime: typeof row.relativePublishTimeDescription === "string"
              ? row.relativePublishTimeDescription.slice(0, 80) : null,
            publishedAt: typeof row.publishTime === "string" ? row.publishTime : null,
          }))
        : [];
      return {
        available: true,
        rating: Number.isFinite(result.rating) ? Number(result.rating) : null,
        total: Number.isInteger(result.userRatingCount) ? result.userRatingCount : null,
        reviews,
        attribution: "Google Maps",
        sorting: "relevance",
      };
    } catch (error) {
      console.warn("[google-place-reviews] Request failed", error instanceof Error ? error.message : "unknown");
      return empty;
    }
  });
