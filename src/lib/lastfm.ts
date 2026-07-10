/**
 * Last.fm API client -- artist genre tags + original album release dates.
 *
 * The API key is a publishable key (designed for browser use, rate-limited per key).
 * Replace LASTFM_API_KEY below with your own key from https://www.last.fm/api/account/create
 *
 * Tags are cached in `artists_cache.tags` with `tags_cached_at` to avoid hitting
 * Last.fm on every page view (TTL: 30 days). Cached tags are also re-filtered
 * on read so old "dirty" entries (band names, junk descriptors) disappear
 * immediately when this code ships, without waiting for the cache to expire.
 *
 * Original release dates are fetched via `album.getinfo` and cached in memory
 * for the browser session. This fixes Deezer catalog entries that carry a
 * remaster year (e.g. 2016) instead of the original year (e.g. 1983).
 */

import { supabase } from '@/integrations/supabase/client';
import { isWhitelistedTag } from './genreWhitelist';

// TODO: Replace with your Last.fm API key from https://www.last.fm/api/account/create
const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const TAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Junk/non-genre tags to filter out (Last.fm tags are user-generated and noisy).
// NOTE: this is the *negative* list -- the additional positive whitelist gate
// in genreWhitelist.ts (isWhitelistedTag) is now the authoritative
// "is this a real genre?" check. The blocklist is kept as a fast pre-filter
// and as a safety net for any edge case the whitelist misses.
const TAG_BLOCKLIST = new Set([
  // Listening behaviour
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite',
  'awesome', 'cool', 'love', 'love at first listen', 'amazing',
  'good', 'great', 'best', 'best of', 'top', 'masterpiece', 'classic',
  'beautiful', 'epic', 'chill', 'relaxing', 'energetic', 'sad', 'happy',
  // Platforms / formats
  'spotify', 'youtube', 'soundcloud', 'mp3', 'vinyl', 'cd',
  'albums i own', 'albums i love',
  // Vocal-related descriptors that masquerade as genres
  'male vocalists', 'female vocalists', 'male vocalist', 'female vocalist',
  // Nationalities / regions
  'american', 'british', 'english', 'usa', 'uk', 'us', 'canadian', 'australian',
  'german', 'french', 'swedish', 'norwegian', 'finnish', 'japanese',
  // Self-descriptors
  'singer-songwriter',
  'under 2000 listeners', 'overrated', 'underrated', 'mainstream',
  // Decades
  '00s', '10s', '20s', '60s', '70s', '80s', '90s',
  '2000s', '2010s', '2020s', '1960s', '1970s', '1980s', '1990s',
]);

interface LastfmTag {
  name: string;
  count: number;
  url: string;
}

interface LastfmTopTagsResponse {
  toptags?: { tag?: LastfmTag[] | LastfmTag };
  error?: number;
  message?: string;
}

/**
 * Aggressively normalise a string for comparison: lowercase, strip everything
 * that isn't a letter or digit. Used to match a tag against the artist name
 * even when one side has spaces, hyphens, "the" prefix, punctuation, etc.
 */
function compactKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Build the set of strings that should be filtered out as "this is the
 * artist's own name, not a genre". Includes the full name plus the version
 * with a leading "the " stripped (covers cases like "the beatles" -> "beatles").
 */
function artistNameKeys(artistName: string): Set<string> {
  const keys = new Set<string>();
  const lower = artistName.trim().toLowerCase();
  if (!lower) return keys;
  keys.add(compactKey(lower));
  if (lower.startsWith('the ')) keys.add(compactKey(lower.slice(4)));
  return keys;
}

/**
 * Decide whether a single raw Last.fm tag string should be kept. Drops the
 * blocklist, drops anything matching the artist's own name, drops pure
 * year/decade tokens, and drops tags whose count is zero.
 */
function isAcceptableTag(rawName: string, artistKeys: Set<string>): boolean {
  if (!rawName) return false;
  const lower = rawName.trim().toLowerCase();
  if (!lower) return false;
  if (TAG_BLOCKLIST.has(lower)) return false;
  // Pure year (e.g. "1991") or decade-with-suffix (e.g. "90's", "80'S")
  if (/^\d{4}$/.test(lower)) return false;
  if (/^[0-9]{2,4}'?s$/.test(lower)) return false;
  // Artist's own name (handles spacing/punctuation/"the" variants)
  if (artistKeys.has(compactKey(lower))) return false;
  return true;
}

function cleanTags(rawTags: LastfmTag[], artistName: string, limit = 20): string[] {
  const artistKeys = artistNameKeys(artistName);
  return rawTags
    .filter(t => t && isAcceptableTag(t.name, artistKeys))
    .filter(t => (t.count ?? 0) > 0)
    // Positive whitelist: only canonical music genres/sub-genres survive.
    // This is what keeps "awesome", "chill", or any other free-text tag out
    // of the cache even when they slip past TAG_BLOCKLIST.
    .filter(t => isWhitelistedTag(t.name))
    .slice(0, limit)
    .map(t => t.name.toLowerCase());
}

/**
 * Re-apply the current filter rules to an already-cached tag list. Used so
 * that old cache rows containing junk (e.g. the artist's own name) are
 * cleaned up at read time instead of waiting for the 30-day TTL.
 */
function filterCachedTags(cachedTags: string[], artistName: string, limit = 20): string[] {
  const artistKeys = artistNameKeys(artistName);
  const out: string[] = [];
  for (const t of cachedTags) {
    if (isAcceptableTag(t, artistKeys) && isWhitelistedTag(t)) {
      out.push(t.toLowerCase());
    }
    if (out.length >= limit) break;
  }
  return out;
}

async function fetchTagsFromLastfm(artistName: string): Promise<string[] | null> {
  if (!LASTFM_API_KEY || (LASTFM_API_KEY as string) === 'YOUR_LASTFM_API_KEY_HERE') {
    console.warn('[Last.fm] API key not configured');
    return null;
  }

  try {
    const url = `${LASTFM_BASE}?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as LastfmTopTagsResponse;
    if (json.error) {
      console.warn('[Last.fm] API error:', json.message);
      return null;
    }
    const raw = json.toptags?.tag;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return cleanTags(arr, artistName, 20);
  } catch (err) {
    console.error('[Last.fm] fetch failed:', err);
    return null;
  }
}

/**
 * Get genre tags for an artist. Reads from `artists_cache.tags` first
 * (stale-while-revalidate), then refreshes from Last.fm in background.
 * Cached tags are re-filtered through the current rules so newly added
 * blocklist entries / artist-name filtering apply immediately.
 */
export async function getArtistTags(deezerId: string, artistName: string): Promise<string[]> {
  if (!deezerId || !artistName) return [];

  const { data: cached } = await supabase
    .from('artists_cache')
    .select('tags, tags_cached_at')
    .eq('deezer_id', deezerId)
    .maybeSingle();

  if (cached?.tags && cached.tags.length > 5) {
    const cleaned = filterCachedTags(cached.tags, artistName, 20);
    const cachedAt = cached.tags_cached_at ? new Date(cached.tags_cached_at).getTime() : 0;
    const age = Date.now() - cachedAt;
    if (age > TAGS_TTL_MS || cleaned.length < cached.tags.length) {
      void refreshTags(deezerId, artistName);
    }
    if (cleaned.length > 0) return cleaned;
  }

  const tags = await fetchTagsFromLastfm(artistName);
  if (tags && tags.length > 0) {
    void supabase
      .from('artists_cache')
      .update({ tags, tags_cached_at: new Date().toISOString() })
      .eq('deezer_id', deezerId)
      .then(({ error }) => { if (error) console.warn('[Last.fm] tag cache update error:', error); });
  }
  return tags ?? [];
}

async function refreshTags(deezerId: string, artistName: string): Promise<void> {
  const tags = await fetchTagsFromLastfm(artistName);
  if (!tags || tags.length === 0) return;
  await supabase
    .from('artists_cache')
    .update({ tags, tags_cached_at: new Date().toISOString() })
    .eq('deezer_id', deezerId);
}

// --- Original album release dates ---

interface LastfmAlbumInfoResponse {
  album?: {
    name?: string;
    releasedate?: string;
    wiki?: {
      summary?: string;
      content?: string;
      published?: string;
    };
  };
  error?: number;
  message?: string;
}

/**
 * Extract an original release date from Last.fm's wiki summary text.
 * Last.fm dropped the structured `releasedate` field, but the wiki blurb
 * still opens with phrases like:
 *   "…released on July 27, 1984, by Megaforce Records."
 *   "…released on 27 July 1984…"
 *   "…released in 1984…"
 * We parse those into YYYY-MM-DD. This is our primary source of original
 * (non-remaster) dates now that `releasedate` is gone.
 */
function parseReleaseFromWiki(text: string | undefined): string | null {
  if (!text) return null;
  // "released on July 27, 1984" / "released July 27, 1984"
  const monthFirst = text.match(/\breleased\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (monthFirst) {
    const parsed = parseLastfmDate(monthFirst[1]);
    if (parsed) return parsed;
  }
  // "released on 27 July 1984"
  const dayFirst = text.match(/\breleased\s+(?:on\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (dayFirst) {
    const parsed = parseLastfmDate(dayFirst[1]);
    if (parsed) return parsed;
  }
  // "released in 1984" / "released on 1984"
  const yearOnly = text.match(/\breleased\s+(?:on\s+|in\s+)?(\d{4})\b/i);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  return null;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/**
 * Parse the many date formats Last.fm uses for album.releasedate into
 * a normalised YYYY-MM-DD string. Returns null when no valid date is found.
 *
 *  "23 Jul 1983, 00:00" -> "1983-07-23"
 *  "1983-07-25"         -> "1983-07-25"
 *  "1983"               -> "1983-01-01"
 *  "  \n  "             -> null
 */
function parseLastfmDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO-ish: "1983-07-25" or "1983-07-25T00:00:00"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // "23 Jul 1983, 00:00" or "23 July 1983" -- day-first
  const dayFirst = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (dayFirst) {
    const month = MONTH_MAP[dayFirst[2].slice(0, 3).toLowerCase()];
    if (month) return `${dayFirst[3]}-${month}-${dayFirst[1].padStart(2, '0')}`;
  }

  // "July 23, 1983" -- month-first
  const monthFirst = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthFirst) {
    const month = MONTH_MAP[monthFirst[1].slice(0, 3).toLowerCase()];
    if (month) return `${monthFirst[3]}-${month}-${monthFirst[2].padStart(2, '0')}`;
  }

  // Bare year: "1983"
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  // Last resort -- extract any 4-digit year
  const anywhere = s.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (anywhere) return `${anywhere[1]}-01-01`;

  return null;
}

// Session memory cache: "artistName::cleanTitle" -> ISO-date promise
const LASTFM_DATE_CACHE = new Map<string, Promise<string | null>>();

function fetchAlbumDateFromLastfm(
  artistName: string,
  albumTitle: string,
): Promise<string | null> {
  const key = `${artistName}::${albumTitle}`;
  if (LASTFM_DATE_CACHE.has(key)) return LASTFM_DATE_CACHE.get(key)!;

  const promise = (async (): Promise<string | null> => {
    if (!LASTFM_API_KEY) return null;
    try {
      const url =
        `${LASTFM_BASE}?method=album.getinfo` +
        `&artist=${encodeURIComponent(artistName)}` +
        `&album=${encodeURIComponent(albumTitle)}` +
        `&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = (await res.json()) as LastfmAlbumInfoResponse;
      if (json.error) return null;
      // Primary: legacy `releasedate` field (still present for some albums).
      // Fallback: parse the wiki summary/content — Last.fm removed the
      // structured date for most albums but the wiki blurb still contains it.
      return (
        parseLastfmDate(json.album?.releasedate) ??
        parseReleaseFromWiki(json.album?.wiki?.summary) ??
        parseReleaseFromWiki(json.album?.wiki?.content)
      );
    } catch {
      return null;
    }
  })();

  LASTFM_DATE_CACHE.set(key, promise);
  return promise;
}

/**
 * Fetch the original release dates for a list of albums from Last.fm's
 * `album.getinfo` endpoint.
 *
 * Last.fm stores historical release dates, so it returns 1983 for Kill 'Em All
 * while Deezer may return 2016 (the remaster upload year). This function is
 * called by `getArtistAlbums()` in deezer.ts to correct those dates before
 * they reach the UI.
 *
 * Results are cached in memory for the browser session so subsequent visits
 * to the same artist page are instant (no extra network requests).
 *
 * @param artistName  Artist name for the Last.fm query.
 * @param albums      Entries need `cleanTitle` (for the API call) and
 *                    `normalizedTitle` (the dedup key for the returned map).
 * @returns           Map<normalizedTitle, YYYY-MM-DD>
 */
export async function getOriginalReleaseDateMap(
  artistName: string,
  albums: Array<{ normalizedTitle: string; cleanTitle: string }>,
): Promise<Map<string, string>> {
  if (!artistName || albums.length === 0) return new Map();

  // Deduplicate by normalizedTitle to avoid redundant API calls for variants
  const unique = Array.from(
    new Map(albums.map(a => [a.normalizedTitle, a])).values(),
  );

  const CONCURRENCY = 4;
  const results = new Map<string, string>();

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    await Promise.all(
      unique.slice(i, i + CONCURRENCY).map(async album => {
        const date = await fetchAlbumDateFromLastfm(artistName, album.cleanTitle);
        if (date) results.set(album.normalizedTitle, date);
      }),
    );
  }

  return results;
}
