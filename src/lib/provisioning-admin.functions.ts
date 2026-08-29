import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/admin.functions";

type AuditRow = {
  id: string;
  action: string;
  entity_id: string | null;
  establishment_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

/** Painel Admin > Provisionamentos: contas criadas via API e seu ciclo de vida. */
export const adminProvisioningOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: audits } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, entity_id, establishment_id, ip, metadata, created_at")
      .in("action", [
        "api_provision_account",
        "api_provision_resend_access",
        "api_change_plan",
        "api_suspend_account",
        "api_reactivate_account",
      ])
      .order("created_at", { ascending: false })
      .limit(1000);

    const rows = (audits ?? []) as AuditRow[];
    const provisions = rows.filter((r) => r.action === "api_provision_account");
    const tenantIds = Array.from(new Set(provisions.map((p) => p.entity_id).filter(Boolean))) as string[];

    let tenants: Array<{ id: string; name: string; slug: string; active: boolean; plan: string | null; created_at: string }> = [];
    if (tenantIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("establishments")
        .select("id, name, slug, active, plan, created_at")
        .in("id", tenantIds);
      tenants = (data ?? []) as typeof tenants;
    }
    const byId = new Map(tenants.map((t) => [t.id, t]));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const createdToday = provisions.filter((p) => new Date(p.created_at) >= startOfDay).length;
    const active = tenants.filter((t) => t.active).length;
    const suspended = tenants.filter((t) => !t.active).length;
    // "Com erro": provisionamento registrado sem tenant existente (rollback ou exclusão posterior).
    const errored = provisions.filter((p) => !p.entity_id || !byId.has(p.entity_id)).length;

    const byPlan: Record<string, number> = {};
    for (const p of provisions) {
      const plan = String((p.metadata ?? {})["plan"] ?? "desconhecido");
      byPlan[plan] = (byPlan[plan] ?? 0) + 1;
    }

    return {
      created_today: createdToday,
      total: provisions.length,
      active,
      suspended,
      errored,
      by_plan: byPlan,
      last_provision: provisions[0]
        ? {
            id: provisions[0].id,
            tenant_id: provisions[0].entity_id,
            tenant_name: provisions[0].entity_id ? byId.get(provisions[0].entity_id)?.name ?? null : null,
            plan: (provisions[0].metadata ?? {})["plan"] ?? null,
            source: (provisions[0].metadata ?? {})["source"] ?? null,
            email: (provisions[0].metadata ?? {})["email"] ?? null,
            created_at: provisions[0].created_at,
          }
        : null,
      accounts: provisions.slice(0, 100).map((p) => {
        const t = p.entity_id ? byId.get(p.entity_id) : undefined;
        return {
          id: p.id,
          tenant_id: p.entity_id,
          name: t?.name ?? "(conta removida)",
          slug: t?.slug ?? null,
          plan: (p.metadata ?? {})["plan"] ?? t?.plan ?? null,
          source: (p.metadata ?? {})["source"] ?? null,
          email: (p.metadata ?? {})["email"] ?? null,
          status: !t ? "erro" : t.active ? "ativa" : "suspensa",
          created_at: p.created_at,
        };
      }),
      events: rows.slice(0, 100).map((r) => ({
        id: r.id,
        action: r.action,
        tenant_id: r.entity_id,
        tenant_name: r.entity_id ? byId.get(r.entity_id)?.name ?? null : null,
        ip: r.ip,
        api_key_id: (r.metadata ?? {})["api_key_id"] ?? null,
        payload: (r.metadata ?? {})["payload"] ?? null,
        response: (r.metadata ?? {})["response"] ?? null,
        created_at: r.created_at,
      })),
    };
  });
