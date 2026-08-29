/**
 * API REST privada para integração externa.
 * Base: /api/public/integrations
 *
 * Segurança: API Key obrigatória (x-api-key), rate limit por chave,
 * validação de origem e log de auditoria de todas as requisições.
 */
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-api-key, authorization",
  "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
};

async function dispatch(request: Request, splat: string | undefined): Promise<Response> {
  const started = Date.now();
  const segments = (splat ?? "").split("/").filter(Boolean);
  const path = `/api/public/integrations/${segments.join("/")}`;

  const {
    authenticateApiRequest,
    handleApiRoute,
    logApiRequest,
    errorResponse,
    jsonResponse,
  } = await import("@/lib/integrations/rest-api.server");

  // Documentação pública (sem API Key)
  if (request.method === "GET" && (segments[0] === "openapi.json" || segments[0] === "docs")) {
    const origin = new URL(request.url).origin;
    const { buildOpenApiDocument, swaggerHtml } = await import("@/lib/integrations/openapi.server");
    if (segments[0] === "openapi.json") return jsonResponse(buildOpenApiDocument(origin));
    return new Response(swaggerHtml(origin), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const auth = await authenticateApiRequest(request);
  if (!auth.ok) {
    await logApiRequest({
      request,
      path,
      status: auth.status,
      establishmentId: auth.establishmentId ?? null,
      apiKeyId: auth.keyId ?? null,
      prefix: auth.prefix ?? null,
      errorCode: auth.code,
      durationMs: Date.now() - started,
    });
    return errorResponse(auth.status, auth.code, auth.message);
  }

  let response: Response;
  try {
    response = await handleApiRoute(request, segments, { key: auth.key });
  } catch (e) {
    console.error("[integrations-api] erro inesperado", e);
    response = errorResponse(500, "internal_error", "Erro interno ao processar a requisição.");
  }

  await logApiRequest({
    request,
    path,
    status: response.status,
    establishmentId: auth.key.establishment_id,
    apiKeyId: auth.key.id,
    prefix: auth.key.prefix,
    errorCode: response.status >= 400 ? String(response.status) : null,
    durationMs: Date.now() - started,
  });

  return response;
}

export const Route = createFileRoute("/api/public/integrations/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => dispatch(request, (params as { _splat?: string })._splat),
      POST: async ({ request, params }) => dispatch(request, (params as { _splat?: string })._splat),
      PUT: async ({ request, params }) => dispatch(request, (params as { _splat?: string })._splat),
    },
  },
});
