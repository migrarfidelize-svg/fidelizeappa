const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const { data } = await supabaseAdmin.from("api_keys").select("id,name,is_active,key_type,scopes,establishment_id").order("created_at",{ascending:false}).limit(15);
console.log(JSON.stringify(data,null,1));
