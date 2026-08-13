-- Run in Supabase SQL Editor (Dashboard → SQL → New query).
-- Enables Google OAuth profiles, preferences, watch history, progress, and watch later.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watch_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  last_season integer not null default 1,
  last_episode integer not null default 1,
  last_watched_at timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create index if not exists watch_history_user_watched_idx
  on public.watch_history (user_id, last_watched_at desc);

create table if not exists public.watch_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_id text not null,
  progress jsonb not null default '{}'::jsonb,
  movie_position_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create table if not exists public.watch_later (
  user_id uuid not null references auth.users (id) on delete cascade,
  catalog_id text not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create index if not exists watch_later_user_added_idx
  on public.watch_later (user_id, added_at desc);

alter table public.profiles enable row level security;
alter table public.watch_history enable row level security;
alter table public.watch_progress enable row level security;
alter table public.watch_later enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "watch_history_all_own" on public.watch_history;
create policy "watch_history_all_own"
  on public.watch_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "watch_progress_all_own" on public.watch_progress;
create policy "watch_progress_all_own"
  on public.watch_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "watch_later_all_own" on public.watch_later;
create policy "watch_later_all_own"
  on public.watch_later for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'User'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
