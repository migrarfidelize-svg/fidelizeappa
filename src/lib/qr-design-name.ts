/**
 * Pure helpers for naming QR designs based on the configured destination.
 * Extracted from app.avaliacoes.qr.tsx so it can be unit-tested in isolation.
 */

export type QrDest = "reviews" | "landing" | "linktree" | "menu" | "catalog";

export const QR_DEST_LABEL: Record<QrDest, string> = {
  reviews: "Avaliação",
  landing: "Cartão Fidelidade",
  linktree: "Bio Commerce",
  menu: "Cardápio digital",
  catalog: "Catálogo digital",
};

export function buildDefaultDesignName(
  dest: QrDest,
  cloud?: Array<{ name?: string | null }> | null,
  local?: Array<{ name?: string | null }> | null,
): string {
  const label = QR_DEST_LABEL[dest] ?? "Design";
  const names = [
    ...(cloud ?? []).map((d) => (d?.name ?? "").trim()),
    ...(local ?? []).map((d) => (d?.name ?? "").trim()),
  ];
  const re = new RegExp(
    `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`,
    "i",
  );
  let max = 0;
  for (const n of names) {
    const m = n.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${label} ${max + 1}`;
}
