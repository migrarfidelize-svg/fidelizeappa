import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicYouTubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published_at: string | null;
};

export type PublicYouTubeFeed = {
  channel_id: string;
  channel_url: string;
  title: string | null;
  videos: PublicYouTubeVideo[];
};

type CachedFeed = { expires: number; value: PublicYouTubeFeed | null };
const CACHE = new Map<string, CachedFeed>();
const TTL = 20 * 60 * 1000;

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textBetween(source: string, tag: string) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i").exec(source);
  return match ? decodeXml(match[1].trim()) : "";
}

function normalizeYoutubeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function resolveChannelId(channelUrl: string) {
  const direct = /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,})/i.exec(channelUrl)?.[1];
  if (direct) return direct;

  const response = await fetch(channelUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; FidelizeBioCommerce/1.0; +https://afidelize.app)",
      "accept-language": "pt-BR,pt;q=0.9,en;q=0.7",
    },
    redirect: "follow",
  });
  if (!response.ok) return null;
  const html = await response.text();
  return (
    /"channelId":"(UC[A-Za-z0-9_-]{20,})"/.exec(html)?.[1] ??
    /"externalId":"(UC[A-Za-z0-9_-]{20,})"/.exec(html)?.[1] ??
    /<meta\s+itemprop="channelId"\s+content="(UC[A-Za-z0-9_-]{20,})"/i.exec(html)?.[1] ??
    null
  );
}

async function loadFeed(channelUrl: string): Promise<PublicYouTubeFeed | null> {
  const channelId = await resolveChannelId(channelUrl);
  if (!channelId) return null;

  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
    headers: { "user-agent": "FidelizeBioCommerce/1.0" },
  });
  if (!response.ok) return null;
  const xml = await response.text();
  const feedTitle = textBetween(xml, "title") || null;
  const entries = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi));
  const videos = entries.slice(0, 6).map((entry) => {
    const body = entry[1];
    const id = textBetween(body, "yt:videoId");
    return {
      id,
      title: textBetween(body, "title") || "Vídeo",
      url: id ? `https://www.youtube.com/watch?v=${id}` : channelUrl,
      thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "",
      published_at: textBetween(body, "published") || null,
    } satisfies PublicYouTubeVideo;
  }).filter((video) => video.id);

  return { channel_id: channelId, channel_url: channelUrl, title: feedTitle, videos };
}

export const getPublicYouTubeFeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ url: z.string().trim().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const normalized = normalizeYoutubeUrl(data.url);
    if (!normalized) return null;

    const cached = CACHE.get(normalized);
    if (cached && cached.expires > Date.now()) return cached.value;

    try {
      const value = await loadFeed(normalized);
      CACHE.set(normalized, { expires: Date.now() + TTL, value });
      return value;
    } catch (error) {
      console.warn("[bio-commerce] YouTube feed indisponível", error);
      CACHE.set(normalized, { expires: Date.now() + 2 * 60 * 1000, value: null });
      return null;
    }
  });
