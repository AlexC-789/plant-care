-- Units follow the phone's region by default; metric/imperial are manual overrides.
-- Existing rows keep their value.
alter table public.profiles drop constraint profiles_units_check;
alter table public.profiles
  add constraint profiles_units_check check (units in ('auto', 'metric', 'imperial'));
alter table public.profiles alter column units set default 'auto';
