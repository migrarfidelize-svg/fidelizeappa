REVOKE ALL ON TABLE public.admin_area_locks FROM anon;

REVOKE SELECT (cnpj, razao_social, average_ticket) ON public.establishments FROM authenticated;
REVOKE SELECT (cnpj, razao_social, average_ticket) ON public.establishments FROM anon;

REVOKE SELECT ON public.campaigns FROM anon;
GRANT SELECT (id, establishment_id, name, type, stamps_required, reward_title,
              reward_description, rules, stamp_icon, stamp_validity_days,
              reward_validity_days, active, primary_color, accent_color, created_at)
  ON public.campaigns TO anon;

REVOKE SELECT ON public.wallet_settings FROM anon;
GRANT SELECT (establishment_id, google_enabled, apple_enabled, logo_url, hero_image_url,
              background_color, foreground_color, label_color, front_text, back_text,
              custom_message, show_qr, show_barcode, barcode_format, fields, validity_days)
  ON public.wallet_settings TO anon;

REVOKE SELECT ON public.sponsored_ad_settings FROM anon, authenticated;
GRANT SELECT (id, allowed_categories, advertiser_terms, advertiser_terms_version,
              allow_self_pause, self_pause_extends_period, max_ads_per_category,
              pix_expiration_minutes)
  ON public.sponsored_ad_settings TO authenticated;

REVOKE EXECUTE ON FUNCTION public.acquire_crm_lock(uuid, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_crm_lock(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_establishment_access(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_automation_jobs(text, integer) FROM anon, authenticated;