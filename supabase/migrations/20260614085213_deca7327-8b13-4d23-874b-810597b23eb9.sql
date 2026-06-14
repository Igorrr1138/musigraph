
-- 1) Restrict cache writes to authenticated users
DROP POLICY IF EXISTS "Anyone can insert artists cache" ON public.artists_cache;
DROP POLICY IF EXISTS "Anyone can update artists cache" ON public.artists_cache;
DROP POLICY IF EXISTS "Anyone can insert albums cache" ON public.albums_cache;
DROP POLICY IF EXISTS "Anyone can update albums cache" ON public.albums_cache;
DROP POLICY IF EXISTS "Anyone can insert tracks cache" ON public.tracks_cache;
DROP POLICY IF EXISTS "Anyone can update tracks cache" ON public.tracks_cache;

CREATE POLICY "Authenticated users can insert artists cache"
  ON public.artists_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update artists cache"
  ON public.artists_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert albums cache"
  ON public.albums_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update albums cache"
  ON public.albums_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert tracks cache"
  ON public.tracks_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tracks cache"
  ON public.tracks_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2) Sanitize username in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    new.id,
    COALESCE(
      NULLIF(TRIM(LEFT(new.raw_user_meta_data ->> 'username', 50)), ''),
      SPLIT_PART(new.email, '@', 1)
    )
  );
  RETURN new;
END;
$function$;
