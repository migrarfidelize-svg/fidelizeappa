#!/usr/bin/env node
/**
 * One-time secure Kariny Nails provisioning on the Fidelize VPS.
 *
 * Usage:
 *   cd /var/www/<release-directory>
 *   read -rsp "Senha inicial da Kariny: " KARINY_INITIAL_PASSWORD; echo
 *   export KARINY_INITIAL_PASSWORD
 *   node --env-file=.env scripts/provision-kariny-nails-20261103.mjs
 *   unset KARINY_INITIAL_PASSWORD
 *
 * Only uses the service key in a server-side process. Never commit passwords.
 * Safe to re-run if provisioning was interrupted: existing users/passwords,
 * paid subscriptions, media and previously uploaded content are preserved.
 */
import { createClient } from "@supabase/supabase-js";

const email = "karinynails@fidelize.app";
const slug = "kariny-nails";
const name = "Kariny Nails";
const phone = "5562981006469";
const message = "Olá, Kariny! Vim pelo seu link e gostaria de conhecer melhor seus serviços e consultar os horários disponíveis. Pode me ajudar?";
const whatsapp = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
const password = process.env.KARINY_INITIAL_PASSWORD;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !password) throw new Error("Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e KARINY_INITIAL_PASSWORD.");
if (password.length < 6) throw new Error("Senha inicial não atende ao mínimo de segurança.");
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => {
      const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
      if (init?.headers) new Headers(init.headers).forEach((v,k) => headers.set(k,v));
      if (/^sb_(?:secret|publishable)_/.test(key) && headers.get("Authorization") === "Bearer " + key) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input,{ ...init, headers });
    }
  }
});

function assertOk(result, label) {
  if (result.error) throw new Error(label + ": " + result.error.message);
  return result.data;
}

async function findAccount() {
  for (let page=1;page<=20;page++) {
    const result=await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users=assertOk(result,"Consulta de usuários").users ?? [];
    const found=users.find(u=>u.email?.toLowerCase()===email);
    if(found)return found;
    if(users.length<1000)break;
  }
  return null;
}

async function main() {
  // Check slug conflicts before creating auth accounts.
  const existingBusiness = assertOk(await supabase.from("establishments")
    .select("id,created_by").eq("slug",slug).maybeSingle(),"Verificar estabelecimento");
  const reservedPage = assertOk(await supabase.from("link_tree_pages")
    .select("id,establishment_id").eq("public_slug",slug).maybeSingle(),"Verificar slug público");

  let user=await findAccount();
  if(existingBusiness && user && existingBusiness.created_by!==user.id) throw new Error("O slug kariny-nails pertence a outro usuário.");
  if(existingBusiness && !user) throw new Error("Já existe estabelecimento com este slug sem a conta correspondente; revise manualmente.");
  if(reservedPage && (!existingBusiness || reservedPage.establishment_id!==existingBusiness.id)) throw new Error("O link público kariny-nails já pertence a outro negócio.");

  const plan = assertOk(await supabase.from("plans").select("id,tier").eq("tier","enterprise")
    .eq("is_active",true).limit(1).maybeSingle(),"Localizar plano premium");
  if(!plan?.id) throw new Error("Plano enterprise ativo não encontrado; nada será criado.");

  if(!user) {
    const r=await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: "Kariny Nails" }
    });
    user=assertOk(r,"Criar login").user;
    if(!user?.id)throw new Error("Supabase não retornou ID do usuário criado.");
    console.log("Acesso Auth criado.");
  } else console.log("Acesso Auth já existente; senha preservada.");

  assertOk(await supabase.from("profiles").upsert(
    {id:user.id,full_name:name,account_type:"establishment"},{onConflict:"id"}
  ),"Configurar perfil lojista");

  let business=existingBusiness;
  if(!business) {
    business=assertOk(await supabase.from("establishments").insert({
      slug,name,created_by:user.id,active:true,plan:"enterprise",
      segment:"Beleza e Nail Design",
      description:"Nail Design Studio. Atendimento e horários disponíveis mediante consulta.",
      whatsapp:phone,phone,
      primary_color:"#231823",accent_color:"#D9A8B6"
    }).select("id,created_by").single(),"Criar estabelecimento");
    console.log("Estabelecimento criado.");
  }
  if(business.created_by!==user.id)throw new Error("Proprietário incorreto; criação interrompida.");

  const membership=assertOk(await supabase.from("establishment_members")
    .select("id,role,active").eq("user_id",user.id).eq("establishment_id",business.id).maybeSingle(),
    "Verificar vínculo");
  if(!membership) assertOk(await supabase.from("establishment_members").insert({
    user_id:user.id,establishment_id:business.id,role:"owner",active:true
  }),"Criar vínculo do proprietário");
  else if(membership.role!=="owner"||!membership.active)throw new Error("Vínculo existente diverge de proprietário ativo; revise manualmente.");

  const existingSubscription=assertOk(await supabase.from("subscriptions").select("id,status,provider")
    .eq("establishment_id",business.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    "Verificar assinatura");
  if(!existingSubscription) {
    const start=new Date(), end=new Date(start.getTime()+30*24*60*60*1000);
    assertOk(await supabase.from("subscriptions").insert({
      establishment_id:business.id,plan_id:plan.id,tier:"enterprise",
      provider:"manual_promo",status:"trialing",
      current_period_start:start.toISOString(),
      current_period_end:end.toISOString(),
      trial_ends_at:end.toISOString(),
      metadata:{reason:"premium_demo",source:"fidelize_admin",campaign:"kariny-nails-premium-30d"}
    }),"Ativar teste premium 30 dias");
    console.log("Teste premium de 30 dias registrado, sem cobrança.");
  } else console.log("Assinatura existente preservada.");

  let page=assertOk(await supabase.from("link_tree_pages").select("id")
    .eq("establishment_id",business.id).maybeSingle(),"Verificar Bio Commerce");
  if(!page) {
    page=assertOk(await supabase.from("link_tree_pages").insert({
      establishment_id:business.id,public_slug:slug,
      title:name,description:"Unhas que expressam seu estilo. Agende seu momento com Kariny Nails.",
      published:true,published_at:new Date().toISOString(),
      theme:{
        preset_id:"kariny-nails-editorial-2026",
        primary:"#231823",accent:"#D9A8B6",background:"#120D14",text:"#FFF9F5",
        rounded:"xl",button_style:"glass",portfolio:[]
      },
      social:{whatsapp:phone}
    }).select("id").single(),"Criar Bio Commerce");
    console.log("Página exclusiva publicada com galeria preparada para fotos reais.");
  } else console.log("Bio Commerce existente preservado.");

  const linkExists=assertOk(await supabase.from("link_tree_links")
    .select("id").eq("page_id",page.id).eq("kind","whatsapp").limit(1).maybeSingle(),
    "Verificar botão WhatsApp");
  if(!linkExists)assertOk(await supabase.from("link_tree_links").insert({
    page_id:page.id,kind:"whatsapp",label:"Agendar pelo WhatsApp",url:whatsapp,
    enabled:true,sort_order:0,data:{source:"kariny-nails",message}
  }),"Criar CTA WhatsApp");

  const [memberCheck, pageCheck, subscriptionCheck]=await Promise.all([
    supabase.from("establishment_members").select("id").eq("user_id",user.id).eq("establishment_id",business.id).eq("role","owner").eq("active",true).maybeSingle(),
    supabase.from("link_tree_pages").select("id,published,public_slug").eq("establishment_id",business.id).maybeSingle(),
    supabase.from("subscriptions").select("status,current_period_end").eq("establishment_id",business.id).limit(1).maybeSingle()
  ]);
  if(memberCheck.error||!memberCheck.data||pageCheck.error||!pageCheck.data?.published||subscriptionCheck.error||!subscriptionCheck.data)
    throw new Error("Validação incompleta; verifique o Supabase antes de compartilhar o link.");
  console.log("CONCLUÍDO: conta lojista e Bio Commerce validados.");
  console.log("Login: "+email);
  console.log("Página: https://afidelize.app/links/"+slug);
  console.log("WhatsApp: "+whatsapp);
  console.log("PORTFÓLIO: aguarda imagens reais. Instagram: aguarda @ confirmado.");
}

main().catch(err => { console.error("FALHA: "+(err?.message??err)); process.exitCode=1; });
