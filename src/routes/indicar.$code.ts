import { createFileRoute } from "@tanstack/react-router";

/**
 * Landing de compartilhamento social dos afiliados.
 * Retorna OG estático no HTML para WhatsApp, Telegram, Facebook e outros
 * crawlers sem JavaScript; usuários são encaminhados ao site com ?ref=.
 */
const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const missing = () => new Response("Indicação não encontrada.", {
  status: 404,
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
});

export const Route = createFileRoute("/indicar/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = String(params.code || "").toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{3,39}$/.test(code)) return missing();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: account, error } = await supabaseAdmin
          .from("affiliate_accounts")
          .select("establishment_id,code,enabled,custom_title,featured_asset_id")
          .eq("code", code)
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!account?.enabled) return missing();

        const [estRes, assetRes] = await Promise.all([
          supabaseAdmin.from("establishments")
            .select("name")
            .eq("id", account.establishment_id)
            .single(),
          account.featured_asset_id
            ? supabaseAdmin.from("affiliate_assets")
              .select("media_type,media_url,preview_url")
              .eq("id", account.featured_asset_id)
              .eq("establishment_id", account.establishment_id)
              .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (estRes.error) throw new Error(estRes.error.message);
        if (assetRes.error) throw new Error(assetRes.error.message);

        const image = assetRes.data
          ? assetRes.data.preview_url ||
            (assetRes.data.media_type === "image" ? assetRes.data.media_url : null)
          : null;
        const owner = String(estRes.data?.name || "nosso parceiro");
        const title = String(account.custom_title || "Conheça a Fidelize com " + owner);
        const description = "Transforme clientes em clientes fiéis com a Fidelize. Conheça os planos pelo convite de " + owner + ".";
        const canonical = "https://afidelize.app/indicar/" + encodeURIComponent(code);
        const destination = "https://afidelize.app/?ref=" + encodeURIComponent(code);

        const imageTags = image
          ? '<meta property="og:image" content="' + escapeHtml(image) + '">' +
            '<meta property="og:image:secure_url" content="' + escapeHtml(image) + '">' +
            '<meta name="twitter:image" content="' + escapeHtml(image) + '">'
          : "";

        const html = '<!doctype html><html lang="pt-BR"><head>' +
          '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<title>' + escapeHtml(title) + ' | Fidelize</title>' +
          '<meta name="description" content="' + escapeHtml(description) + '">' +
          '<meta property="og:type" content="website">' +
          '<meta property="og:site_name" content="Fidelize">' +
          '<meta property="og:locale" content="pt_BR">' +
          '<meta property="og:url" content="' + escapeHtml(canonical) + '">' +
          '<meta property="og:title" content="' + escapeHtml(title) + '">' +
          '<meta property="og:description" content="' + escapeHtml(description) + '">' +
          '<meta name="twitter:card" content="summary_large_image">' +
          imageTags +
          '<meta name="robots" content="noindex,follow">' +
          '<style>body{margin:0;min-height:100svh;background:#0c0920;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:grid;place-items:center;text-align:center;padding:24px;box-sizing:border-box}.card{max-width:500px;border:1px solid #ffffff22;border-radius:28px;background:#ffffff0a;padding:42px 28px;box-shadow:0 30px 90px #0004}.brand{color:#be9aff;font-size:13px;letter-spacing:.26em;font-weight:800}h1{font-size:clamp(28px,6vw,44px);line-height:1.1;margin:24px 0}p{color:#c9c2d9;line-height:1.6}a{display:inline-block;margin-top:20px;background:#a78bfa;color:#170b31;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:800}</style>' +
          '</head><body><main class="card"><div class="brand">FIDELIZE</div>' +
          '<h1>' + escapeHtml(title) + '</h1>' +
          '<p>' + escapeHtml(description) + '</p>' +
          '<a href="' + escapeHtml(destination) + '">Conhecer a Fidelize</a></main>' +
          '<script>window.location.replace(' + JSON.stringify(destination) + ');</script>' +
          '</body></html>';

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=60",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
          },
        });
      },
    },
  },
});
