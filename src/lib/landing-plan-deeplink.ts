/**
 * Planos enviados pelo WhatsApp Fidelize abrem a landing com ?plano=slug#precos.
 * A lista deve permanecer na mesma ordem dos cards do componente Pricing.
 */
export const LANDING_PLAN_SLUGS = ["essencial", "profissional", "ilimitado", "empresarial"] as const;

/** Retorna null se a URL não contém um plano reconhecido. */
export function getLandingPlanIndex(search: string): number | null {
  const raw = new URLSearchParams(search).get("plano");
  if (!raw) return null;
  const clean = raw.trim().toLocaleLowerCase("pt-BR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const slug = clean === "premium" ? "ilimitado" : clean;
  const index = LANDING_PLAN_SLUGS.findIndex((value) => value === slug);
  return index >= 0 ? index : null;
}
