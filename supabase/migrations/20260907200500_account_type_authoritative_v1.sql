-- Unifica a identidade principal da conta usada pelo roteamento.
-- profiles.account_type define customer/establishment.
-- super_admin continua exigindo app_roles para não confiar em um campo de perfil.
-- establishment_members permanece como vínculo/autorização e fallback legado.

CREATE OR REPLACE FUNCTION public.my_account_type()
RETURNS public.account_type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  declared_type public.account_type;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.app_roles
    WHERE user_id = uid
      AND role = 'super_admin'
  ) THEN
    RETURN 'super_admin';
  END IF;

  SELECT p.account_type
    INTO declared_type
  FROM public.profiles p
  WHERE p.id = uid;

  IF declared_type = 'establishment' THEN
    RETURN 'establishment';
  END IF;

  IF declared_type = 'customer' THEN
    RETURN 'customer';
  END IF;

  -- Fallback apenas para contas legadas sem classificação útil no profile.
  IF EXISTS (
    SELECT 1
    FROM public.establishment_members
    WHERE user_id = uid
      AND active = true
  ) THEN
    RETURN 'establishment';
  END IF;

  RETURN 'customer';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_account_type() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_type() TO authenticated, service_role;

COMMENT ON FUNCTION public.my_account_type() IS
  'Resolve o tipo principal da conta: super_admin por app_roles; customer/establishment por profiles.account_type; membership apenas como fallback legado.';
