/**
 * Genre Discovery -- artist lookup pipeline for /genre/:slug.
 *
 * Cache-first contract:
 *   1. Read artists_cache filtered by `tags @> [<genre.key>]`.
 *   2. If we don't have enough rows, query Last.fm `tag.gettopartists`.
 *   3. Resolve each new artist via Deezer search (existing JSONP path).
 *   4. Persist the new rows back to artists_cache so the next visit is a
 *      pure cache hit (no Last.fm/Deezer roundtrip).
 *
 * Country / Decade filters and Top/Newest/Oldest sort are applied in
 * memory after the merged result is in hand. Decade is bucketed off
 * `life_span_begin` from the MusicBrainz-backed cache rows; artists
 * without a known year fall outside any specific decade filter (i.e. the
 * filter is conservative -- it never includes unknowns).
 */

import { supabase } from '@/integrations/supabase/client';
import { searchArtists, searchAlbums, type DeezerArtist, type DeezerAlbum } from './deezer';
import { genreFromSlug, type WhitelistedGenre } from './genreWhitelist';

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

export type SortMode = 'top' | 'newest' | 'oldest';

export interface DiscoveryFilters {
  country?: string | null;
  /** First year of the decade bucket, e.g. 1990 for the 1990s. */
  decade?: number | null;
  sort?: SortMode;
  /** Page size. Defaults to 24 -- ~6 grid rows on desktop. */
  limit?: number;
}

export interface DiscoveryArtist extends DeezerArtist {
  /** ISO-ish country code from artists_cache.country, when known. */
  country?: string | null;
  /** Bucketed start year (e.g. 1990) derived from life_span_begin. */
  decadeYear?: number | null;
  /** Popularity proxy used for the 'top' sort (currently unused -- TODO). */
  popularity?: number | null;
  /** Cached genre tags so the card can render badges without another fetch. */
  tags?: string[] | null;
}

interface CachedArtistRow {
  deezer_id: string | null;
  name: string;
  image_url: string | null;
  country: string | null;
  life_span_begin: string | null;
  tags: string[] | null;
}

/** Extract the first 4-digit year from a MusicBrainz life_span_begin string. */
function decadeFromYearString(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/(\d{4})/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return Math.floor(y / 10) * 10;
}

/**
 * Pull the canonical artist names for a genre from Last.fm. Returns names
 * only -- the caller resolves them through Deezer for image/id metadata so
 * we don't introduce a second album/image source.
 */
async function fetchTopArtistNamesFromLastfm(genre: WhitelistedGenre, limit: number): Promise<string[]> {
  if (!LASTFM_API_KEY) return [];
  try {
    const url =
      `${LASTFM_BASE}?method=tag.gettopartists` +
      `&tag=${encodeURIComponent(genre.key)}` +
      `&limit=${Math.min(Math.max(limit, 1), 100)}` +
      `&api_key=${LASTFM_API_KEY}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { topartists?: { artist?: Array<{ name?: string }> | { name?: string } } };
    const raw = json.topartists?.artist;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.map(a => a?.name ?? '').filter((n): n is string => Boolean(n));
  } catch (err) {
    console.warn('[genreDiscovery] Last.fm tag.gettopartists failed:', err);
    return [];
  }
}

/**
 * Cache-first artist lookup for a genre slug + active filters.
 */
export async function getArtistsByGenre(
  slug: string,
  { country, decade, sort = 'top', limit = 24 }: DiscoveryFilters = {},
): Promise<DiscoveryArtist[]> {
  const genre = genreFromSlug(slug);
  if (!genre) return [];

  // ---- Step 1: cache hit on artists_cache.tags ----
  const { data: cached, error: cacheErr } = await supabase
    .from('artists_cache')
    .select('deezer_id, name, image_url, country, life_span_begin, tags')
    .contains('tags', [genre.key])
    .limit(limit * 2);

  if (cacheErr) {
    console.warn('[genreDiscovery] cache read failed:', cacheErr);
  }

  const rows: CachedArtistRow[] = (cached ?? []) as CachedArtistRow[];

  // ---- Step 2: top up from Last.fm if we're under target ----
  if (rows.length < limit) {
    const remoteNames = await fetchTopArtistNamesFromLastfm(genre, limit * 2);
    const haveLower = new Set(rows.map(r => r.name.toLowerCase()));
    const missing = remoteNames.filter(n => !haveLower.has(n.toLowerCase()));

    const concurrency = 4;
    for (let i = 0; i < missing.length && rows.length < limit * 2; i += concurrency) {
      const slice = missing.slice(i, i + concurrency);
      const resolved = await Promise.all(slice.map(name => searchArtists(name, 1)));
      for (const list of resolved) {
        const artist = list[0];
        if (!artist) continue;
        const imageUrl = artist.picture_xl ?? artist.picture_big ?? artist.picture_medium ?? null;
        rows.push({
          deezer_id: String(artist.id),
          name: artist.name,
          image_url: imageUrl,
          country: null,
          life_span_begin: null,
          tags: [genre.key],
        });
        // Persist back to cache (best-effort, fire-and-forget).
        void supabase
          .from('artists_cache')
          .upsert(
            {
              deezer_id: String(artist.id),
              name: artist.name,
              image_url: imageUrl,
              tags: [genre.key],
              tags_cached_at: new Date().toISOString(),
              cached_at: new Date().toISOString(),
            },
            { onConflict: 'deezer_id' },
          )
          .then(({ error }) => {
            if (error) console.warn('[genreDiscovery] cache upsert failed:', error);
          });
      }
    }
  }

  // ---- Step 3: hydrate to DiscoveryArtist shape ----
  let results: DiscoveryArtist[] = rows.map(r => ({
    id: r.deezer_id ?? r.name,
    name: r.name,
    picture_xl: r.image_url ?? undefined,
    picture_big: r.image_url ?? undefined,
    country: r.country,
    decadeYear: decadeFromYearString(r.life_span_begin),
    tags: r.tags,
    popularity: null,
  }));

  // ---- Step 4: in-memory filtering ----
  if (country && country.trim()) {
    const wanted = country.trim().toLowerCase();
    results = results.filter(a => (a.country ?? '').toLowerCase() === wanted);
  }
  if (typeof decade === 'number' && Number.isFinite(decade)) {
    results = results.filter(a => a.decadeYear === decade);
  }

  // ---- Step 5: sort ----
  results = results.slice().sort((a, b) => {
    if (sort === 'newest') return (b.decadeYear ?? 0) - (a.decadeYear ?? 0);
    if (sort === 'oldest') return (a.decadeYear ?? 9999) - (b.decadeYear ?? 9999);
    // 'top' -- popularity is not yet wired to a real signal; alphabetical by
    // name keeps order stable across reloads. TODO: replace with Spotify
    // popularity or aggregated album_ratings rater_count.
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}
