-- Rolling-hour search limit for the search-plants function. Service role only.
create table public.search_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index search_log_user_created_idx on public.search_log (user_id, created_at);

alter table public.search_log enable row level security;
revoke all on public.search_log from anon, authenticated;
