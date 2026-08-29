/**
 * Resolve a URL pública da aplicação para uso em server functions
 * (links em e-mails, webhooks, redirects) e no cliente.
 *
 * Ordem de precedência:
 *   1. APP_URL                    (domínio configurado — produção/canônico)
 *   2. window.location.origin     (cliente, quando APP_URL não estiver setada)
 *   3. http://localhost:8080      (fallback apenas em dev/servidor sem APP_URL)
 *
 * Para trocar o domínio (ex.: afidelize.app), atualize apenas a secret APP_URL
 * (e PUBLIC_APP_URL/PUBLISHED_APP_URL se ainda referenciados) — sem mudanças no código.
 */
export function getPublicAppUrl(): string {
  const appUrl = process.env['APP_URL'];
  if (appUrl && appUrl.trim()) return appUrl.replace(/\/+$/, "");

  // Cliente: usa a origem atual da página (sem hardcode).
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // Servidor sem APP_URL: fallback de desenvolvimento.
  return "http://localhost:8080";
}
