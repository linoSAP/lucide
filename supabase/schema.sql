-- Lucide: schema de base + migration tolerante pour projets existants.
-- Ce fichier peut etre rejoue dans Supabase SQL Editor apres les evolutions importantes.
-- Dans Supabase Dashboard > Authentication > Providers > Email,
-- active l'email et l'authentification Email + Password cote client.

create extension if not exists pgcrypto;

do $$
begin
  create type public.bet_status as enum ('pending', 'won', 'lost');
exception
  when duplicate_object then null;
end $$;

alter type public.bet_status add value if not exists 'cashed_out';

do $$
begin
  create type public.bet_kind as enum ('single', 'combo');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  wave_number text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  sport text not null,
  match_label text not null,
  bet_kind public.bet_kind not null default 'single',
  event_count integer not null default 1 check (event_count >= 1),
  min_odds numeric(10, 2),
  max_odds numeric(10, 2),
  stake numeric(12, 2) not null check (stake >= 0),
  odds numeric(10, 2) not null check (odds > 0),
  status public.bet_status not null default 'pending',
  payout numeric(12, 2) not null default 0 check (payout >= 0)
);

create table if not exists public.radar_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  used_on date not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.radar_token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta_tokens integer not null check (delta_tokens <> 0),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.radar_token_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  amount_fcfa integer not null check (amount_fcfa > 0),
  token_count integer not null check (token_count > 0),
  payment_method text not null,
  offer_label text,
  code_hash text not null unique,
  issued_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_user_id uuid references auth.users (id) on delete set null,
  redeemed_by_email text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- Compatibilite avec les projets deja initialises avant les derniers patchs.
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists wave_number text;
alter table public.profiles add column if not exists created_at timestamptz;
alter table public.profiles alter column created_at set default timezone('utc'::text, now());

update public.profiles
set created_at = timezone('utc'::text, now())
where created_at is null;

alter table public.profiles alter column created_at set not null;

alter table public.bets add column if not exists created_at timestamptz;
alter table public.bets add column if not exists sport text;
alter table public.bets add column if not exists match_label text;
alter table public.bets add column if not exists stake numeric(12, 2);
alter table public.bets add column if not exists odds numeric(10, 2);
alter table public.bets add column if not exists status public.bet_status;
alter table public.bets add column if not exists payout numeric(12, 2);
alter table public.bets add column if not exists bet_kind public.bet_kind default 'single';
alter table public.bets add column if not exists event_count integer default 1;
alter table public.bets add column if not exists min_odds numeric(10, 2);
alter table public.bets add column if not exists max_odds numeric(10, 2);

alter table public.radar_usage add column if not exists used_on date;
alter table public.radar_usage add column if not exists created_at timestamptz;
alter table public.radar_token_ledger add column if not exists delta_tokens integer;
alter table public.radar_token_ledger add column if not exists reason text;
alter table public.radar_token_ledger add column if not exists metadata jsonb;
alter table public.radar_token_ledger add column if not exists created_at timestamptz;
alter table public.radar_token_codes add column if not exists email text;
alter table public.radar_token_codes add column if not exists amount_fcfa integer;
alter table public.radar_token_codes add column if not exists token_count integer;
alter table public.radar_token_codes add column if not exists payment_method text;
alter table public.radar_token_codes add column if not exists offer_label text;
alter table public.radar_token_codes add column if not exists code_hash text;
alter table public.radar_token_codes add column if not exists issued_at timestamptz;
alter table public.radar_token_codes add column if not exists expires_at timestamptz;
alter table public.radar_token_codes add column if not exists redeemed_at timestamptz;
alter table public.radar_token_codes add column if not exists redeemed_by_user_id uuid;
alter table public.radar_token_codes add column if not exists redeemed_by_email text;
alter table public.radar_token_codes add column if not exists created_at timestamptz;

update public.radar_usage
set created_at = timezone('utc'::text, now())
where created_at is null;

update public.radar_token_ledger
set metadata = '{}'::jsonb
where metadata is null;

update public.radar_token_ledger
set created_at = timezone('utc'::text, now())
where created_at is null;

update public.radar_token_codes
set issued_at = timezone('utc'::text, now())
where issued_at is null;

update public.radar_token_codes
set created_at = timezone('utc'::text, now())
where created_at is null;

update public.radar_usage
set used_on = date_trunc('week', timezone('Africa/Douala'::text, now()))::date
where used_on is null;

update public.radar_usage
set used_on = date_trunc('week', used_on::timestamp)::date
where used_on is not null;

alter table public.radar_usage alter column created_at set default timezone('utc'::text, now());
alter table public.radar_usage alter column created_at set not null;
alter table public.radar_usage alter column used_on set not null;
alter table public.radar_token_ledger alter column metadata set default '{}'::jsonb;
alter table public.radar_token_ledger alter column created_at set default timezone('utc'::text, now());
alter table public.radar_token_ledger alter column created_at set not null;
alter table public.radar_token_ledger alter column metadata set not null;
alter table public.radar_token_codes alter column issued_at set default timezone('utc'::text, now());
alter table public.radar_token_codes alter column created_at set default timezone('utc'::text, now());
alter table public.radar_token_codes alter column issued_at set not null;
alter table public.radar_token_codes alter column created_at set not null;

update public.bets
set created_at = timezone('utc'::text, now())
where created_at is null;

update public.bets
set status = 'pending'
where status is null;

update public.bets
set payout = 0
where payout is null;

update public.bets
set bet_kind = 'single'
where bet_kind is null;

update public.bets
set event_count = 1
where event_count is null or event_count < 1;

alter table public.bets alter column created_at set default timezone('utc'::text, now());
alter table public.bets alter column status set default 'pending';
alter table public.bets alter column payout set default 0;
alter table public.bets alter column bet_kind set default 'single';
alter table public.bets alter column event_count set default 1;

alter table public.bets alter column created_at set not null;
alter table public.bets alter column status set not null;
alter table public.bets alter column payout set not null;
alter table public.bets alter column bet_kind set not null;
alter table public.bets alter column event_count set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bets_event_count_check'
  ) then
    alter table public.bets
      add constraint bets_event_count_check check (event_count >= 1);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bets_stake_check'
  ) then
    alter table public.bets
      add constraint bets_stake_check check (stake >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bets_odds_check'
  ) then
    alter table public.bets
      add constraint bets_odds_check check (odds > 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bets_payout_check'
  ) then
    alter table public.bets
      add constraint bets_payout_check check (payout >= 0);
  end if;
end $$;

create index if not exists bets_user_id_created_at_idx on public.bets (user_id, created_at desc);
create index if not exists radar_usage_user_id_used_on_idx on public.radar_usage (user_id, used_on desc, created_at desc);
create index if not exists radar_token_ledger_user_id_created_at_idx on public.radar_token_ledger (user_id, created_at desc);
create index if not exists radar_token_codes_email_idx on public.radar_token_codes (lower(email));

alter table public.profiles enable row level security;
alter table public.bets enable row level security;
alter table public.radar_usage enable row level security;
alter table public.radar_token_ledger enable row level security;
alter table public.radar_token_codes enable row level security;

do $$
begin
  create policy "Profiles are private to their owner"
    on public.profiles
    for all
    using (auth.uid() = id)
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Bets are private to their owner"
    on public.bets
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Radar usage is private to their owner"
    on public.radar_usage
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Radar token ledger is private to their owner"
    on public.radar_token_ledger
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

create or replace function public.claim_radar_usage(target_day date default date_trunc('week', timezone('Africa/Douala'::text, now()))::date)
returns table (
  allowed boolean,
  usage_id uuid,
  used_count integer,
  remaining_count integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_count integer := 0;
  inserted_usage_id uuid := null;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text || ':' || target_day::text));

  select count(*)::integer
  into current_count
  from public.radar_usage
  where user_id = current_user_id
    and used_on = target_day;

  if current_count >= 2 then
    return query
    select false, null::uuid, current_count, 0;
    return;
  end if;

  insert into public.radar_usage (user_id, used_on)
  values (current_user_id, target_day)
  returning id into inserted_usage_id;

  current_count := current_count + 1;

  return query
  select true, inserted_usage_id, current_count, greatest(0, 2 - current_count);
end;
$$;

create or replace function public.get_radar_token_balance(target_user uuid default auth.uid())
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  resolved_user_id uuid := coalesce(target_user, current_user_id);
  balance integer := 0;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if resolved_user_id is distinct from current_user_id then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(sum(delta_tokens), 0)::integer
  into balance
  from public.radar_token_ledger
  where user_id = resolved_user_id;

  return greatest(balance, 0);
end;
$$;

create or replace function public.claim_radar_access(target_day date default date_trunc('week', timezone('Africa/Douala'::text, now()))::date)
returns table (
  allowed boolean,
  access_mode text,
  usage_id uuid,
  ledger_id uuid,
  used_count integer,
  remaining_count integer,
  token_balance integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_count integer := 0;
  current_token_balance integer := 0;
  inserted_usage_id uuid := null;
  inserted_ledger_id uuid := null;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext(current_user_id::text || ':' || target_day::text || ':radar_access'));

  select count(*)::integer
  into current_count
  from public.radar_usage
  where user_id = current_user_id
    and used_on = target_day;

  select coalesce(sum(delta_tokens), 0)::integer
  into current_token_balance
  from public.radar_token_ledger
  where user_id = current_user_id;

  current_token_balance := greatest(current_token_balance, 0);

  if current_count < 2 then
    insert into public.radar_usage (user_id, used_on)
    values (current_user_id, target_day)
    returning id into inserted_usage_id;

    current_count := current_count + 1;

    return query
    select true, 'daily'::text, inserted_usage_id, null::uuid, current_count, greatest(0, 2 - current_count), current_token_balance;
    return;
  end if;

  if current_token_balance > 0 then
    insert into public.radar_token_ledger (user_id, delta_tokens, reason, metadata)
    values (
      current_user_id,
      -1,
      'radar_analysis',
      jsonb_build_object('target_day', target_day)
    )
    returning id into inserted_ledger_id;

    return query
    select true, 'token'::text, null::uuid, inserted_ledger_id, current_count, 0, greatest(0, current_token_balance - 1);
    return;
  end if;

  return query
  select false, 'blocked'::text, null::uuid, null::uuid, current_count, 0, 0;
end;
$$;

create or replace function public.refund_radar_access(
  access_mode text,
  target_day date default date_trunc('week', timezone('Africa/Douala'::text, now()))::date,
  access_usage_id uuid default null,
  access_ledger_id uuid default null
)
returns table (
  used_count integer,
  remaining_count integer,
  token_balance integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if access_mode = 'daily' and access_usage_id is not null then
    delete from public.radar_usage
    where id = access_usage_id
      and user_id = current_user_id;
  elsif access_mode = 'token' and access_ledger_id is not null then
    delete from public.radar_token_ledger
    where id = access_ledger_id
      and user_id = current_user_id
      and delta_tokens = -1
      and reason = 'radar_analysis';
  end if;

  return query
  select
    count(*)::integer,
    greatest(0, 2 - count(*)::integer),
    coalesce((
      select greatest(coalesce(sum(delta_tokens), 0)::integer, 0)
      from public.radar_token_ledger
      where user_id = current_user_id
    ), 0)
  from public.radar_usage
  where user_id = current_user_id
    and used_on = target_day;
end;
$$;

create or replace function public.redeem_radar_token_code(plain_code text)
returns table (
  token_balance integer,
  redeemed_token_count integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  code_record public.radar_token_codes%rowtype;
  next_balance integer := 0;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if current_user_email = '' then
    raise exception 'EMAIL_REQUIRED';
  end if;

  if plain_code is null or btrim(plain_code) = '' then
    raise exception 'CODE_REQUIRED';
  end if;

  select *
  into code_record
  from public.radar_token_codes
  where code_hash = encode(digest(upper(btrim(plain_code)), 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'CODE_INVALID';
  end if;

  if code_record.redeemed_at is not null then
    raise exception 'CODE_ALREADY_REDEEMED';
  end if;

  if code_record.expires_at < timezone('utc'::text, now()) then
    raise exception 'CODE_EXPIRED';
  end if;

  if lower(code_record.email) <> current_user_email then
    raise exception 'CODE_EMAIL_MISMATCH';
  end if;

  update public.radar_token_codes
  set redeemed_at = timezone('utc'::text, now()),
      redeemed_by_user_id = current_user_id,
      redeemed_by_email = current_user_email
  where id = code_record.id;

  insert into public.radar_token_ledger (user_id, delta_tokens, reason, metadata)
  values (
    current_user_id,
    code_record.token_count,
    'code_redeem',
    jsonb_build_object(
      'code_id', code_record.id,
      'email', code_record.email,
      'amount_fcfa', code_record.amount_fcfa,
      'payment_method', code_record.payment_method,
      'offer_label', code_record.offer_label
    )
  );

  select greatest(coalesce(sum(delta_tokens), 0)::integer, 0)
  into next_balance
  from public.radar_token_ledger
  where user_id = current_user_id;

  return query
  select coalesce(next_balance, 0), code_record.token_count;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
