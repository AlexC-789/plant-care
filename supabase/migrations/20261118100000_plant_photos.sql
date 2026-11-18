-- Photo timeline: every photo of a plant. plants.photo_path stays the newest (main) photo.
create table public.plant_photos (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id  uuid not null references public.plants (id) on delete cascade,
  path      text not null check (path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.jpg$')),
  taken_at  timestamptz not null default now(),
  scan_id   uuid references public.scans (id) on delete set null,
  unique (plant_id, path)
);
create index plant_photos_plant_taken on public.plant_photos (plant_id, taken_at desc);

alter table public.plant_photos enable row level security;

create policy plant_photos_select_own on public.plant_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy plant_photos_insert_own on public.plant_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.plants p where p.id = plant_id and p.user_id = (select auth.uid()))
  );
create policy plant_photos_delete_own on public.plant_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- No update; user_id and scan_id are never client-writable.
revoke all on public.plant_photos from anon, authenticated;
grant select, delete on public.plant_photos to authenticated;
grant insert (plant_id, path, taken_at) on public.plant_photos to authenticated;

-- A new main photo joins the timeline (inserts with the row's own user_id, so never for another user).
create function public.plants_photo_to_timeline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.plant_photos (user_id, plant_id, path)
  values (new.user_id, new.id, new.photo_path)
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.plants_photo_to_timeline() from public, anon, authenticated;

create trigger plants_photo_to_timeline
  after insert or update of photo_path on public.plants
  for each row when (new.photo_path is not null)
  execute function public.plants_photo_to_timeline();

-- One-time backfill of existing photos; idempotent. Callable by postgres/service role only.
create function public.backfill_plant_photos() returns void
language sql security definer set search_path = '' as $$
  insert into public.plant_photos (user_id, plant_id, path, taken_at)
  select user_id, id, photo_path, created_at from public.plants where photo_path is not null
  on conflict do nothing;
  insert into public.plant_photos (user_id, plant_id, path, taken_at, scan_id)
  select s.user_id, s.plant_id, p, s.created_at, case when s.kind = 'health' then s.id end
  from public.scans s, unnest(s.photo_paths) p
  where s.plant_id is not null
  on conflict do nothing;
$$;
revoke execute on function public.backfill_plant_photos() from public, anon, authenticated;

select public.backfill_plant_photos();
