-- Delete one timeline photo and keep plants.photo_path on the newest remaining photo, atomically:
-- the plant row lock serialises this with other deletes and main-photo updates (two devices), so the
-- main photo never points at a photo whose object the caller is about to remove.
-- Security invoker: RLS and grants of the caller apply. Returns the deleted path (for Storage), or null.
create function public.delete_plant_photo(photo_id uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_plant uuid;
  v_path text;
begin
  select plant_id, path into v_plant, v_path from public.plant_photos where id = photo_id;
  if v_plant is null then return null; end if;
  perform 1 from public.plants where id = v_plant for update;
  delete from public.plant_photos where id = photo_id;
  if not found then return null; end if; -- deleted meanwhile; the other caller removes the object
  update public.plants
     set photo_path = (select path from public.plant_photos where plant_id = v_plant order by taken_at desc, id desc limit 1)
   where id = v_plant and photo_path = v_path;
  return v_path;
end $$;
revoke execute on function public.delete_plant_photo(uuid) from public, anon;
grant execute on function public.delete_plant_photo(uuid) to authenticated;
