
DROP VIEW IF EXISTS public.community_track_criteria;

DROP POLICY IF EXISTS "track_metadata writable by auth" ON public.track_metadata;
DROP POLICY IF EXISTS "track_metadata updatable by auth" ON public.track_metadata;
CREATE POLICY "track_metadata insert auth" ON public.track_metadata FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "track_metadata update auth" ON public.track_metadata FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "track_lyrics writable by auth" ON public.track_lyrics;
DROP POLICY IF EXISTS "track_lyrics updatable by auth" ON public.track_lyrics;
CREATE POLICY "track_lyrics insert auth" ON public.track_lyrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "track_lyrics update auth" ON public.track_lyrics FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
