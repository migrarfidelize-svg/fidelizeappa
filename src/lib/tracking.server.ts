/**
 * Server-only helpers for anonymized engagement tracking.
 * Stores no PII: IP is truncated to /24 (v4) or /48 (v6) then SHA-256 hashed
 * with a per-day salt so the same visitor cannot be tracked across days.
 */

export type ChannelName = "linktree" | "reviews" | "loyalty" | "qr";
export type EventType = "page_view" | "link_click" | "qr_scan";

export function truncateIp(ip: string): string {
  if (!ip) return "";
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::/48";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export async function sha256Short(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function hashIp(request: Request): Promise<string | null> {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  if (!raw) return null;
  const dayKey = new Date().toISOString().slice(0, 10);
  return sha256Short(`${dayKey}:${truncateIp(raw)}`);
}

export function pickUtm(url: URL) {
  const g = (k: string) => url.searchParams.get(k)?.slice(0, 80) ?? null;
  return {
    utm_source: g("utm_source"),
    utm_medium: g("utm_medium"),
    utm_campaign: g("utm_campaign"),
  };
}

export async function resolveEstablishmentIdBySlug(slug: string): Promise<string | null> {
  const s = String(slug ?? "").trim().toLowerCase();
  if (!s || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(s)) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: customPage } = await (supabaseAdmin as any)
    .from("link_tree_pages")
    .select("establishment_id")
    .eq("public_slug", s)
    .maybeSingle();

  if (customPage?.establishment_id) return customPage.establishment_id;

  const { data } = await supabaseAdmin
    .from("establishments")
    .select("id")
    .eq("slug", s)
    .maybeSingle();

  return data?.id ?? null;
}

export async function logChannelEvent(params: {
  establishment_id: string;
  channel: ChannelName;
  event_type: EventType;
  ref_id?: string | null;
  ref_label?: string | null;
  request: Request;
  url?: URL;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ua = params.request.headers.get("user-agent")?.slice(0, 300) ?? null;
    const ip_hash = await hashIp(params.request);
    const utm = params.url ? pickUtm(params.url) : { utm_source: null, utm_medium: null, utm_campaign: null };
    void supabaseAdmin.from("channel_events").insert({
      establishment_id: params.establishment_id,
      channel: params.channel,
      event_type: params.event_type,
      ref_id: params.ref_id ?? null,
      ref_label: params.ref_label ? String(params.ref_label).slice(0, 120) : null,
      ua,
      ip_hash,
      ...utm,
    });
  } catch {
    /* swallow — analytics must never break user flow */
  }
}
