create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text check (name is null or (name = btrim(name) and char_length(name) between 2 and 100)),
    phone text check (phone is null or phone ~ '^\+2305[0-9]{7}$'),
    language text not null default 'en' check (language in ('en', 'fr', 'mfe'))
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "carers_read_own_profile" on public.profiles
    for select to authenticated using ((select auth.uid()) = id);
create policy "carers_create_own_profile" on public.profiles
    for insert to authenticated with check ((select auth.uid()) = id);
create policy "carers_update_own_profile" on public.profiles
    for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);
