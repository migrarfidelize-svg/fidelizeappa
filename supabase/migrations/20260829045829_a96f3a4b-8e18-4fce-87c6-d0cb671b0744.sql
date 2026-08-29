CREATE TABLE IF NOT EXISTS public.autologin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  establishment_id uuid,
  email text NOT NULL,
  api_key_id uuid,
  source text,
  issued_ip text,
  used_ip text,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS autologin_tokens_expires_idx ON public.autologin_tokens (expires_at);
CREATE INDEX IF NOT EXISTS autologin_tokens_user_idx ON public.autologin_tokens (user_id);

GRANT ALL ON public.autologin_tokens TO service_role;

ALTER TABLE public.autologin_tokens ENABLE ROW LEVEL SECURITY;