/**
 * Last.fm API client — artist genre tags only.
 *
 * Last.fm is the *fallback* genre source. Wikidata P136 (via `wikidata.ts`)
 * is the primary. Genre tags are cached in `artists_cache.tags` with
 * `tags_cached_at` (TTL 30 days). Cached tags are re-filtered on read so
 * old "dirty" entries disappear immediately when this code ships.
 *
 * Historical release-date lookup has been removed — that pipeline now uses
 * Wikidata P577. See `src/lib/musicPipeline.ts`.
 */

import { supabase } from '@/integrations/supabase/client';
import { isWhitelistedTag } from './genreWhitelist';

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const TAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Junk/non-genre tags. The positive whitelist in genreWhitelist.ts is the
// authoritative "is this a real genre?" check; this list is a fast pre-filter.
const TAG_BLOCKLIST = new Set([
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite',
  'awesome', 'cool', 'love', 'love at first listen', 'amazing',
  'good', 'great', 'best', 'best of', 'top', 'masterpiece', 'classic',
  'beautiful', 'epic', 'chill', 'relaxing', 'energetic', 'sad', 'happy',
  'spotify', 'youtube', 'soundcloud', 'mp3', 'vinyl', 'cd',
  'albums i own', 'albums i love',
  'male vocalists', 'female vocalists', 'male vocalist', 'female vocalist',
  'american', 'british', 'english', 'usa', 'uk', 'us', 'canadian', 'australian',
  'german', 'french', 'swedish', 'norwegian', 'finnish', 'japanese',
  'singer-songwriter',
  'under 2000 listeners', 'overrated', 'underrated', 'mainstream',
  '00s', '10s', '20s', '60s', '70s', '80s', '90s',
  '2000s', '2010s', '2020s', '1960s', '1970s', '1980s', '1990s',
]);

interface LastfmTag { name: string; count: number; url: string; }
interface LastfmTopTagsResponse {
  toptags?: { tag?: LastfmTag[] | LastfmTag };
  error?: number;
  message?: string;
}

function compactKey(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

function artistNameKeys(artistName: string): Set<string> {
  const keys = new Set<string>();
  const lower = artistName.trim().toLowerCase();
  if (!lower) return keys;
  keys.add(compactKey(lower));
  if (lower.startsWith('the ')) keys.add(compactKey(lower.slice(4)));
  return keys;
}

function isAcceptableTag(rawName: string, artistKeys: Set<string>): boolean {
  if (!rawName) return false;
  const lower = rawName.trim().toLowerCase();
  if (!lower) return false;
  if (TAG_BLOCKLIST.has(lower)) return false;
  if (/^\d{4}$/.test(lower)) return false;
  if (/^[0-9]{2,4}'?s$/.test(lower)) return false;
  if (artistKeys.has(compactKey(lower))) return false;
  return true;
}

function cleanTags(rawTags: LastfmTag[], artistName: string, limit = 20): string[] {
  const artistKeys = artistNameKeys(artistName);
  return rawTags
    .filter(t => t && isAcceptableTag(t.name, artistKeys))
    .filter(t => (t.count ?? 0) > 0)
    .filter(t => isWhitelistedTag(t.name))
    .slice(0, limit)
    .map(t => t.name.toLowerCase());
}

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
  if (!LASTFM_API_KEY) return null;
  try {
    const url = `${LASTFM_BASE}?method=artist.gettoptags&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as LastfmTopTagsResponse;
    if (json.error) return null;
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
