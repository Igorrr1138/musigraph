
CREATE TABLE public.track_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  album_mbid text NOT NULL,
  track_mbid text,
  track_title text NOT NULL,
  track_position integer NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 10),
  rated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, album_mbid, track_position)
);

ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own track ratings" ON public.track_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own track ratings" ON public.track_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own track ratings" ON public.track_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own track ratings" ON public.track_ratings FOR DELETE USING (auth.uid() = user_id);
