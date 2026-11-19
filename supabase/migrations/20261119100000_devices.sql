-- M4: watering module (device) per plant, its readings/events/commands, and short-lived claim codes.
-- The device and the app reach these tables only through Edge Functions (service_role) or owner-only RLS.

-- 12 chars of an unambiguous alphabet (31 symbols). byte % 31 has a tiny bias (256 % 31 = 8), acceptable
-- for a 15-minute single-use code.
create function public.new_claim_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', get_byte(b, i) % 31 + 1, 1), '')
  from extensions.gen_random_bytes(12) b, generate_series(0, 11) i;
$$;

create table public.device_claims (
  code       text primary key default public.new_claim_code(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id   uuid not null references public.plants (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);

create table public.devices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  plant_id         uuid not null unique references public.plants (id) on delete cascade,
  secret_hash      text not null unique,
  firmware_version text,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz,
  sync_interval_s  int not null default 3600,
  reading_ts       timestamptz,
  soil_pct         numeric,
  water_left_ml    int,
  float_low        boolean,
  battery_pct      int,
  charging         boolean,
  fault_code       text check (fault_code in ('no_moisture_rise', 'sensor_out_of_range')),
  soil_air_raw     int not null default 2900,
  soil_wet_raw     int not null default 1200,
  tank_empty_raw   int not null default 1000,
  tank_full_raw    int not null default 3000,
  tank_full_ml     int not null default 705,
  pump_ml_per_s    numeric not null default 3.0
);

create table public.readings (
  device_id     uuid not null references public.devices (id) on delete cascade,
  ts            timestamptz not null,
  soil_raw      int not null,
  tank_raw      int not null,
  float_low     boolean not null,
  battery_mv    int not null,
  charging      boolean not null,
  soil_pct      numeric,
  water_left_ml int,
  battery_pct   int,
  primary key (device_id, ts)
);

create table public.device_events (
  id        uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  ts        timestamptz not null,
  type      text not null check (type in ('watered', 'refill_detected', 'tank_low', 'battery_low', 'boot', 'fault')),
  pump_ms   int,
  ml        numeric,
  code      text,
  unique nulls not distinct (device_id, ts, type, code)
);
create index device_events_device_ts on public.device_events (device_id, ts desc);

create table public.device_commands (
  id         uuid primary key default gen_random_uuid(),
  device_id  uuid not null references public.devices (id) on delete cascade,
  type       text not null check (type = 'clear_fault'),
  created_at timestamptz not null default now(),
  acked_at   timestamptz
);
create index device_commands_pending on public.device_commands (device_id) where acked_at is null;

alter table public.device_claims enable row level security;
alter table public.devices enable row level security;
alter table public.readings enable row level security;
alter table public.device_events enable row level security;
alter table public.device_commands enable row level security;

create policy devices_select_own on public.devices
  for select to authenticated using (user_id = (select auth.uid()));
create policy devices_delete_own on public.devices
  for delete to authenticated using (user_id = (select auth.uid()));

create policy device_claims_select_own on public.device_claims
  for select to authenticated using (user_id = (select auth.uid()));
create policy device_claims_insert_own on public.device_claims
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
    and not exists (select 1 from public.devices d where d.plant_id = device_claims.plant_id)
  );

create policy readings_select_own on public.readings
  for select to authenticated using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = (select auth.uid())));
create policy device_events_select_own on public.device_events
  for select to authenticated using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = (select auth.uid())));
create policy device_commands_select_own on public.device_commands
  for select to authenticated using (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = (select auth.uid())));
create policy device_commands_insert_own on public.device_commands
  for insert to authenticated with check (
    exists (select 1 from public.devices d where d.id = device_id and d.user_id = (select auth.uid())));

-- Users never read secret_hash and never write devices/readings/events; user_id on claims is the default.
revoke all on public.device_claims, public.devices, public.readings, public.device_events, public.device_commands
  from anon, authenticated, service_role;
grant select (id, user_id, plant_id, firmware_version, created_at, last_seen_at, sync_interval_s, reading_ts,
              soil_pct, water_left_ml, float_low, battery_pct, charging, fault_code, soil_air_raw, soil_wet_raw,
              tank_empty_raw, tank_full_raw, tank_full_ml, pump_ml_per_s)
  on public.devices to authenticated;
grant delete on public.devices to authenticated;
grant select on public.readings, public.device_events, public.device_commands, public.device_claims to authenticated;
grant insert (plant_id) on public.device_claims to authenticated;
grant insert (device_id, type) on public.device_commands to authenticated;

grant select, update on public.devices to service_role;
-- select: ON CONFLICT (device_id, ts) needs it for idempotent uploads
grant select, insert on public.readings, public.device_events to service_role;
grant select, update on public.device_commands to service_role;

-- One open claim code per plant: a new one replaces the old.
create function public.device_claims_replace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.device_claims where plant_id = new.plant_id;
  return new;
end $$;
revoke execute on function public.device_claims_replace() from public, anon, authenticated;

create trigger device_claims_replace
  before insert on public.device_claims
  for each row execute function public.device_claims_replace();

-- Called by the claim-device Edge Function (service_role): consumes a valid code and creates the device.
create function public.claim_device(p_code text, p_secret_hash text, p_firmware_version text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c public.device_claims;
  new_id uuid;
begin
  select * into c from public.device_claims where code = p_code and expires_at > now() for update;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if exists (select 1 from public.devices where plant_id = c.plant_id) then
    return jsonb_build_object('error', 'has_module');
  end if;
  insert into public.devices (user_id, plant_id, secret_hash, firmware_version, last_seen_at)
  values (c.user_id, c.plant_id, p_secret_hash, p_firmware_version, now())
  returning id into new_id;
  delete from public.device_claims where code = c.code;
  return jsonb_build_object('device_id', new_id);
end $$;
revoke execute on function public.claim_device(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_device(text, text, text) to service_role;
