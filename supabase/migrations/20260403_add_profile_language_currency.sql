alter table public.profiles add column if not exists language text;
alter table public.profiles add column if not exists currency text;

update public.profiles
set language = 'fr'
where language is null or language not in ('fr', 'en');

update public.profiles
set currency = 'XAF'
where currency is null or char_length(currency) <> 3;

alter table public.profiles alter column language set default 'fr';
alter table public.profiles alter column language set not null;

alter table public.profiles alter column currency set default 'XAF';
alter table public.profiles alter column currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_language_check check (language in ('fr', 'en'));
  end if;
end $$;
