/**
 * Snapshot offline da carteira, isolado por usuário e sem credenciais.
 *
 * Nunca persistir access_token, JWT, QR autenticável nem segredos no
 * localStorage. A consulta online continua sendo a fonte de verdade.
 * O QR que exige token autenticável fica indisponível sem conexão.
 */

const LEGACY_KEY = "fidelize:wallet-cache:v1";
const PREFIX = "fidelize:wallet-cache:v2:";
const MAX_AGE_DAYS = 7;
const SENSITIVE_FIELDS = new Set([
  "token", "access_token", "accessToken", "password", "secret",
  "jwt", "hashed_token", "refresh_token", "refreshToken",
]);

export type WalletCache<T> = {
  ownerId: string;
  savedAt: string;
  items: T[];
};

function scopedKey(userId: string): string | null {
  return /^[a-f0-9-]{36}$/i.test(userId) ? PREFIX + userId : null;
}

function removeLegacyCache() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* storage bloqueado */ }
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !SENSITIVE_FIELDS.has(key))
        .map(([key, child]) => [key, sanitize(child)]),
    );
  }
  return value;
}

/** Salva apenas a apresentação offline; nunca guarda QR/credenciais. */
export function saveWalletCache<T>(items: T[], userId: string): void {
  if (typeof window === "undefined") return;
  removeLegacyCache();
  const key = scopedKey(userId);
  if (!key) return;
  try {
    const payload: WalletCache<T> = {
      ownerId: userId,
      savedAt: new Date().toISOString(),
      items: sanitize(items) as T[],
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch { /* limite de armazenamento / modo privado */ }
}

/** Leitura somente para a sessão correta; não mistura cartões de outras contas. */
export function readWalletCache<T>(userId?: string | null): WalletCache<T> | null {
  if (typeof window === "undefined") return null;
  removeLegacyCache();
  const key = scopedKey(userId ?? "");
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletCache<T>;
    const saved = new Date(parsed.savedAt).getTime();
    const ageMs = Date.now() - saved;
    if (parsed.ownerId !== userId || !Array.isArray(parsed.items) ||
        !Number.isFinite(ageMs) || ageMs < 0 ||
        ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* noop */ }
    return null;
  }
}

/** O logout remove TODOS os snapshots deste navegador compartilhado. */
export function clearWalletCache(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(PREFIX) || key === LEGACY_KEY)) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* noop */ }
}

export function totalStampsFromCache<T extends { card: { stamps: number } | null }>(
  userId?: string | null,
): number {
  const cache = readWalletCache<T>(userId);
  if (!cache) return 0;
  return cache.items.reduce((sum, item) => sum + (item.card?.stamps ?? 0), 0);
}
