-- Wearer details and server-only heartbeat. Owner: Fahim; Shihad reviews/applies.
begin;
alter table public.devices
  add column if not exists wearer_name text,
  add column if not exists wearer_age integer,
  add column if not exists wearer_area text,
  add column if not exists last_seen timestamptz;

grant select (wearer_name, wearer_age, wearer_area, last_seen)
  on public.devices to authenticated;

-- Input is the server-computed token hash. Returns success without exposing device data.
create or replace function public.submit_heartbeat(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.devices set last_seen = now()
  where device_token_hash = p_token_hash;
  return found;
end;
$$;
revoke all on function public.submit_heartbeat(text) from public, anon, authenticated;
grant execute on function public.submit_heartbeat(text) to service_role;
commit;

-- Shihad: seed only the fictional demo band after replacing the placeholder.
-- update public.devices set wearer_name='Marie-Claire', wearer_age=74,
-- wearer_area='Rose-Hill' where id='<band uuid>';
