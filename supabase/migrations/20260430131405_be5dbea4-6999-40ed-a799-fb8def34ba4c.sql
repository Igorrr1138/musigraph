ALTER TABLE public.artists_cache ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.artists_cache ADD COLUMN IF NOT EXISTS tags_cached_at TIMESTAMPTZ;