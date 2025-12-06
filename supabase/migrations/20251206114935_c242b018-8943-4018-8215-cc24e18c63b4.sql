-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (new.id, new.raw_user_meta_data ->> 'username');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create artists cache table
CREATE TABLE public.artists_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mbid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  disambiguation TEXT,
  country TEXT,
  life_span_begin TEXT,
  life_span_end TEXT,
  description TEXT,
  image_url TEXT,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.artists_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view artists cache" ON public.artists_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert artists cache" ON public.artists_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update artists cache" ON public.artists_cache FOR UPDATE USING (true);

-- Create albums cache table
CREATE TABLE public.albums_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mbid TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  artist_mbid TEXT REFERENCES public.artists_cache(mbid),
  artist_name TEXT,
  release_date TEXT,
  cover_url TEXT,
  track_count INTEGER,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.albums_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view albums cache" ON public.albums_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert albums cache" ON public.albums_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update albums cache" ON public.albums_cache FOR UPDATE USING (true);

-- Create tracks cache table
CREATE TABLE public.tracks_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mbid TEXT UNIQUE,
  title TEXT NOT NULL,
  album_mbid TEXT REFERENCES public.albums_cache(mbid),
  position INTEGER,
  duration_ms INTEGER,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view tracks cache" ON public.tracks_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tracks cache" ON public.tracks_cache FOR INSERT WITH CHECK (true);

-- Create album ratings table
CREATE TABLE public.album_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  album_mbid TEXT NOT NULL,
  album_title TEXT NOT NULL,
  artist_name TEXT,
  cover_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  rated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, album_mbid)
);

ALTER TABLE public.album_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ratings" ON public.album_ratings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ratings" ON public.album_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON public.album_ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON public.album_ratings FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();