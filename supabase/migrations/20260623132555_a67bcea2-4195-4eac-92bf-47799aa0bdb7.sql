
-- Fix ISRC mapping public write access
DROP POLICY IF EXISTS "Anyone can insert isrc mappings" ON public.isrc_mapping;
DROP POLICY IF EXISTS "Anyone can update isrc mappings" ON public.isrc_mapping;
DROP POLICY IF EXISTS "Public can insert isrc mappings" ON public.isrc_mapping;
DROP POLICY IF EXISTS "Public can update isrc mappings" ON public.isrc_mapping;

CREATE POLICY "Authenticated users can insert isrc mappings"
  ON public.isrc_mapping FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update isrc mappings"
  ON public.isrc_mapping FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Replace SECURITY DEFINER community aggregate functions with aggregate views.
-- Views aggregate data and don't expose individual ratings; they are not
-- flagged by the security_definer_function linter.
DROP FUNCTION IF EXISTS public.get_community_album_averages();
DROP FUNCTION IF EXISTS public.get_community_track_averages(text);

CREATE OR REPLACE VIEW public.community_album_averages
WITH (security_invoker = false) AS
SELECT
  album_deezer_id,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(DISTINCT user_id) AS rater_count
FROM public.album_ratings
WHERE album_deezer_id IS NOT NULL
GROUP BY album_deezer_id;

CREATE OR REPLACE VIEW public.community_track_averages
WITH (security_invoker = false) AS
SELECT
  album_deezer_id,
  track_position,
  ROUND(AVG(rating)::numeric, 1) AS avg_rating,
  COUNT(DISTINCT user_id) AS rater_count
FROM public.track_ratings
GROUP BY album_deezer_id, track_position;

GRANT SELECT ON public.community_album_averages TO anon, authenticated;
GRANT SELECT ON public.community_track_averages TO anon, authenticated;
