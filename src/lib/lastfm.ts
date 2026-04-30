/**
 * Last.fm API client — used to fetch genre/style tags for artists.
 *
 * The API key is a publishable key (designed for browser use, rate-limited per key).
 * Replace LASTFM_API_KEY below with your own key from https://www.last.fm/api/account/create
 *
 * Tags are cached in `artists_cache.tags` with `tags_cached_at` to avoid hitting
 * Last.fm on every page view (TTL: 30 days).
 */

import { supabase } from '@/integrations/supabase/client';

// TODO: Replace with your Last.fm API key from https://www.last.fm/api/account/create
const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const TAGS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Junk/non-genre tags to filter out (Last.fm tags are user-generated and noisy)
const TAG_BLOCKLIST = new Set([
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite',
  'awesome', 'cool', 'love', 'love at first listen', 'amazing',
  'spotify', 'youtube', 'soundcloud', 'mp3', 'albums i own',
  'male vocalists', 'female vocalists', 'male vocalist', 'female vocalist',
  'american', 'british', 'english', 'usa', 'uk', 'us', 'canadian', 'australian',
  'singer-songwriter', // often duplicates genre signal
  'under 2000 listeners', 'overrated', 'underrated',
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

function cleanTags(rawTags: LastfmTag[], limit = 5): string[] {
  return rawTags
    .filter(t => t && t.name && !TAG_BLOCKLIST.has(t.name.toLowerCase()))
    .filter(t => (t.count ?? 0) > 0)
    .slice(0, limit)
    .map(t => t.name.toLowerCase());
}

async function fetchTagsFromLastfm(artistName: string): Promise<string[] | null> {
  if (!LASTFM_API_KEY || LASTFM_API_KEY === 'YOUR_LASTFM_API_KEY_HERE') {
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
    return cleanTags(arr, 5);
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

  if (cached?.tags && cached.tags.length > 0) {
    const cachedAt = cached.tags_cached_at ? new Date(cached.tags_cached_at).getTime() : 0;
    const age = Date.now() - cachedAt;
    if (age > TAGS_TTL_MS) void refreshTags(deezerId, artistName);
    return cached.tags;
  }

  // No cached tags — fetch synchronously this time
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
