process.env.RONNEI_WEBHOOK_URL = "https://ronneinv.lovable.app/api/public/webhooks/fidelize";
const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const { provisionAccount, changeAccountPlan, suspendAccount, reactivateAccount } = await import("@/lib/integrations/provisioning.server");
const { notifyOriginPartner, getProvisionOrigin } = await import("@/lib/integrations/lifecycle-sync.server");

const { data: key } = await supabaseAdmin.from("api_keys").select("id, name, establishment_id").ilike("name", "%Ronnei%").eq("is_active", true).limit(1).maybeSingle();
console.log("API KEY:", key?.name, key?.id);
const meta = { apiKeyId: key!.id as string, apiKeyEstablishmentId: key!.establishment_id as string, ip: "127.0.0.1" };

const stamp = Date.now();
const email = `e2e.ronnei.${stamp}@example.com`;
const prov = await provisionAccount({ name: `E2E Ronnei ${stamp}`, email, phone: "11999990000", plan: "starter", source: "ronnei" }, meta as any);
console.log("PROVISION:", JSON.stringify(prov, null, 2));
if (!("ok" in prov) || !prov.ok) process.exit(1);
const tenant = prov.tenant_id;
console.log("ORIGIN:", await getProvisionOrigin(tenant));

async function step(label: string, plan: "starter"|"pro"|null, event: any, from: string|null, to: string|null) {
  if (plan) console.log(label, "changePlan:", JSON.stringify(await changeAccountPlan(tenant, plan, meta as any)).slice(0,200));
  const r = await notifyOriginPartner({ tenantId: tenant, event, fromPlan: from, toPlan: to, origin: "app" });
  console.log(label, "WEBHOOK:", JSON.stringify(r));
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("status, tier, metadata").eq("establishment_id", tenant).order("created_at",{ascending:false}).limit(1).maybeSingle();
  console.log(label, "SUB:", JSON.stringify(sub));
}

await step("UPGRADE", "pro", "subscription.upgraded", "starter", "pro");
await step("DOWNGRADE", "starter", "subscription.downgraded", "pro", "starter");
console.log("SUSPEND:", JSON.stringify(await suspendAccount(tenant, "teste e2e", meta as any)).slice(0,160));
await step("CANCEL", null, "subscription.cancelled", "starter", null);
console.log("REACTIVATE:", JSON.stringify(await reactivateAccount(tenant, meta as any)).slice(0,160));
await step("REACTIVATED", null, "subscription.reactivated", null, "starter");

const { data: audits } = await supabaseAdmin.from("audit_logs").select("action, metadata, created_at").eq("establishment_id", tenant).order("created_at",{ascending:true});
for (const a of audits ?? []) {
  const m: any = a.metadata ?? {};
  console.log("AUDIT", a.action, m.event ?? "", m.sent_event ?? "", m.status_code ?? "", m.delivered ?? "", m.error ?? "");
}
console.log("TENANT:", tenant, email);
