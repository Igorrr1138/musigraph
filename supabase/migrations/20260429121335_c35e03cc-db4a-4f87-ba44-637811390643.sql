
-- Wipe all stored ratings (per user request) and switch to Deezer-first IDs.
-- Deezer ID becomes the canonical identifier; MBID is kept nullable as a secondary persistent identifier.

-- 1. Wipe ratings
TRUNCATE TABLE public.track_ratings;
TRUNCATE TABLE public.album_ratings;

-- 2. album_ratings: introduce album_deezer_id as primary identifier
ALTER TABLE public.album_ratings
  ADD COLUMN IF NOT EXISTS album_deezer_id TEXT,
  ADD COLUMN IF NOT EXISTS artist_deezer_id TEXT,
  ALTER COLUMN album_mbid DROP NOT NULL;

-- Drop old composite unique on (user_id, album_mbid) if it exists, then add new one on deezer id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'album_ratings_user_id_album_mbid_key'
  ) THEN
    ALTER TABLE public.album_ratings DROP CONSTRAINT album_ratings_user_id_album_mbid_key;
  END IF;
END$$;

ALTER TABLE public.album_ratings
  ADD CONSTRAINT album_ratings_user_album_deezer_unique UNIQUE (user_id, album_deezer_id);

CREATE INDEX IF NOT EXISTS idx_album_ratings_album_deezer_id
  ON public.album_ratings (album_deezer_id);

-- 3. track_ratings: introduce track_deezer_id and album_deezer_id
ALTER TABLE public.track_ratings
  ADD COLUMN IF NOT EXISTS track_deezer_id TEXT,
  ADD COLUMN IF NOT EXISTS album_deezer_id TEXT,
  ALTER COLUMN album_mbid DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'track_ratings_user_id_album_mbid_track_position_key'
  ) THEN
    ALTER TABLE public.track_ratings DROP CONSTRAINT track_ratings_user_id_album_mbid_track_position_key;
  END IF;
END$$;

ALTER TABLE public.track_ratings
  ADD CONSTRAINT track_ratings_user_album_track_deezer_unique
  UNIQUE (user_id, album_deezer_id, track_position);

CREATE INDEX IF NOT EXISTS idx_track_ratings_album_deezer_id
  ON public.track_ratings (album_deezer_id);
CREATE INDEX IF NOT EXISTS idx_track_ratings_track_deezer_id
  ON public.track_ratings (track_deezer_id);

-- 4. Caches: add Deezer ID alongside MBID
ALTER TABLE public.artists_cache
  ADD COLUMN IF NOT EXISTS deezer_id TEXT,
  ALTER COLUMN mbid DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_cache_deezer_id
  ON public.artists_cache (deezer_id) WHERE deezer_id IS NOT NULL;

ALTER TABLE public.albums_cache
  ADD COLUMN IF NOT EXISTS deezer_id TEXT,
  ADD COLUMN IF NOT EXISTS artist_deezer_id TEXT,
  ALTER COLUMN mbid DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_cache_deezer_id
  ON public.albums_cache (deezer_id) WHERE deezer_id IS NOT NULL;

ALTER TABLE public.tracks_cache
  ADD COLUMN IF NOT EXISTS deezer_id TEXT,
  ADD COLUMN IF NOT EXISTS album_deezer_id TEXT,
  ADD COLUMN IF NOT EXISTS isrc TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_cache_deezer_id
  ON public.tracks_cache (deezer_id) WHERE deezer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_cache_album_deezer_id
  ON public.tracks_cache (album_deezer_id);
CREATE INDEX IF NOT EXISTS idx_tracks_cache_isrc
  ON public.tracks_cache (isrc);

-- 5. Update community RPCs to key on album_deezer_id
DROP FUNCTION IF EXISTS public.get_community_album_averages();
CREATE OR REPLACE FUNCTION public.get_community_album_averages()
 RETURNS TABLE(album_deezer_id text, avg_rating numeric, rater_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    album_deezer_id,
    ROUND(AVG(rating)::numeric, 1) as avg_rating,
    COUNT(DISTINCT user_id) as rater_count
  FROM public.album_ratings
  WHERE album_deezer_id IS NOT NULL
  GROUP BY album_deezer_id;
$function$;

DROP FUNCTION IF EXISTS public.get_community_track_averages(text);
CREATE OR REPLACE FUNCTION public.get_community_track_averages(p_album_deezer_id text)
 RETURNS TABLE(track_position integer, avg_rating numeric, rater_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    track_position,
    ROUND(AVG(rating)::numeric, 1) as avg_rating,
    COUNT(DISTINCT user_id) as rater_count
  FROM public.track_ratings
  WHERE album_deezer_id = p_album_deezer_id
  GROUP BY track_position
  ORDER BY track_position;
$function$;
