DROP POLICY IF EXISTS "courier_reviews_public_approved_read" ON public.courier_reviews;
DROP VIEW IF EXISTS public.view_public_courier_reviews;

CREATE VIEW public.view_public_courier_reviews AS
  SELECT id, courier_id, author_name, rating, comment, created_at
  FROM public.courier_reviews
  WHERE is_approved = true;

GRANT SELECT ON public.view_public_courier_reviews TO anon, authenticated;