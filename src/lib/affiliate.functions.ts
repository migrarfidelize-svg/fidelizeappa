import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin } from "@/lib/admin.functions";

const id = z.string().uuid();
const codeSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{3,39}$/, "Use 4 a 40 caracteres: letras, números e hífen.");

async function getOwnedEstablishment(context: any, establishmentId?: string) {
  let q = context.supabase.from("establishment_members")
    .select("establishment_id,role,establishment:establishments(id,slug,name,created_at)")
    .eq("user_id", context.userId).eq("active", true).eq("role","owner");
  if (establishmentId) q = q.eq("establishment_id", establishmentId);
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Somente o titular do estabelecimento pode administrar afiliados.");
  return data as any;
}
async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
function check(error: any) { if (error) throw new Error(error.message); }
async function ensureAccount(db: any, est: any) {
  const establishmentId = est.establishment_id;
  const existing = await db.from("affiliate_accounts").select("*").eq("establishment_id",establishmentId).maybeSingle();
  check(existing.error);
  if (existing.data) return existing.data;
  const raw = String(est.establishment?.slug || "parceiro").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").slice(0,26).replace(/-$/,"");
  const code = `${raw || "parceiro"}-${String(establishmentId).slice(0,6)}`;
  const inserted = await db.from("affiliate_accounts").insert({establishment_id:establishmentId,code}).select("*").single();
  check(inserted.error);
  return inserted.data;
}
const isoDay = (v: string) => Date.parse(v);
function summarize(commissions: any[], withdrawals: any[]) {
  const confirmed = commissions.filter(c=>c.status==="confirmed");
  const earned = confirmed.reduce((s,c)=>s+Number(c.amount),0);
  const released = confirmed.filter(c=>isoDay(c.release_at) <= Date.now()).reduce((s,c)=>s+Number(c.amount),0);
  const reserved = withdrawals.filter(w=>["requested","processing","paid"].includes(w.status)).reduce((s,w)=>s+Number(w.amount),0);
  const paid = withdrawals.filter(w=>w.status==="paid").reduce((s,w)=>s+Number(w.amount),0);
  return {earned, pending:Math.max(0,earned-released), available:Math.max(0,Math.round((released-reserved)*100)/100),paid,balanceDue:Math.round((released-reserved)*100)/100};
}
export const getAffiliateDashboard = createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context})=>{
    const est = await getOwnedEstablishment(context);
    const db = await adminDb();
    const account = await ensureAccount(db,est);
    const estId = est.establishment_id;
    const [referrals,commissions,withdrawals,assets,settings] = await Promise.all([
      db.from("affiliate_referrals").select("id,referred_establishment_id,registered_at,establishments!affiliate_referrals_referred_establishment_id_fkey(name)").eq("affiliate_establishment_id",estId).order("registered_at",{ascending:false}).limit(300),
      db.from("affiliate_commissions").select("id,referral_id,payment_id,amount,paid_base,rate,status,release_at,created_at").eq("affiliate_establishment_id",estId).order("created_at",{ascending:false}).limit(300),
      db.from("affiliate_withdrawals").select("id,amount,status,requested_at,processed_at,processed_by,proof_reference,notes").eq("establishment_id",estId).order("requested_at",{ascending:false}).limit(150),
      db.from("affiliate_assets").select("*").eq("establishment_id",estId).order("created_at",{ascending:false}).limit(75),
      db.from("affiliate_settings").select("default_rate,release_days").eq("id",true).single(),
    ]);
    for(const item of [referrals,commissions,withdrawals,assets,settings]) check(item.error);
    const balance=summarize(commissions.data??[],withdrawals.data??[]);
    return {establishmentId:estId,account,referrals:referrals.data??[],commissions:commissions.data??[],withdrawals:withdrawals.data??[],assets:assets.data??[],settings:settings.data,balance,registrations:referrals.data?.length??0,purchases:(commissions.data??[]).filter((c:any)=>c.status==="confirmed").length};
  });

export const updateAffiliateProfile = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({establishment_id:id,code:codeSchema,title:z.string().trim().max(90).optional().nullable()}).parse(v))
  .handler(async ({context,data})=>{
    const est=await getOwnedEstablishment(context,data.establishment_id);
    const db=await adminDb(); await ensureAccount(db,est);
    const {data:updated,error}=await db.from("affiliate_accounts")
      .update({code:data.code,custom_title:data.title??null,updated_at:new Date().toISOString()})
      .eq("establishment_id",est.establishment_id).select("*").single();
    if(error?.code==="23505") throw new Error("Este endereço já pertence a outro afiliado.");
    check(error);return updated;
  });

export const claimAffiliateReferral = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({code:codeSchema,establishment_id:id}).parse(v))
  .handler(async ({context,data})=>{
    const est=await getOwnedEstablishment(context,data.establishment_id);
    const created=Date.parse(est.establishment?.created_at??"");
    if(!Number.isFinite(created)||Date.now()-created>24*60*60*1000) throw new Error("A indicação deve ser associada ao novo cadastro.");
    const db=await adminDb();
    const {data:affiliate,error}=await db.from("affiliate_accounts").select("establishment_id,enabled").eq("code",data.code).maybeSingle();
    check(error);
    if(!affiliate?.enabled || affiliate.establishment_id===data.establishment_id) throw new Error("Código de indicação inválido.");
    // Não permitir que um mesmo titular indique suas próprias empresas.
    const {data:referrer,error:referrerError}=await db.from("establishments")
      .select("created_by").eq("id",affiliate.establishment_id).single();
    check(referrerError);
    if(referrer?.created_by===context.userId) throw new Error("Autoindicação não é permitida.");
    const {count,error:payError}=await db.from("payments").select("id",{count:"exact",head:true}).eq("establishment_id",data.establishment_id);
    check(payError);
    if(count && count>0) throw new Error("O cadastro já iniciou seu processo de pagamento.");
    const {data:inserted,error:insertError}=await db.from("affiliate_referrals").insert({
      affiliate_establishment_id:affiliate.establishment_id,referred_establishment_id:data.establishment_id
    }).select("id").single();
    if(insertError?.code==="23505") throw new Error("Este cadastro já possui uma indicação atribuída.");
    check(insertError);
    return {ok:true,referralId:inserted.id};
  });

export const saveAffiliateAsset = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({establishment_id:id,media_url:z.string().url().max(2000).refine((url)=>url.startsWith("https://"),"A mídia precisa usar HTTPS."),media_type:z.enum(["image","video"]),format:z.enum(["feed","story","reels","square","landscape"]),title:z.string().trim().max(90).default("")}).parse(v))
  .handler(async ({context,data})=>{
    await getOwnedEstablishment(context,data.establishment_id);
    const db=await adminDb();
    const {data:row,error}=await db.from("affiliate_assets").insert(data).select("*").single();check(error);return row;
  });

export const requestAffiliateWithdrawal = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({establishment_id:id,amount:z.number().positive().multipleOf(0.01),pix_key:z.string().trim().min(3).max(200)}).parse(v))
  .handler(async ({context,data})=>{
    await getOwnedEstablishment(context,data.establishment_id);
    const {data:withdrawal,error}=await (context.supabase as any).rpc("affiliate_request_withdrawal",{_est:data.establishment_id,_amount:data.amount,_pix:data.pix_key});
    check(error);return {withdrawal_id:withdrawal};
  });

export const getAdminAffiliates = createServerFn({method:"GET"})
  .middleware([requireSupabaseAuth])
  .handler(async ({context})=>{
    await assertSuperAdmin(context.supabase,context.userId);
    const db=await adminDb();
    const [accounts,refs,commissions,withdrawals,settings]=await Promise.all([
      db.from("affiliate_accounts").select("*,establishments:establishment_id(name,slug,created_by)").order("created_at",{ascending:false}).limit(1000),
      db.from("affiliate_referrals").select("id,affiliate_establishment_id,referred_establishment_id,registered_at,establishments!affiliate_referrals_referred_establishment_id_fkey(name)").order("registered_at",{ascending:false}).limit(1000),
      db.from("affiliate_commissions").select("*").order("created_at",{ascending:false}).limit(1000),
      db.from("affiliate_withdrawals").select("*").order("requested_at",{ascending:false}).limit(1000),
      db.from("affiliate_settings").select("*").eq("id",true).single(),
    ]);
    for(const item of [accounts,refs,commissions,withdrawals,settings])check(item.error);
    const affiliates=(accounts.data??[]).map((a:any)=>({
      ...a,registrations:(refs.data??[]).filter((r:any)=>r.affiliate_establishment_id===a.establishment_id).length,
      ...summarize((commissions.data??[]).filter((c:any)=>c.affiliate_establishment_id===a.establishment_id),
        (withdrawals.data??[]).filter((w:any)=>w.establishment_id===a.establishment_id))
    }));
    return {affiliates,referrals:refs.data??[],commissions:commissions.data??[],withdrawals:withdrawals.data??[],settings:settings.data};
  });

export const adminUpdateAffiliate = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({establishment_id:id,commission_rate:z.number().min(0).max(100).multipleOf(0.01).nullable(),enabled:z.boolean()}).parse(v))
  .handler(async ({context,data})=>{
    await assertSuperAdmin(context.supabase,context.userId);
    const db=await adminDb();
    const {data:row,error}=await db.from("affiliate_accounts").update({commission_rate:data.commission_rate,enabled:data.enabled,updated_at:new Date().toISOString()}).eq("establishment_id",data.establishment_id).select("*").single();
    check(error);return row;
  });

export const adminUpdateAffiliateSettings = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({default_rate:z.number().min(0).max(100).multipleOf(0.01),release_days:z.number().int().min(0).max(90)}).parse(v))
  .handler(async ({context,data})=>{
    await assertSuperAdmin(context.supabase,context.userId);
    const db=await adminDb();
    const {error}=await db.from("affiliate_settings").update({...data,updated_at:new Date().toISOString(),updated_by:context.userId}).eq("id",true);
    check(error);return {ok:true};
  });

export const adminFinalizeAffiliateWithdrawal = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({withdrawal_id:id,status:z.enum(["processing","paid","rejected"]),reference:z.string().trim().max(200).optional(),notes:z.string().trim().max(1000).optional()}).parse(v))
  .handler(async ({context,data})=>{
    await assertSuperAdmin(context.supabase,context.userId);
    const {error}=await (context.supabase as any).rpc("affiliate_admin_finalize_withdrawal",{
      _id:data.withdrawal_id,_action:data.status,_receipt:data.reference??null,_notes:data.notes??null
    });check(error);
    return {ok:true};
  });

export const adminNotifyAffiliate = createServerFn({method:"POST"})
  .middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({establishment_id:id,title:z.string().trim().min(4).max(120),body:z.string().trim().min(4).max(1000)}).parse(v))
  .handler(async ({context,data})=>{
    await assertSuperAdmin(context.supabase,context.userId);
    const db=await adminDb();
    const {data:est,error}=await db.from("establishments").select("id,created_by").eq("id",data.establishment_id).single();
    check(error);if(!est?.created_by) throw new Error("Responsável pelo estabelecimento não identificado.");
    const {error:notifyError}=await db.from("user_notifications").insert({
      user_id:est.created_by,establishment_id:est.id,audience:"merchant",kind:"affiliate",title:data.title,body:data.body,url:"/app/afiliados"
    });
    check(notifyError);return {ok:true};
  });
