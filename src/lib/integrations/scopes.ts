/**
 * Escopos de permissão das chaves de API de integração.
 * Módulo client-safe (usado também pelo painel).
 */

export const API_SCOPES = [
  "customers.read",
  "customers.write",
  "points.manage",
  "stats.read",
  "provisioning",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, string> = {
  "customers.read": "Ler clientes",
  "customers.write": "Criar/editar clientes",
  "points.manage": "Gerenciar pontos",
  "stats.read": "Ler estatísticas",
  provisioning: "Provisionar contas",
};

/** Escopos padrão de uma chave nova (sem provisionamento). */
export const DEFAULT_API_SCOPES: ApiScope[] = [
  "customers.read",
  "customers.write",
  "points.manage",
  "stats.read",
];

/** Compatibilidade com chaves emitidas antes da Fase 2. */
const LEGACY_MAP: Record<string, ApiScope[]> = {
  "customers:read": ["customers.read"],
  "customers:write": ["customers.write"],
  "points:write": ["points.manage", "stats.read"],
  "points:manage": ["points.manage"],
  "stats:read": ["stats.read"],
};

export function normalizeScopes(raw: readonly string[] | null | undefined): ApiScope[] {
  const out = new Set<ApiScope>();
  for (const s of raw ?? []) {
    const value = String(s).trim();
    if ((API_SCOPES as readonly string[]).includes(value)) {
      out.add(value as ApiScope);
      continue;
    }
    for (const mapped of LEGACY_MAP[value] ?? []) out.add(mapped);
  }
  return Array.from(out);
}

export function hasScope(raw: readonly string[] | null | undefined, scope: ApiScope): boolean {
  return normalizeScopes(raw).includes(scope);
}
