DROP POLICY IF EXISTS "Anon can read non-hidden reviews of active establishments" ON public.customer_reviews;
REVOKE SELECT ON public.customer_reviews FROM anon;