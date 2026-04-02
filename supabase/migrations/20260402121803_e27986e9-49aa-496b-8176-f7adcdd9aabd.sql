
-- Function to get community average ratings per album
CREATE OR REPLACE FUNCTION public.get_community_album_averages()
RETURNS TABLE(album_mbid text, avg_rating numeric, rater_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    album_mbid,
    ROUND(AVG(rating)::numeric, 1) as avg_rating,
    COUNT(DISTINCT user_id) as rater_count
  FROM public.album_ratings
  GROUP BY album_mbid;
$$;

-- Function to get community average track ratings for a specific album
CREATE OR REPLACE FUNCTION public.get_community_track_averages(p_album_mbid text)
RETURNS TABLE(track_position integer, avg_rating numeric, rater_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    track_position,
    ROUND(AVG(rating)::numeric, 1) as avg_rating,
    COUNT(DISTINCT user_id) as rater_count
  FROM public.track_ratings
  WHERE album_mbid = p_album_mbid
  GROUP BY track_position
  ORDER BY track_position;
$$;
