-- Profiles: one row per user, created by trigger on signup.
create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  display_name        text,
  units               text not null default 'metric'
                        check (units in ('metric', 'imperial')),
  notification_prefs  jsonb not null default '{}'::jsonb,
  quiet_hours_start   time,
  quiet_hours_end     time,
  -- Set by the server only (manually in v1, RevenueCat webhook later).
  subscription_status text not null default 'none'
                        check (subscription_status in ('none', 'active', 'expired')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Column-level privileges: users may only edit their own preferences.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, units, notification_prefs, quiet_hours_start, quiet_hours_end)
  on public.profiles to authenticated;

-- Create a profile for every new auth user.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
