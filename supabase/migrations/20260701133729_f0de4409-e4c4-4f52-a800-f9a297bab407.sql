ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favorite_genres text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;