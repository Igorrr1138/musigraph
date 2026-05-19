
CREATE TABLE public.playlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own playlists" ON public.playlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own playlists" ON public.playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own playlists" ON public.playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own playlists" ON public.playlists FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_playlists_updated_at
BEFORE UPDATE ON public.playlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.playlist_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  track_deezer_id TEXT NOT NULL,
  track_title TEXT NOT NULL,
  artist_name TEXT,
  artist_deezer_id TEXT,
  album_title TEXT,
  album_deezer_id TEXT,
  cover_url TEXT,
  duration_seconds INTEGER,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own playlist tracks" ON public.playlist_tracks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own playlist tracks" ON public.playlist_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own playlist tracks" ON public.playlist_tracks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own playlist tracks" ON public.playlist_tracks FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_playlist_tracks_playlist ON public.playlist_tracks(playlist_id, position);
