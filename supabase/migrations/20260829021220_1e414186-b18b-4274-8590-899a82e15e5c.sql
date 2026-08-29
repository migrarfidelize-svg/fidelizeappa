ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS key_type text NOT NULL DEFAULT 'browser';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_key_type_check'
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_key_type_check CHECK (key_type IN ('browser', 'server'));
  END IF;
END $$;

UPDATE public.api_keys
SET key_type = 'server'
WHERE name = 'Ronnei na Veia';