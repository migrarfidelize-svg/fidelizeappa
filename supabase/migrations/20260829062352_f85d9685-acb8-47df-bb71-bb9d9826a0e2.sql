DROP VIEW IF EXISTS public.view_public_courier_reviews;

CREATE VIEW public.view_public_courier_reviews
WITH (security_invoker = on) AS
  SELECT id, courier_id, author_name, rating, comment, created_at
  FROM public.courier_reviews
  WHERE is_approved = true;

CREATE POLICY "courier_reviews_public_approved_read" ON public.courier_reviews
  FOR SELECT TO anon
  USING (is_approved = true);

GRANT SELECT (id, courier_id, author_name, rating, comment, created_at, is_approved)
  ON public.courier_reviews TO anon;
GRANT SELECT ON public.view_public_courier_reviews TO anon, authenticated;