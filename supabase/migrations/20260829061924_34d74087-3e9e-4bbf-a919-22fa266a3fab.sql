-- 1. platform_fees: somente super admin
DROP POLICY IF EXISTS "platform_fees_read_auth" ON public.platform_fees;

-- 2. sponsored_ad_settings: admin ou lojista
DROP POLICY IF EXISTS "ads_settings_read_authenticated" ON public.sponsored_ad_settings;
CREATE POLICY "ads_settings_read_merchants" ON public.sponsored_ad_settings
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_establishment_user(auth.uid()));

-- 3. courier_reviews: view pública sem author_user_id
DROP POLICY IF EXISTS "courier_reviews_public_read" ON public.courier_reviews;

CREATE POLICY "courier_reviews_owner_read" ON public.courier_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR author_user_id = auth.uid()
    OR courier_id = public.my_courier_id()
    OR (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id))
  );

CREATE OR REPLACE VIEW public.view_public_courier_reviews
WITH (security_invoker = on) AS
  SELECT id, courier_id, author_name, rating, comment, created_at
  FROM public.courier_reviews
  WHERE is_approved = true;

CREATE POLICY "courier_reviews_public_approved_read" ON public.courier_reviews
  FOR SELECT TO anon
  USING (is_approved = true);

GRANT SELECT ON public.view_public_courier_reviews TO anon, authenticated;
REVOKE SELECT ON public.courier_reviews FROM anon;