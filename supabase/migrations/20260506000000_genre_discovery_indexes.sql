-- Genre Discovery: speed up artists_cache lookups used by /genre/:slug.
--
-- The discovery query is `WHERE tags @> ARRAY['<genre>']` on TEXT[],
-- which Postgres can answer from a GIN index in O(log n) instead of a seq
-- scan. Country filter is a simple equality predicate, so a btree index
-- with a partial NOT NULL filter is enough.

CREATE INDEX IF NOT EXISTS idx_artists_cache_tags_gin
  ON public.artists_cache USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_artists_cache_country
  ON public.artists_cache (country)
  WHERE country IS NOT NULL;
