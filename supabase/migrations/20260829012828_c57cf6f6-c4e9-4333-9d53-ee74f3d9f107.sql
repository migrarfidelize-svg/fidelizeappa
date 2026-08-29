ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS sandbox boolean NOT NULL DEFAULT false;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS requests_count bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS api_request_logs_est_created_idx ON public.api_request_logs (establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_key_created_idx ON public.api_request_logs (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS api_request_logs_status_idx ON public.api_request_logs (status_code);

DROP TRIGGER IF EXISTS api_request_logs_immutable ON public.api_request_logs;
CREATE TRIGGER api_request_logs_immutable
BEFORE UPDATE OR DELETE ON public.api_request_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();