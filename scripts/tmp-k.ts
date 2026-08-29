const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const r = await supabaseAdmin.from("api_keys").select("*").limit(20);
console.log(JSON.stringify((r.data??[]).map((k:any)=>({id:k.id,name:k.name,status:k.status,revoked_at:k.revoked_at,key_type:k.key_type,est:k.establishment_id,scopes:k.scopes})),null,1));
