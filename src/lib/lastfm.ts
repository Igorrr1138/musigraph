/**
 * Last.fm API client — used to fetch genre/style tags for artists.
 *
 * The API key is a publishable key (designed for browser use, rate-limited per key).
 * Replace LASTFM_API_KEY below with your own key from https://www.last.fm/api/account/create
 *
 * Tags are cached in `artists_cache.tags` with `tags_cached_at` to avoid hitting
 * Last.fm on every page view (TTL: 30 days). Cached tags are also re-filtered
 * on read so old "dirty" entries (band names, junk descriptors) disappear
 * immediately when this code ships, without waiting for the cache to expire.
 */

import { supabase } from '@/integrations/supabase/client';

// TODO: Replace with your Last.fm API key from https://www.last.fm/api/account/create
const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const TAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Junk/non-genre tags to filter out (Last.fm tags are user-generated and noisy)
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
 * with a leading "the " stripped (covers cases like "the beatles" → "beatles").
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

function cleanTags(rawTags: LastfmTag[], artistName: string, limit = 5): string[] {
  const artistKeys = artistNameKeys(artistName);
  return rawTags
    .filter(t => t && isAcceptableTag(t.name, artistKeys))
    .filter(t => (t.count ?? 0) > 0)
    .slice(0, limit)
    .map(t => t.name.toLowerCase());
}

/**
 * Re-apply the current filter rules to an already-cached tag list. Used so
 * that old cache rows containing junk (e.g. the artist's own name) are
 * cleaned up at read time instead of waiting for the 30-day TTL.
 */
function filterCachedTags(cachedTags: string[], artistName: string, limit = 5): string[] {
  const artistKeys = artistNameKeys(artistName);
  const out: string[] = [];
  for (const t of cachedTags) {
    if (isAcceptableTag(t, artistKeys)) out.push(t.toLowerCase());
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
    return cleanTags(arr, artistName, 5);
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

  if (cached?.tags && cached.tags.length > 0) {
    const cleaned = filterCachedTags(cached.tags, artistName, 5);
    const cachedAt = cached.tags_cached_at ? new Date(cached.tags_cached_at).getTime() : 0;
    const age = Date.now() - cachedAt;
    // Refresh in the background if expired OR if filtering removed anything
    // (i.e. the cache is dirty by current rules and worth re-fetching).
    if (age > TAGS_TTL_MS || cleaned.length < cached.tags.length) {
      void refreshTags(deezerId, artistName);
    }
    if (cleaned.length > 0) return cleaned;
    // Fall through to a fresh fetch if filtering wiped everything
  }

  // No (usable) cached tags — fetch synchronously this time
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
