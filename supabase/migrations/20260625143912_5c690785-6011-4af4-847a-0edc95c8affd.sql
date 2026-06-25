
CREATE TABLE public.album_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  album_deezer_id TEXT NOT NULL,
  review_text TEXT NOT NULL DEFAULT '',
  review_tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, album_deezer_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.album_reviews TO authenticated;
GRANT ALL ON public.album_reviews TO service_role;

ALTER TABLE public.album_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own album reviews" ON public.album_reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own album reviews" ON public.album_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own album reviews" ON public.album_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own album reviews" ON public.album_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_album_reviews_updated_at BEFORE UPDATE ON public.album_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
