
CREATE TABLE public.music_cache (
  artist_deezer_id text PRIMARY KEY,
  wikidata_qid     text,
  source           text NOT NULL DEFAULT 'wikidata',
  data             jsonb NOT NULL,
  cached_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.music_cache TO anon;
GRANT SELECT, INSERT, UPDATE ON public.music_cache TO authenticated;
GRANT ALL ON public.music_cache TO service_role;

ALTER TABLE public.music_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view music cache"
  ON public.music_cache FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert music cache"
  ON public.music_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update music cache"
  ON public.music_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_music_cache_updated_at
  BEFORE UPDATE ON public.music_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX music_cache_wikidata_qid_idx ON public.music_cache (wikidata_qid);
