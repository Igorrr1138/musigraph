
-- Shared track metadata cache
CREATE TABLE public.track_metadata (
  track_deezer_id TEXT PRIMARY KEY,
  album_deezer_id TEXT,
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.track_metadata TO anon, authenticated;
GRANT INSERT, UPDATE ON public.track_metadata TO authenticated;
GRANT ALL ON public.track_metadata TO service_role;
ALTER TABLE public.track_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "track_metadata readable by all" ON public.track_metadata FOR SELECT USING (true);
CREATE POLICY "track_metadata writable by auth" ON public.track_metadata FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "track_metadata updatable by auth" ON public.track_metadata FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Shared lyrics cache
CREATE TABLE public.track_lyrics (
  track_deezer_id TEXT PRIMARY KEY,
  plain_text TEXT,
  synced JSONB,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.track_lyrics TO anon, authenticated;
GRANT INSERT, UPDATE ON public.track_lyrics TO authenticated;
GRANT ALL ON public.track_lyrics TO service_role;
ALTER TABLE public.track_lyrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "track_lyrics readable by all" ON public.track_lyrics FOR SELECT USING (true);
CREATE POLICY "track_lyrics writable by auth" ON public.track_lyrics FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "track_lyrics updatable by auth" ON public.track_lyrics FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Per-user deep criteria scores
CREATE TABLE public.track_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_deezer_id TEXT NOT NULL,
  album_deezer_id TEXT,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_deezer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_criteria TO authenticated;
GRANT ALL ON public.track_criteria TO service_role;
ALTER TABLE public.track_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "track_criteria own select" ON public.track_criteria FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "track_criteria own insert" ON public.track_criteria FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "track_criteria own update" ON public.track_criteria FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "track_criteria own delete" ON public.track_criteria FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Per-user criteria preferences
CREATE TABLE public.criteria_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  visible_criteria TEXT[] NOT NULL DEFAULT ARRAY['lyrics','instrumental','energy','complexity','mood']::TEXT[],
  criteria_order TEXT[] NOT NULL DEFAULT ARRAY['lyrics','instrumental','energy','complexity','mood']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criteria_preferences TO authenticated;
GRANT ALL ON public.criteria_preferences TO service_role;
ALTER TABLE public.criteria_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criteria_preferences own select" ON public.criteria_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "criteria_preferences own insert" ON public.criteria_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "criteria_preferences own update" ON public.criteria_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Per-user track reviews
CREATE TABLE public.track_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_deezer_id TEXT NOT NULL,
  album_deezer_id TEXT,
  review TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, track_deezer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.track_reviews TO authenticated;
GRANT ALL ON public.track_reviews TO service_role;
ALTER TABLE public.track_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "track_reviews own select" ON public.track_reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "track_reviews own insert" ON public.track_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "track_reviews own update" ON public.track_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "track_reviews own delete" ON public.track_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_track_metadata_updated_at BEFORE UPDATE ON public.track_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_track_lyrics_updated_at BEFORE UPDATE ON public.track_lyrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_track_criteria_updated_at BEFORE UPDATE ON public.track_criteria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_criteria_preferences_updated_at BEFORE UPDATE ON public.criteria_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_track_reviews_updated_at BEFORE UPDATE ON public.track_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Community aggregated criteria view (bypasses RLS, returns averages only)
CREATE OR REPLACE VIEW public.community_track_criteria
WITH (security_invoker = false) AS
SELECT
  tc.track_deezer_id,
  kv.key AS criterion,
  ROUND(AVG((kv.value)::numeric), 1) AS avg_score,
  COUNT(DISTINCT tc.user_id) AS rater_count
FROM public.track_criteria tc,
     LATERAL jsonb_each_text(tc.scores) AS kv(key, value)
WHERE kv.value ~ '^[0-9]+(\.[0-9]+)?$'
GROUP BY tc.track_deezer_id, kv.key;

GRANT SELECT ON public.community_track_criteria TO anon, authenticated;
