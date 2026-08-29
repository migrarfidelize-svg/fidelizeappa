DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ')
    INTO cols
  FROM pg_attribute
  WHERE attrelid = 'public.establishments'::regclass
    AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('cnpj', 'razao_social', 'average_ticket');

  EXECUTE 'REVOKE SELECT ON public.establishments FROM authenticated';
  EXECUTE format('GRANT SELECT (%s) ON public.establishments TO authenticated', cols);
END $$;