begin;

alter table public.devices
    add column claim_alias text unique check (claim_alias is null or char_length(claim_alias) between 4 and 20),
    add column assigned_at timestamptz not null default '-infinity';

-- Existing bands keep their alert history until their first explicit assignment.
alter table public.devices alter column assigned_at set default now();

-- A 60-character wearer name needs room for the seven-character suffix.
alter table public.devices
    drop constraint devices_label_check,
    add constraint devices_label_check check (label is null or char_length(label) between 1 and 67);

grant select (assigned_at) on public.devices to authenticated;

drop policy "carers_can_select_linked_device_alerts" on public.alerts;
create policy "carers_can_select_linked_device_alerts"
    on public.alerts for select to authenticated
    using (
        exists (
            select 1
            from public.carer_links cl
            join public.devices d on d.id = cl.device_id
            where cl.device_id = alerts.device_id
              and cl.carer_id = (select auth.uid())
              and alerts.received_at >= d.assigned_at
        )
    );

-- Returns an ID only. Callers hold the band row lock while linking or assigning.
-- The alias also accepts a missing hyphen, so "lkz 1307" works.
create function public.lock_device_for_claim(p_code text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
    v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
    v_device_id uuid;
begin
    select d.id into v_device_id
    from public.devices d
    where upper(d.claim_code) = v_code
       or upper(d.claim_alias) = v_code
       or replace(upper(d.claim_alias), '-', '') = replace(v_code, '-', '')
    order by case when upper(d.claim_code) = v_code or upper(d.claim_alias) = v_code then 0 else 1 end, d.id
    limit 1 for update;

    if not found then raise exception 'not_found: no band with that code'; end if;
    return v_device_id;
end;
$$;
revoke all on function public.lock_device_for_claim(text) from public, anon, authenticated;

create or replace function public.claim_device(p_code text)
returns table (device_id uuid, label text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_carer_id uuid := auth.uid();
    v_device_id uuid;
begin
    if v_carer_id is null then raise exception 'unauthorized: carer must be signed in'; end if;
    v_device_id := public.lock_device_for_claim(p_code);
    insert into public.carer_links (device_id, carer_id) values (v_device_id, v_carer_id)
    on conflict on constraint carer_links_device_id_carer_id_key do nothing;
    return query select d.id, d.label from public.devices d where d.id = v_device_id;
end;
$$;
revoke all on function public.claim_device(text) from public, anon;
grant execute on function public.claim_device(text) to authenticated;

create function public.claim_device_for_person(
    p_code text, p_wearer_name text, p_wearer_age int, p_wearer_area text
)
returns table (device_id uuid, label text, wearer_name text, wearer_age int, wearer_area text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_carer_id uuid := auth.uid();
    v_device_id uuid;
    v_name text := btrim(p_wearer_name);
    v_area text := btrim(p_wearer_area);
begin
    if v_carer_id is null then raise exception 'unauthorized: carer must be signed in'; end if;
    if v_name is null or char_length(v_name) not between 2 and 60
       or p_wearer_age not between 0 and 120 or char_length(v_area) > 60 then
        raise exception 'invalid: check wearer name, age and area';
    end if;

    v_device_id := public.lock_device_for_claim(p_code);
    insert into public.carer_links (device_id, carer_id) values (v_device_id, v_carer_id)
    on conflict on constraint carer_links_device_id_carer_id_key do nothing;

    update public.alerts
    set status = 'resolved', resolved_at = coalesce(resolved_at, now()),
        resolved_by = coalesce(resolved_by, v_carer_id)
    where public.alerts.device_id = v_device_id and status <> 'resolved';

    return query
    update public.devices d
    set assigned_at = now(), wearer_name = v_name, wearer_age = p_wearer_age,
        wearer_area = v_area, label = v_name || '''s band', home_state = null, home_since = null
    where d.id = v_device_id
    returning d.id, d.label, d.wearer_name, d.wearer_age, d.wearer_area;
end;
$$;
revoke all on function public.claim_device_for_person(text, text, int, text) from public, anon;
grant execute on function public.claim_device_for_person(text, text, int, text) to authenticated;

commit;
