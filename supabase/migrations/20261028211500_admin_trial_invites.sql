-- Convites de avaliacao Fidelize. Nenhuma tabela deste modulo e exposta ao cliente via Data API.
create table if not exists public.trial_invite_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (length(token) between 24 and 128),
  title text not null check (length(title) between 3 and 100),
  description text,
  plan_id uuid not null references public.plans(id),
  duration_days integer not null default 14 check (duration_days between 1 and 365),
  feature_keys text[] not null default '{}'::text[],
  max_signups integer not null default 1 check (max_signups between 1 and 500),
  signup_count integer not null default 0 check (signup_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trial_invite_links_created_at_idx on public.trial_invite_links(created_at desc);

create table if not exists public.trial_invite_visits (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.trial_invite_links(id) on delete cascade,
  visitor_id uuid not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  views integer not null default 1 check (views >= 1),
  unique(link_id, visitor_id)
);
create index if not exists trial_invite_visits_link_idx on public.trial_invite_visits(link_id, first_seen_at desc);

create table if not exists public.trial_invite_claims (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.trial_invite_links(id),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  visitor_id uuid not null,
  establishment_id uuid unique references public.establishments(id) on delete set null,
  claimed_at timestamptz not null default now(),
  started_at timestamptz,
  ends_at timestamptz
);
create index if not exists trial_invite_claims_link_idx on public.trial_invite_claims(link_id, claimed_at desc);

alter table public.trial_invite_links enable row level security;
alter table public.trial_invite_visits enable row level security;
alter table public.trial_invite_claims enable row level security;
revoke all on public.trial_invite_links,public.trial_invite_visits,public.trial_invite_claims from anon,authenticated;
grant select,insert,update,delete on public.trial_invite_links,public.trial_invite_visits,public.trial_invite_claims to service_role;

-- Ativacao atomica do convite: primeiro cadastro de empresa apos a visita, sem consumo por cliques.
create or replace function public.claim_trial_invite(_token text,_user uuid,_visitor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_link public.trial_invite_links%rowtype;
declare v_user_created timestamptz;
declare v_claim public.trial_invite_claims%rowtype;
begin
  select * into v_claim from public.trial_invite_claims where user_id=_user;
  if found then
    if v_claim.link_id=(select id from public.trial_invite_links where token=_token) then
      return jsonb_build_object('ok',true,'already_claimed',true);
    end if;
    raise exception 'Este cadastro ja utilizou outro convite de testes';
  end if;

  select u.created_at into v_user_created from auth.users u
  where u.id=_user and nullif(u.raw_user_meta_data->>'company_name','') is not null;
  if v_user_created is null then raise exception 'Convite exclusivo para novas contas de lojistas'; end if;

  select * into v_link from public.trial_invite_links where token=_token for update;
  if not found then raise exception 'Link de testes inexistente'; end if;
  if not v_link.active or (v_link.expires_at is not null and v_link.expires_at<=now())
      or v_link.signup_count>=v_link.max_signups then
    raise exception 'Este link de testes expirou ou esgotou as vagas';
  end if;
  if exists(select 1 from public.establishment_members m where m.user_id=_user and m.active) then
    raise exception 'O convite e exclusivo para novos lojistas';
  end if;
  if not exists (
    select 1 from public.trial_invite_visits v where v.link_id=v_link.id
      and v.visitor_id=_visitor and v.first_seen_at <= v_user_created
      and v.first_seen_at >= v_user_created - interval '7 days'
  ) then
    raise exception 'Visita de origem nao identificada ou cadastro anterior ao convite';
  end if;
  insert into public.trial_invite_claims (link_id,user_id,visitor_id)
  values(v_link.id,_user,_visitor);
  update public.trial_invite_links set signup_count=signup_count+1,updated_at=now()
  where id=v_link.id;
  return jsonb_build_object('ok',true,'claimed',true);
end $$;
revoke all on function public.claim_trial_invite(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_trial_invite(text,uuid,uuid) to service_role;

-- Vincula assinatura ao estabelecimento ja criado pelo fluxo padrao de onboarding.
create or replace function public.activate_trial_invite(_user uuid,_est uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare c public.trial_invite_claims%rowtype;
declare i public.trial_invite_links%rowtype;
declare p public.plans%rowtype;
declare v_existing public.subscriptions%rowtype;
declare v_ends timestamptz;
begin
  select * into c from public.trial_invite_claims where user_id=_user for update;
  if not found then return jsonb_build_object('activated',false,'reason','no_claim'); end if;
  if c.establishment_id is not null then
    return jsonb_build_object('activated',c.establishment_id=_est,'ends_at',c.ends_at);
  end if;
  if not exists (
    select 1 from public.establishments e join public.establishment_members m
      on m.establishment_id=e.id
    where e.id=_est and e.created_by=_user
      and m.user_id=_user and m.active and m.role='owner'
      and e.created_at >= c.claimed_at - interval '1 minute'
  ) then raise exception 'Estabelecimento nao pertence ao novo lojista'; end if;
  select * into i from public.trial_invite_links where id=c.link_id;
  select * into p from public.plans where id=i.plan_id;
  if p.id is null then raise exception 'Plano de teste nao encontrado'; end if;
  v_ends := now() + make_interval(days => i.duration_days);

  select * into v_existing from public.subscriptions where establishment_id=_est for update;
  if found and v_existing.provider is distinct from 'trial_invite'
     and v_existing.status='active' and v_existing.current_period_end>now() then
    return jsonb_build_object('activated',false,'reason','paid_subscription');
  end if;
  if v_existing.id is null then
    insert into public.subscriptions (establishment_id,plan_id,tier,status,provider,current_period_start,current_period_end,trial_ends_at,metadata)
    values(_est,p.id,p.tier,'trialing','trial_invite',now(),v_ends,v_ends,
      jsonb_build_object('trial_invite_id',i.id,'trial_days',i.duration_days));
  else
    update public.subscriptions set plan_id=p.id,tier=p.tier,status='trialing',
      provider='trial_invite',current_period_start=now(),current_period_end=v_ends,
      trial_ends_at=v_ends,cancel_at_period_end=false,
      metadata=jsonb_build_object('trial_invite_id',i.id,'trial_days',i.duration_days),
      updated_at=now()
    where id=v_existing.id;
  end if;
  update public.establishments set plan=p.tier where id=_est;
  update public.trial_invite_claims set establishment_id=_est,started_at=now(),ends_at=v_ends
  where id=c.id;
  return jsonb_build_object('activated',true,'ends_at',v_ends,'tier',p.tier);
end $$;
revoke all on function public.activate_trial_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.activate_trial_invite(uuid,uuid) to service_role;

-- Durante o trial, somente os recursos explicitamente selecionados no convite.
-- Assinaturas pagas e cortesia continuam com o comportamento anterior.
create or replace function public.has_plan_feature_strict(_est uuid, _feature text)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select case when exists(
    select 1 from public.subscriptions s where s.establishment_id=_est
      and s.provider='trial_invite' and s.status in ('trial','trialing')
  ) then coalesce((
    select _feature=any(i.feature_keys) and s.current_period_end>now()
      from public.subscriptions s
      join public.trial_invite_claims c on c.establishment_id=s.establishment_id
      join public.trial_invite_links i on i.id=c.link_id
      where s.establishment_id=_est and s.provider='trial_invite' and s.status in ('trial','trialing')
      limit 1
  ),false)
  else coalesce((
    select pf.enabled from public.plan_features pf
      join public.plans p on p.id=pf.plan_id
      join public.establishments e on e.id=_est
      where p.tier=e.plan and pf.feature_key=_feature limit 1
  ),false) end;
$$;

create or replace function public.has_plan_feature(_est uuid,_feature text)
returns boolean language sql stable security definer set search_path to 'public'
as $$
 select public.is_super_admin(auth.uid()) or
   case when exists(select 1 from public.subscriptions where establishment_id=_est
                    and provider='trial_invite' and status in ('trial','trialing'))
     then public.has_plan_feature_strict(_est,_feature)
     else public.has_plan_feature_strict(_est,_feature) or exists(
       select 1 from public.establishment_feature_overrides o
       where o.establishment_id=_est and o.feature_key=_feature and o.enabled=true
         and (o.expires_at is null or o.expires_at>now()))
   end;
$$;

-- Nao aplica a tolerancia de tres dias das assinaturas pagas aos convites de testes.
create or replace function public.has_active_subscription(_est uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select public.is_super_admin(auth.uid()) or coalesce((
    select e.active and e.archived_at is null and exists (
      select 1 from public.subscriptions s where s.establishment_id=e.id
        and s.status in ('active','trial','trialing')
        and (
          (s.provider='trial_invite' and s.current_period_end>now())
          or (s.provider is distinct from 'trial_invite'
              and (s.current_period_end is null or s.current_period_end>now()-interval '3 days'))
        )
    ) from public.establishments e where e.id=_est
  ),false);
$$;