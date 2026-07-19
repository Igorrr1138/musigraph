ALTER TABLE public.music_cache RENAME COLUMN wikidata_qid TO mbid;
TRUNCATE public.music_cache;