-- Migration: Create devices, carer_links, and alerts tables with RLS and RPCs
-- Description: Core schema for Lakaz alert ingestion, device mapping, access control, and carer acknowledgement.

-- 1. Devices table
-- Stores registered wearable devices and their hashed authentication tokens.
create table if not exists public.devices (
    id uuid primary key default gen_random_uuid(),
    device_token_hash text not null unique,
    created_at timestamptz not null default now()
);

-- 2. Carer links table
-- Maps devices to authorized carer user accounts (auth.users).
create table if not exists public.carer_links (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices(id) on delete cascade,
    carer_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint carer_links_device_id_carer_id_key unique (device_id, carer_id)
);

create index if not exists carer_links_carer_id_idx on public.carer_links(carer_id);
create index if not exists carer_links_device_id_idx on public.carer_links(device_id);

-- 3. Alerts table
-- Records help requests sent from devices.
-- Composite primary key (device_id, event_id) guarantees retry idempotency.
create table if not exists public.alerts (
    device_id uuid not null references public.devices(id) on delete cascade,
    event_id uuid not null,
    kind text not null default 'help_requested',
    received_at timestamptz not null default now(),
    acknowledged_at timestamptz,
    primary key (device_id, event_id)
);

create index if not exists alerts_device_id_idx on public.alerts(device_id);
create index if not exists alerts_received_at_idx on public.alerts(received_at desc);

-- 4. Row Level Security (RLS)
alter table public.devices enable row level security;
alter table public.carer_links enable row level security;
alter table public.alerts enable row level security;

-- Prevent direct mutations or reading sensitive device tokens from mobile clients
revoke all on public.devices from anon, authenticated;
revoke insert, update, delete on public.carer_links from anon, authenticated;
revoke insert, update, delete on public.alerts from anon, authenticated;

-- Allow signed-in carers to read their own device links
create policy "carers_can_select_own_links"
    on public.carer_links
    for select
    to authenticated
    using (auth.uid() = carer_id);

-- Only a signed-in carer linked to the device can read its alerts
create policy "carers_can_select_linked_device_alerts"
    on public.alerts
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.carer_links
            where public.carer_links.device_id = alerts.device_id
              and public.carer_links.carer_id = (select auth.uid())
        )
    );

-- 5. RPC: acknowledge_alert
-- Allows an authenticated linked carer to acknowledge an alert.
-- Sets the timestamp only on the first acknowledgement; preserves existing timestamp on retry.
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
    -- Verify caller is authenticated
    v_carer_id := auth.uid();
    if v_carer_id is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;

    -- Verify caller is linked to the device
    if not exists (
        select 1
        from public.carer_links
        where device_id = p_device_id
          and carer_id = v_carer_id
    ) then
        raise exception 'forbidden: carer is not linked to this device';
    end if;

    -- Set acknowledged_at timestamp only on first acknowledgement
    update public.alerts
    set acknowledged_at = coalesce(acknowledged_at, now())
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

-- 6. Server-only RPC: submit_device_event
-- Used by the device-event Edge Function with service_role privileges.
-- Looks up device by SHA-256 token hash (lowercase hex), accepts only 'help_requested',
-- returns stored alert, and idempotently handles retries without altering timestamps.
create or replace function public.submit_device_event(
    p_token_hash text,
    p_event_id uuid,
    p_kind text
)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
    v_device_id uuid;
    v_alert public.alerts;
begin
    -- Accept only 'help_requested'
    if p_kind is null or p_kind <> 'help_requested' then
        raise exception 'invalid_event: kind must be help_requested';
    end if;

    -- Look up device by token hash
    select id into v_device_id
    from public.devices
    where device_token_hash = lower(p_token_hash);

    -- Return null for unknown token
    if v_device_id is null then
        return null;
    end if;

    -- Insert new alert or do nothing on conflict (retry)
    insert into public.alerts (
        device_id,
        event_id,
        kind,
        received_at,
        acknowledged_at
    )
    values (
        v_device_id,
        p_event_id,
        p_kind,
        now(),
        null
    )
    on conflict (device_id, event_id) do nothing
    returning * into v_alert;

    -- If retry, fetch existing unmodified alert
    if not found then
        select * into v_alert
        from public.alerts
        where device_id = v_device_id
          and event_id = p_event_id;
    end if;

    return v_alert;
end;
$$;

-- Explicitly restrict execution strictly to service_role
revoke execute on function public.submit_device_event(text, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_device_event(text, uuid, text) to service_role;
