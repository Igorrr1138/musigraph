-- Create provider_accounts table
CREATE TABLE public.provider_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  provider_name text NOT NULL CHECK (provider_name IN ('spotify', 'apple', 'google', 'youtube')),
  provider_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_name)
);

ALTER TABLE public.provider_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provider accounts"
  ON public.provider_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own provider accounts"
  ON public.provider_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own provider accounts"
  ON public.provider_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own provider accounts"
  ON public.provider_accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_provider_accounts_updated_at
  BEFORE UPDATE ON public.provider_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create isrc_mapping table
CREATE TABLE public.isrc_mapping (
  isrc text PRIMARY KEY,
  spotify_id text,
  apple_music_id text,
  youtube_video_id text,
  musicbrainz_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.isrc_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ISRC mappings"
  ON public.isrc_mapping FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert ISRC mappings"
  ON public.isrc_mapping FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update ISRC mappings"
  ON public.isrc_mapping FOR UPDATE
  USING (true);

CREATE TRIGGER update_isrc_mapping_updated_at
  BEFORE UPDATE ON public.isrc_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS primary_provider text DEFAULT 'youtube' CHECK (primary_provider IN ('spotify', 'apple', 'youtube')),
  ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false;