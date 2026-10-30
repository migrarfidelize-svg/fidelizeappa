-- Vincula os criativos à prévia pública do link de indicação.
ALTER TABLE public.affiliate_assets
  ADD COLUMN IF NOT EXISTS preview_url text;
ALTER TABLE public.affiliate_accounts
  ADD COLUMN IF NOT EXISTS featured_asset_id uuid
  REFERENCES public.affiliate_assets(id) ON DELETE SET NULL;

-- Preserva uploads existentes: primeira imagem disponível vira capa do link.
UPDATE public.affiliate_accounts AS a
SET featured_asset_id = (
  SELECT asset.id
  FROM public.affiliate_assets AS asset
  WHERE asset.establishment_id=a.establishment_id AND asset.media_type='image'
  ORDER BY asset.created_at DESC,asset.id DESC
  LIMIT 1
)
WHERE a.featured_asset_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.affiliate_assets AS asset
    WHERE asset.establishment_id=a.establishment_id AND asset.media_type='image'
  );

-- O destaque sempre precisa pertencer ao mesmo estabelecimento do afiliado.
CREATE OR REPLACE FUNCTION public.affiliate_validate_featured_asset()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.featured_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.affiliate_assets asset
    WHERE asset.id=NEW.featured_asset_id
      AND asset.establishment_id=NEW.establishment_id
  ) THEN
    RAISE EXCEPTION 'O criativo destacado deve pertencer ao afiliado.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS affiliate_featured_asset_owner ON public.affiliate_accounts;
CREATE TRIGGER affiliate_featured_asset_owner
BEFORE INSERT OR UPDATE OF featured_asset_id,establishment_id
ON public.affiliate_accounts FOR EACH ROW
EXECUTE FUNCTION public.affiliate_validate_featured_asset();
