ALTER TABLE public.artists_cache ADD CONSTRAINT artists_cache_deezer_id_key UNIQUE (deezer_id);
ALTER TABLE public.albums_cache ADD CONSTRAINT albums_cache_deezer_id_key UNIQUE (deezer_id);
ALTER TABLE public.tracks_cache ADD CONSTRAINT tracks_cache_deezer_id_key UNIQUE (deezer_id);