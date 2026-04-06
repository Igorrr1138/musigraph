create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.track_ratings
  add column if not exists album_title text,
  add column if not exists artist_name text,
  add column if not exists duration_ms integer;

create table if not exists public.user_track_rating_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  criteria jsonb not null default '[
    {"id":"lyrics","label":"Lyrics","enabled":true},
    {"id":"instrumental-part","label":"Instrumental Part","enabled":true},
    {"id":"energy","label":"Energy","enabled":true},
    {"id":"complexity","label":"Complexity","enabled":true},
    {"id":"mood","label":"Mood","enabled":true},
    {"id":"solo","label":"Solo","enabled":true},
    {"id":"vocal","label":"Vocal","enabled":true},
    {"id":"intro","label":"Intro","enabled":true},
    {"id":"outro","label":"Outro","enabled":true}
  ]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.user_track_rating_settings enable row level security;

drop policy if exists "Users can view own track rating settings" on public.user_track_rating_settings;
create policy "Users can view own track rating settings"
  on public.user_track_rating_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own track rating settings" on public.user_track_rating_settings;
create policy "Users can insert own track rating settings"
  on public.user_track_rating_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own track rating settings" on public.user_track_rating_settings;
create policy "Users can update own track rating settings"
  on public.user_track_rating_settings
  for update
  using (auth.uid() = user_id);

drop trigger if exists update_user_track_rating_settings_updated_at on public.user_track_rating_settings;
create trigger update_user_track_rating_settings_updated_at
  before update on public.user_track_rating_settings
  for each row execute function public.update_updated_at_column();

create table if not exists public.track_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  album_mbid text not null,
  album_title text,
  artist_name text,
  track_mbid text,
  track_title text not null,
  track_position integer not null,
  criteria_ratings jsonb not null default '{}'::jsonb,
  review text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, album_mbid, track_position)
);

alter table public.track_details enable row level security;

drop policy if exists "Users can view own track details" on public.track_details;
create policy "Users can view own track details"
  on public.track_details
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own track details" on public.track_details;
create policy "Users can insert own track details"
  on public.track_details
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own track details" on public.track_details;
create policy "Users can update own track details"
  on public.track_details
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own track details" on public.track_details;
create policy "Users can delete own track details"
  on public.track_details
  for delete
  using (auth.uid() = user_id);

create index if not exists track_details_user_album_idx
  on public.track_details (user_id, album_mbid, track_position);

drop trigger if exists update_track_details_updated_at on public.track_details;
create trigger update_track_details_updated_at
  before update on public.track_details
  for each row execute function public.update_updated_at_column();

create table if not exists public.album_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  album_mbid text not null,
  album_title text not null,
  artist_name text,
  cover_url text,
  review text,
  mood_tags text[] not null default '{}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, album_mbid)
);

alter table public.album_reviews enable row level security;

drop policy if exists "Users can view own album reviews" on public.album_reviews;
create policy "Users can view own album reviews"
  on public.album_reviews
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own album reviews" on public.album_reviews;
create policy "Users can insert own album reviews"
  on public.album_reviews
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own album reviews" on public.album_reviews;
create policy "Users can update own album reviews"
  on public.album_reviews
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own album reviews" on public.album_reviews;
create policy "Users can delete own album reviews"
  on public.album_reviews
  for delete
  using (auth.uid() = user_id);

drop trigger if exists update_album_reviews_updated_at on public.album_reviews;
create trigger update_album_reviews_updated_at
  before update on public.album_reviews
  for each row execute function public.update_updated_at_column();

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (user_id, name)
);

alter table public.playlists enable row level security;

drop policy if exists "Users can view own playlists" on public.playlists;
create policy "Users can view own playlists"
  on public.playlists
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own playlists" on public.playlists;
create policy "Users can insert own playlists"
  on public.playlists
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own playlists" on public.playlists;
create policy "Users can update own playlists"
  on public.playlists
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own playlists" on public.playlists;
create policy "Users can delete own playlists"
  on public.playlists
  for delete
  using (auth.uid() = user_id);

drop trigger if exists update_playlists_updated_at on public.playlists;
create trigger update_playlists_updated_at
  before update on public.playlists
  for each row execute function public.update_updated_at_column();

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  track_key text not null,
  track_mbid text,
  track_title text not null,
  track_position integer,
  album_mbid text,
  album_title text,
  artist_name text,
  duration_ms integer,
  added_at timestamp with time zone not null default now(),
  unique (playlist_id, track_key)
);

alter table public.playlist_tracks enable row level security;

drop policy if exists "Users can view own playlist tracks" on public.playlist_tracks;
create policy "Users can view own playlist tracks"
  on public.playlist_tracks
  for select
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own playlist tracks" on public.playlist_tracks;
create policy "Users can insert own playlist tracks"
  on public.playlist_tracks
  for insert
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own playlist tracks" on public.playlist_tracks;
create policy "Users can delete own playlist tracks"
  on public.playlist_tracks
  for delete
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = auth.uid()
    )
  );

create index if not exists playlist_tracks_playlist_idx
  on public.playlist_tracks (playlist_id, added_at desc);

create index if not exists track_ratings_user_rating_idx
  on public.track_ratings (user_id, rating desc);
