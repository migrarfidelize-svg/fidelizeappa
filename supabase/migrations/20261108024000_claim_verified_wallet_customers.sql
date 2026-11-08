-- Fidelize: vinculo seguro dos clientes de loja apos OTP confirmado.
-- Esta migration fica em GitHub e NAO e executada em producao nesta etapa.
-- Apenas service_role pode executar; usuario nao pode escolher outro user_id.
-- Mantem customers existentes, carimbos, recompensas e historico sem resets.

create or replace function public.claim_verified_wallet_customers(
  p_user_id uuid,
  p_phone text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_phone text;
  v_claimed integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Somente o servico de autenticacao pode vincular carteiras';
  end if;
  if p_user_id is null or not exists (
    select 1 from auth.users u where u.id = p_user_id
  ) then
    raise exception 'Usuario de autenticacao invalido';
  end if;

  v_digits := pg_catalog.regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  v_phone := case
    when left(v_digits,2) = '55' and length(v_digits) in (12,13)
    then substr(v_digits,3)
    else v_digits
  end;
  if length(v_phone) not in (10,11) then
    raise exception 'Telefone nao elegivel para vinculacao';
  end if;

  -- Serialize repeticoes do mesmo login OTP; nunca converte cadastros de
  -- outra conta e preserva a unicidade (establishment_id, user_id).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user_id::text));

  with candidates as (
    select
      c.id, c.establishment_id,
      row_number() over (
        partition by c.establishment_id
        order by c.created_at asc, c.id asc
      ) as rank_within_store
    from public.customers c
    where c.user_id is null
      and (
        case
          when left(pg_catalog.regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),2)='55'
            and length(pg_catalog.regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')) in (12,13)
          then substr(pg_catalog.regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),3)
          else pg_catalog.regexp_replace(coalesce(c.phone,''),'[^0-9]','','g')
        end
      ) = v_phone
      and not exists (
        select 1 from public.customers current_card
        where current_card.establishment_id = c.establishment_id
          and current_card.user_id = p_user_id
      )
  ),
  selected as (
    select id from candidates where rank_within_store = 1
  )
  update public.customers c
  set user_id = p_user_id
  from selected
  where c.id = selected.id
    and c.user_id is null;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

revoke all on function public.claim_verified_wallet_customers(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_verified_wallet_customers(uuid,text) to service_role;

comment on function public.claim_verified_wallet_customers(uuid,text) is
  'Vincula registros orfaos por telefone apenas apos OTP WhatsApp verificado no backend; exclusivo service_role.';
