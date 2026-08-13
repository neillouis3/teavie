-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
-- Adds account-synced favorites (mirrors watch_later).

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create index if not exists favorites_user_added_idx
  on public.favorites (user_id, added_at desc);

alter table public.favorites enable row level security;

drop policy if exists "favorites_all_own" on public.favorites;
create policy "favorites_all_own"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
