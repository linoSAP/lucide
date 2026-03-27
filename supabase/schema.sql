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

update public.radar_usage
set created_at = timezone('utc'::text, now())
where created_at is null;

update public.radar_usage
set used_on = (timezone('Africa/Douala'::text, now()))::date
where used_on is null;

alter table public.radar_usage alter column created_at set default timezone('utc'::text, now());
alter table public.radar_usage alter column created_at set not null;
alter table public.radar_usage alter column used_on set not null;

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

alter table public.profiles enable row level security;
alter table public.bets enable row level security;
alter table public.radar_usage enable row level security;

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

create or replace function public.claim_radar_usage(target_day date default (timezone('Africa/Douala'::text, now()))::date)
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
