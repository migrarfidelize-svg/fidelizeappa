-- Fidelize: merchant affiliate commissions paid ONLY for real approved plan purchases.
-- Never assign a payout on click, registration, trial, or pending invoice.
create table if not exists public.affiliate_settings (
  id boolean primary key default true check (id = true),
  default_rate numeric(5,2) not null default 10 check (default_rate between 0 and 100),
  release_days integer not null default 7 check (release_days between 0 and 90),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.affiliate_settings(id) values (true) on conflict do nothing;

create table if not exists public.affiliate_accounts (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{3,39}$'),
  custom_title text,
  commission_rate numeric(5,2) check (commission_rate between 0 and 100),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_establishment_id uuid not null references public.affiliate_accounts(establishment_id),
  referred_establishment_id uuid not null unique references public.establishments(id),
  registered_at timestamptz not null default now(),
  constraint affiliate_no_self_referral check (affiliate_establishment_id <> referred_establishment_id)
);
create index if not exists affiliate_referrals_owner_idx on public.affiliate_referrals(affiliate_establishment_id);

create table if not exists public.affiliate_assets (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.affiliate_accounts(establishment_id) on delete cascade,
  media_url text not null check (length(media_url) between 8 and 2000),
  media_type text not null check (media_type in ('image','video')),
  format text not null check (format in ('feed','story','reels','square','landscape')),
  title text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists affiliate_assets_owner_idx on public.affiliate_assets(establishment_id);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null unique references public.affiliate_referrals(id),
  affiliate_establishment_id uuid not null references public.affiliate_accounts(establishment_id),
  payment_id uuid not null unique references public.payments(id),
  amount numeric(12,2) not null check (amount >= 0),
  paid_base numeric(12,2) not null check (paid_base > 0),
  rate numeric(5,2) not null check (rate between 0 and 100),
  status text not null default 'confirmed' check (status in ('confirmed','reversed')),
  release_at timestamptz not null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz
);
create index if not exists affiliate_commissions_owner_idx on public.affiliate_commissions(affiliate_establishment_id,release_at);

create table if not exists public.affiliate_withdrawals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.affiliate_accounts(establishment_id),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'requested' check (status in ('requested','processing','paid','rejected')),
  pix_key text not null check(length(trim(pix_key)) between 3 and 200),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  processed_by uuid references auth.users(id),
  processed_at timestamptz,
  proof_reference text,
  notes text
);
create index if not exists affiliate_withdrawals_owner_idx on public.affiliate_withdrawals(establishment_id,requested_at desc);

-- Read-only to signed in merchants and admins. No direct client writes on financial ledgers.
alter table public.affiliate_settings enable row level security;
alter table public.affiliate_accounts enable row level security;
alter table public.affiliate_referrals enable row level security;
alter table public.affiliate_assets enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.affiliate_withdrawals enable row level security;
create policy affiliate_settings_read on public.affiliate_settings for select to authenticated using (true);
create policy affiliate_accounts_read on public.affiliate_accounts for select to authenticated using (
  exists (select 1 from public.establishment_members m where m.establishment_id=affiliate_accounts.establishment_id and m.user_id=(select auth.uid()) and m.active)
  or exists (select 1 from public.app_roles ar where ar.user_id=(select auth.uid()) and ar.role::text='super_admin')
);
create policy affiliate_referrals_read on public.affiliate_referrals for select to authenticated using (
  exists (select 1 from public.establishment_members m where m.establishment_id=affiliate_referrals.affiliate_establishment_id and m.user_id=(select auth.uid()) and m.active)
  or exists (select 1 from public.app_roles ar where ar.user_id=(select auth.uid()) and ar.role::text='super_admin')
);
create policy affiliate_assets_read on public.affiliate_assets for select to authenticated using (
  exists (select 1 from public.establishment_members m where m.establishment_id=affiliate_assets.establishment_id and m.user_id=(select auth.uid()) and m.active)
  or exists (select 1 from public.app_roles ar where ar.user_id=(select auth.uid()) and ar.role::text='super_admin')
);
create policy affiliate_commissions_read on public.affiliate_commissions for select to authenticated using (
  exists (select 1 from public.establishment_members m where m.establishment_id=affiliate_commissions.affiliate_establishment_id and m.user_id=(select auth.uid()) and m.active)
  or exists (select 1 from public.app_roles ar where ar.user_id=(select auth.uid()) and ar.role::text='super_admin')
);
create policy affiliate_withdrawals_read on public.affiliate_withdrawals for select to authenticated using (
  exists (select 1 from public.establishment_members m where m.establishment_id=affiliate_withdrawals.establishment_id and m.user_id=(select auth.uid()) and m.active)
  or exists (select 1 from public.app_roles ar where ar.user_id=(select auth.uid()) and ar.role::text='super_admin')
);
grant select on public.affiliate_settings,public.affiliate_accounts,public.affiliate_referrals,public.affiliate_assets,public.affiliate_commissions,public.affiliate_withdrawals to authenticated;
revoke insert,update,delete on public.affiliate_settings,public.affiliate_accounts,public.affiliate_referrals,public.affiliate_assets,public.affiliate_commissions,public.affiliate_withdrawals from anon,authenticated;

-- Every gateway reconciliation updates payments; a single idempotent DB trigger handles MP and Asaas.
-- Payment must belong to a paid plan, carry a provider reference, and have an ACTIVE subscription.
create or replace function public.affiliate_reconcile_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.affiliate_referrals%rowtype;
  a public.affiliate_accounts%rowtype;
  s public.affiliate_settings%rowtype;
  v_rate numeric(5,2);
  v_approved timestamptz;
begin
  if new.status in ('refunded','charged_back','cancelled') then
    update public.affiliate_commissions set status='reversed',reversed_at=now()
      where payment_id=new.id and status='confirmed';
    return new;
  end if;
  if new.status <> 'approved' or new.approved_at is null
     or new.amount <= 0 or new.currency <> 'BRL'
     or (new.provider_payment_id is null and new.mp_payment_id is null)
     or new.subscription_id is null or new.plan_id is null then return new; end if;
  if not exists(select 1 from public.subscriptions sub where sub.id=new.subscription_id
    and sub.establishment_id=new.establishment_id and sub.plan_id=new.plan_id and sub.status='active')
    then return new; end if;
  select * into r from public.affiliate_referrals where referred_establishment_id=new.establishment_id;
  if not found then return new; end if;
  select * into a from public.affiliate_accounts where establishment_id=r.affiliate_establishment_id and enabled=true;
  if not found then return new; end if;
  select * into s from public.affiliate_settings where id=true;
  v_rate := coalesce(a.commission_rate,s.default_rate,0);
  if v_rate <= 0 then return new; end if;
  v_approved := new.approved_at;
  insert into public.affiliate_commissions(referral_id,affiliate_establishment_id,payment_id,amount,paid_base,rate,release_at)
    values(r.id,r.affiliate_establishment_id,new.id,round(new.amount*v_rate/100,2),new.amount,v_rate,
      v_approved+make_interval(days=>coalesce(s.release_days,7)))
    on conflict do nothing;
  return new;
end $$;
drop trigger if exists affiliate_payment_conversion on public.payments;
create trigger affiliate_payment_conversion after insert or update of status,approved_at,subscription_id,plan_id on public.payments
 for each row execute function public.affiliate_reconcile_payment();

-- Manual withdrawal reserve: under row lock, existing requested/processing/paid are already deducted.
create or replace function public.affiliate_request_withdrawal(_est uuid,_amount numeric,_pix text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_earned numeric(12,2); v_reserved numeric(12,2); v_id uuid;
begin
 if auth.uid() is null or not exists(
   select 1 from public.establishment_members m where m.establishment_id=_est
     and m.user_id=auth.uid() and m.active and m.role::text='owner'
 ) then raise exception 'Sem permissão'; end if;
 if _amount is null or _amount<=0 or _amount<>round(_amount,2) or length(trim(coalesce(_pix,''))) not between 3 and 200
   then raise exception 'Saque inválido'; end if;
 perform 1 from public.affiliate_accounts a where a.establishment_id=_est and a.enabled=true for update;
 if not found then raise exception 'Afiliado desativado'; end if;
 select coalesce(sum(c.amount),0) into v_earned from public.affiliate_commissions c
  where c.affiliate_establishment_id=_est and c.status='confirmed' and c.release_at<=now();
 select coalesce(sum(w.amount),0) into v_reserved from public.affiliate_withdrawals w
  where w.establishment_id=_est and w.status in ('requested','processing','paid');
 if _amount > greatest(0,v_earned-v_reserved) then raise exception 'Saldo insuficiente'; end if;
 insert into public.affiliate_withdrawals(establishment_id,amount,pix_key,requested_by)
 values (_est,_amount,trim(_pix),auth.uid()) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.affiliate_request_withdrawal(uuid,numeric,text) from public,anon;
grant execute on function public.affiliate_request_withdrawal(uuid,numeric,text) to authenticated;

create or replace function public.affiliate_admin_finalize_withdrawal(_id uuid,_action text,_receipt text default null,_notes text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_withdrawal public.affiliate_withdrawals%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from public.app_roles where user_id=auth.uid() and role::text='super_admin')
   then raise exception 'Acesso exclusivo do administrador'; end if;
 if _action not in ('paid','rejected','processing') then raise exception 'Ação inválida'; end if;
 select * into v_withdrawal from public.affiliate_withdrawals where id=_id for update;
 if not found then raise exception 'Solicitação não encontrada'; end if;
 if v_withdrawal.status not in ('requested','processing') then raise exception 'Solicitação já finalizada'; end if;
 if _action='paid' and length(trim(coalesce(_receipt,'')))<3 then raise exception 'Informe comprovante ou referência da transferência'; end if;
 update public.affiliate_withdrawals set status=_action,
   processed_by=auth.uid(),processed_at=case when _action in ('paid','rejected') then now() else null end,
   proof_reference=case when _action='paid' then trim(_receipt) else null end,notes=left(_notes,1000) where id=_id;
 return true;
end $$;
revoke all on function public.affiliate_admin_finalize_withdrawal(uuid,text,text,text) from public,anon;
grant execute on function public.affiliate_admin_finalize_withdrawal(uuid,text,text,text) to authenticated;
