begin;

alter table public.devices
    add column home_state text check (home_state in ('home', 'away')),
    add column home_since timestamptz;
grant select (home_state, home_since) on public.devices to authenticated;

-- Remember event IDs even when a departure reuses an active incident or a return creates no alert.
create table public.device_home_events (
    device_id uuid not null references public.devices(id) on delete cascade,
    event_id uuid not null,
    kind text not null check (kind in ('left_home', 'back_home')),
    alert_event_id uuid,
    primary key (device_id, event_id),
    foreign key (device_id, alert_event_id) references public.alerts(device_id, event_id) on delete cascade
);
alter table public.device_home_events enable row level security;
revoke all on public.device_home_events from public, anon, authenticated;

create or replace function public.submit_device_event(p_token_hash text, p_event_id uuid, p_kind text)
returns public.alerts
language plpgsql
security definer
set search_path = public
as $$
declare
    v_device_id uuid;
    v_alert public.alerts;
    v_transition public.device_home_events;
begin
    if p_kind is null or p_kind not in ('help_requested', 'left_home') then
        raise exception 'invalid_event: expected help_requested or left_home';
    end if;

    -- Serialize home transitions on the same band.
    select id into v_device_id from public.devices where device_token_hash = lower(p_token_hash) for update;
    if not found then return null; end if;

    select * into v_transition from public.device_home_events where device_id = v_device_id and event_id = p_event_id;
    if found then
        if v_transition.kind <> p_kind then raise exception 'invalid_event: event ID already used'; end if;
        select * into v_alert from public.alerts where device_id = v_device_id and event_id = v_transition.alert_event_id;
        return v_alert;
    end if;

    select * into v_alert from public.alerts where device_id = v_device_id and event_id = p_event_id;
    if found then
        if v_alert.kind <> p_kind then raise exception 'invalid_event: event ID already used'; end if;
        return v_alert;
    end if;

    if p_kind = 'left_home' then
        select * into v_alert from public.alerts
        where device_id = v_device_id and kind = 'left_home' and status <> 'resolved'
        order by received_at desc limit 1 for update;
    end if;

    if v_alert.event_id is null then
        insert into public.alerts (device_id, event_id, kind)
        values (v_device_id, p_event_id, p_kind)
        returning * into v_alert;
    end if;

    if p_kind = 'left_home' then
        insert into public.device_home_events (device_id, event_id, kind, alert_event_id)
        values (v_device_id, p_event_id, p_kind, v_alert.event_id);

        update public.devices set home_state = 'away', home_since = clock_timestamp()
        where id = v_device_id and home_state is distinct from 'away';
    end if;

    return v_alert;
end;
$$;

create function public.submit_back_home(p_token_hash text, p_event_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_device_id uuid;
    v_kind text;
    v_now timestamptz;
begin
    select id into v_device_id from public.devices where device_token_hash = lower(p_token_hash) for update;
    if not found then return false; end if;

    if p_event_id is not null then
        select kind into v_kind from public.device_home_events where device_id = v_device_id and event_id = p_event_id;
        if found then
            if v_kind <> 'back_home' then raise exception 'invalid_event: event ID already used'; end if;
            return true;
        end if;
        if exists (select 1 from public.alerts where device_id = v_device_id and event_id = p_event_id) then
            raise exception 'invalid_event: event ID already used';
        end if;
        insert into public.device_home_events (device_id, event_id, kind)
        values (v_device_id, p_event_id, 'back_home');
    end if;

    v_now := clock_timestamp();
    update public.alerts set status = 'resolved', resolved_at = v_now, resolved_by = null
    where device_id = v_device_id and kind = 'left_home' and status <> 'resolved';

    update public.devices set home_state = 'home', home_since = v_now
    where id = v_device_id and home_state is distinct from 'home';
    return true;
end;
$$;

revoke all on function public.submit_device_event(text, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_device_event(text, uuid, text) to service_role;
revoke all on function public.submit_back_home(text, uuid) from public, anon, authenticated;
grant execute on function public.submit_back_home(text, uuid) to service_role;

commit;
