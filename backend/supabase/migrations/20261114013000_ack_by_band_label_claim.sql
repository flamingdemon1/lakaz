-- 20261114013000_ack_by_band_label_claim.sql
-- Owner: Zuhayr (mobile), for Shihad / Inshiraah to review and apply. Written 14 Nov 2026.
--
-- Three small additions the app needs. Nothing existing is removed or renamed, so the current app keeps
-- working before and after this is applied (the app falls back to the old query if these columns are missing).
--   1. alerts.acknowledged_by   — WHO acknowledged (set by the server from auth.uid(), never sent by the app).
--   2. devices.label            — a friendly band name ("Marie-Claire's band") instead of "band …1307".
--   3. devices.claim_code + claim_device(code) — a carer links a band from the app by typing the code printed
--      on the band, instead of an admin inserting carer_links by hand in the SQL editor.
-- Security model is unchanged: RLS on, carers read only their linked devices/alerts, no direct table writes.

-- 1. Who acknowledged -------------------------------------------------------------------------------------
alter table public.alerts
    add column if not exists acknowledged_by uuid references auth.users(id) on delete set null;

-- Same rules as before (signed in + linked; first acknowledgement wins; a retry never changes time OR person),
-- now also recording the carer.
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

    -- Only the FIRST acknowledgement sets both fields; a retry or a second carer keeps the original.
    update public.alerts
    set acknowledged_by = case when acknowledged_at is null then v_carer_id else acknowledged_by end,
        acknowledged_at = coalesce(acknowledged_at, now())
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

-- 2. Band name ----------------------------------------------------------------------------------------------
alter table public.devices
    add column if not exists label text check (label is null or char_length(label) between 1 and 40);

-- Carers may read ONLY id + label of the bands they are linked to.
-- Column-level grant: device_token_hash and claim_code stay unreadable from the app.
grant select (id, label) on public.devices to authenticated;

drop policy if exists "carers_can_select_linked_devices" on public.devices;
create policy "carers_can_select_linked_devices"
    on public.devices
    for select
    to authenticated
    using (
        exists (
            select 1 from public.carer_links
            where public.carer_links.device_id = devices.id
              and public.carer_links.carer_id = (select auth.uid())
        )
    );

-- A linked carer can rename their band (narrow operation; no general UPDATE grant on devices).
create or replace function public.set_device_label(p_device_id uuid, p_label text)
returns table (id uuid, label text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
    if auth.uid() is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;
    if not exists (
        select 1 from public.carer_links where device_id = p_device_id and carer_id = auth.uid()
    ) then
        raise exception 'forbidden: carer is not linked to this device';
    end if;
    if p_label is null or char_length(trim(p_label)) not between 1 and 40 then
        raise exception 'invalid: name must be 1 to 40 characters';
    end if;

    return query
    update public.devices d set label = trim(p_label) where d.id = p_device_id returning d.id, d.label;
end;
$$;

revoke execute on function public.set_device_label(uuid, text) from public, anon;
grant execute on function public.set_device_label(uuid, text) to authenticated;

-- 3. Link a band with the code printed on it ---------------------------------------------------------------
-- The admin sets a random code per band (8+ characters, e.g. 'LKZ-7Q4M-2XRA'), never readable from the app:
--   update public.devices set claim_code = 'LKZ-7Q4M-2XRA', label = 'Marie-Claire''s band' where id = '<band uuid>';
-- Why a long random code: anyone holding it can link, like pairing a device; 32^8 combinations make guessing
-- impractical. A family shares the code so several carers can link the same band.
alter table public.devices
    add column if not exists claim_code text unique check (claim_code is null or char_length(claim_code) >= 8);

create or replace function public.claim_device(p_code text)
returns table (device_id uuid, label text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_device public.devices;
begin
    if auth.uid() is null then
        raise exception 'unauthorized: carer must be signed in';
    end if;

    select * into v_device
    from public.devices
    where claim_code is not null
      and claim_code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));

    if not found then
        raise exception 'not_found: no band with that code';
    end if;

    -- Linking twice is fine (retry-safe): the unique (device_id, carer_id) keeps one row.
    insert into public.carer_links (device_id, carer_id)
    values (v_device.id, auth.uid())
    on conflict on constraint carer_links_device_id_carer_id_key do nothing;

    return query select v_device.id, v_device.label;
end;
$$;

revoke execute on function public.claim_device(text) from public, anon;
grant execute on function public.claim_device(text) to authenticated;
