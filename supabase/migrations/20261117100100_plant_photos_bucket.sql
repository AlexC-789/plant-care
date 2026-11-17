-- Private photo bucket: 3 MB, JPEG only. Objects live at {user_id}/{uuid}.jpg.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plant-photos', 'plant-photos', false, 3145728, array['image/jpeg']);

-- The app never overwrites a photo, so there is no update policy. Edge Functions use the service role.
create policy "plant photos select own" on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "plant photos insert own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  );

create policy "plant photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
