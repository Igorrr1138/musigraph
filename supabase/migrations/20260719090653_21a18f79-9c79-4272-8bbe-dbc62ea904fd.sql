
-- Phase 1 of Deezer removal: wipe all Deezer-keyed data (Option C: fresh start),
-- drop Deezer-only cache tables. Column names on remaining tables still contain
-- the string "deezer_id" but now hold MusicBrainz IDs; those columns will be
-- renamed in Phase 2 so the frontend can migrate atomically.

-- Fresh start for all user-generated content (ratings, reviews, playlist rows,
-- criteria, per-track metadata/lyrics). Data was keyed on Deezer IDs and has
-- no path back to MusicBrainz identifiers.
TRUNCATE TABLE
  public.album_ratings,
  public.album_reviews,
  public.track_ratings,
  public.track_reviews,
  public.playlist_tracks,
  public.track_criteria,
  public.track_metadata,
  public.track_lyrics
RESTART IDENTITY CASCADE;

-- Drop Deezer-only caches entirely.
DROP TABLE IF EXISTS public.tracks_cache   CASCADE;
DROP TABLE IF EXISTS public.albums_cache   CASCADE;
DROP TABLE IF EXISTS public.artists_cache  CASCADE;
DROP TABLE IF EXISTS public.isrc_mapping   CASCADE;

-- Music cache is fine structurally (artist_deezer_id column now holds MBIDs),
-- but existing rows were built by the Deezer pipeline. Clear them.
TRUNCATE TABLE public.music_cache;
