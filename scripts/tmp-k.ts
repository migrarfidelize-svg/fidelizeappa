const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const r = await supabaseAdmin.from("api_keys").select("id,name,is_active,key_type,establishment_id").limit(15);
console.log(JSON.stringify(r,null,1).slice(0,2000));
