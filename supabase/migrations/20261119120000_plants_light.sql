-- Light where the plant stands (SCREEN_SPECIFICATIONS §4), same values as species.light.
alter table public.plants
  add column light text check (light in ('bright_indirect', 'medium', 'low', 'direct'));

-- Column grants add to the existing insert/update lists on plants.
grant insert (light), update (light) on public.plants to authenticated;
