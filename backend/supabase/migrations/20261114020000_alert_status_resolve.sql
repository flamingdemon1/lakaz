-- 20261114020000_alert_status_resolve.sql
-- Owner: Zuhayr (mobile), for Shihad / Inshiraah to review and apply AFTER 20261114013000 (PR #22).
--
-- Makes the alert lifecycle real so Home, Recent alerts and the Incident screen stop using sample data:
--   1. alerts.status ('open' → 'acknowledged' → 'resolved'), resolved_at, resolved_by.
--   2. acknowledge_alert also moves the status to 'acknowledged' (keeps PR #22's acknowledged_by rule).
--   3. resolve_alert(device, event): "She is safe — close alert". Linked carers only; first close wins.
--   4. linked_carer_names(device): names ONLY of the carers linked to the same band, for
--      "Acknowledged by Sarah" — never phone numbers, and only if the caller is linked too.
-- Nothing is removed or renamed; the app falls back to the old query until this is applied.

-- 1. Lifecycle columns -------------------------------------------------------------------------------------
alter table public.alerts
    add column if not exists status text not null default 'open'
        check (status in ('open', 'acknowledged', 'resolved')),
    add column if not exists resolved_at timestamptz,
    add column if not exists resolved_by uuid references auth.users(id) on delete set null;

-- Existing rows: anything already acknowledged starts as 'acknowledged'.
update public.alerts set status = 'acknowledged' where acknowledged_at is not null and status = 'open';

create index if not exists alerts_status_idx on public.alerts(status);

-- 2. Acknowledge (same signature and checks as before) ------------------------------------------------------
create or replace function public.acknowledge_alert(
    p_device_id uuid,
    p_event_id uuid
)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
    v_carer_id uuid;
    v_alert public.alerts;
begin
    v_carer_id := auth.uid();
    if v_carer_id is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;

    if not exists (
        select 1 from public.carer_links
        where device_id = p_device_id and carer_id = v_carer_id
    ) then
        raise exception 'forbidden: carer is not linked to this device';
    end if;

    -- First acknowledgement sets time + person; a retry or a second carer changes nothing.
    -- A resolved alert stays resolved.
    update public.alerts
    set acknowledged_by = case when acknowledged_at is null then v_carer_id else acknowledged_by end,
        acknowledged_at = coalesce(acknowledged_at, now()),
        status = case when status = 'open' then 'acknowledged' else status end
    where device_id = p_device_id
      and event_id = p_event_id
    returning * into v_alert;

    if not found then
        raise exception 'not_found: alert does not exist';
    end if;

    return v_alert;
end;
$$;

revoke execute on function public.acknowledge_alert(uuid, uuid) from public, anon;
grant execute on function public.acknowledge_alert(uuid, uuid) to authenticated;

-- 3. Resolve ("She is safe — close alert") ------------------------------------------------------------------
-- Closing also counts as handling it: if nobody acknowledged yet, the closer becomes the acknowledger too,
-- so the receipt is never empty. First close wins; a retry keeps the original time and person.
create or replace function public.resolve_alert(
    p_device_id uuid,
    p_event_id uuid
)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
    v_carer_id uuid;
    v_alert public.alerts;
begin
    v_carer_id := auth.uid();
    if v_carer_id is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;

    if not exists (
        select 1 from public.carer_links
        where device_id = p_device_id and carer_id = v_carer_id
    ) then
        raise exception 'forbidden: carer is not linked to this device';
    end if;

    update public.alerts
    set acknowledged_by = case when acknowledged_at is null then v_carer_id else acknowledged_by end,
        acknowledged_at = coalesce(acknowledged_at, now()),
        resolved_by = case when resolved_at is null then v_carer_id else resolved_by end,
        resolved_at = coalesce(resolved_at, now()),
        status = 'resolved'
    where device_id = p_device_id
      and event_id = p_event_id
    returning * into v_alert;

    if not found then
        raise exception 'not_found: alert does not exist';
    end if;

    return v_alert;
end;
$$;

revoke execute on function public.resolve_alert(uuid, uuid) from public, anon;
grant execute on function public.resolve_alert(uuid, uuid) to authenticated;

-- 4. Names of the other carers on the same band -----------------------------------------------------------
-- profiles RLS only lets a carer read their OWN row (20261114010000). This narrow function returns just
-- id + name of carers linked to a band the caller is also linked to. No phone, no language.
create or replace function public.linked_carer_names(p_device_id uuid)
returns table (carer_id uuid, name text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
    if auth.uid() is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;
    if not exists (
        select 1 from public.carer_links cl where cl.device_id = p_device_id and cl.carer_id = auth.uid()
    ) then
        raise exception 'forbidden: carer is not linked to this device';
    end if;

    return query
    select cl.carer_id, p.name
    from public.carer_links cl
    left join public.profiles p on p.id = cl.carer_id
    where cl.device_id = p_device_id;
end;
$$;

revoke execute on function public.linked_carer_names(uuid) from public, anon;
grant execute on function public.linked_carer_names(uuid) to authenticated;
