-- A plant may only point at its owner's photo folder, and a custom type is a short label.
alter table public.plants
  add constraint plants_photo_path_owner check (photo_path is null or photo_path ~ ('^' || user_id::text || '/[0-9a-f-]{36}\.jpg$')),
  add constraint plants_custom_type_len check (custom_type is null or char_length(custom_type) between 1 and 60);
