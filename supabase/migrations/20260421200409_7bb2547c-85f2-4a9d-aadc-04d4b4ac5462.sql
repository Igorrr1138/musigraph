-- Speed up rating reads (filter by user_id, sort by rated_at)
CREATE INDEX IF NOT EXISTS idx_album_ratings_user_rated_at
  ON public.album_ratings (user_id, rated_at DESC);

CREATE INDEX IF NOT EXISTS idx_track_ratings_user_rated_at
  ON public.track_ratings (user_id, rated_at DESC);

-- Speed up community aggregate functions
CREATE INDEX IF NOT EXISTS idx_album_ratings_album_mbid
  ON public.album_ratings (album_mbid);

CREATE INDEX IF NOT EXISTS idx_track_ratings_album_mbid_position
  ON public.track_ratings (album_mbid, track_position);