-- Migração aditiva e recurso desligado por padrão; não mexe em cartões, carimbos ou saldo.
ALTER TABLE public.wallet_settings
  ADD COLUMN IF NOT EXISTS proximity_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proximity_latitude double precision,
  ADD COLUMN IF NOT EXISTS proximity_longitude double precision,
  ADD COLUMN IF NOT EXISTS proximity_message varchar(120);

ALTER TABLE public.wallet_settings
  ADD CONSTRAINT wallet_settings_proximity_coords_valid CHECK (
    NOT proximity_enabled OR (
      proximity_latitude IS NOT NULL AND proximity_longitude IS NOT NULL
      AND proximity_latitude BETWEEN -90 AND 90
      AND proximity_longitude BETWEEN -180 AND 180
    )
  );
