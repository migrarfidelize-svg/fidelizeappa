ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute integer NOT NULL DEFAULT 120;

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  key_prefix text,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  ip text,
  origin text,
  user_agent text,
  duration_ms integer,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_request_logs_key_time_idx ON public.api_request_logs (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_est_time_idx ON public.api_request_logs (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_ip_time_idx ON public.api_request_logs (ip, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_request_logs_read" ON public.api_request_logs;
CREATE POLICY "api_request_logs_read"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));