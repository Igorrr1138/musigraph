/**
 * Homepage personalized feed helpers.
 *
 * - Last releases: latest albums from artists the user has rated. Falls back
 *   to the Deezer editorial chart for guests / empty rating sets.
 * - Recommended artists: Last.fm `artist.getsimilar` seeded from the user's
 *   top 3 rated artists, deduped against already-rated artists, then resolved
 *   through Deezer search to get proper images + IDs. Falls back to Last.fm
 *   `chart.gettopartists` for guests.
 * - Recently rated: the user's last few album ratings; for guests we show
 *   recent community ratings (album metadata only).
 * - Playlists: the user's own playlists; guests get an empty list (we render
 *   a sign-in CTA in that case).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  getArtistAlbums,
  searchArtists,
  type DeezerAlbum,
  type DeezerArtist,
} from './deezer';

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';

// ---------- Last releases ----------

interface DeezerJsonpListResponse<T> {
  data?: T[];
  error?: { message: string };
}

function deezerEditorialReleases(limit: number): Promise<DeezerAlbum[]> {
  return new Promise(resolve => {
    if (typeof window === 'undefined') return resolve([]);
    const cb = `deezerHomeCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      delete w[cb];
      script.remove();
      resolve([]);
    }, 8000);
    w[cb] = (json: DeezerJsonpListResponse<DeezerAlbum>) => {
      window.clearTimeout(timeout);
      delete w[cb];
      script.remove();
      resolve((json?.data ?? []).slice(0, limit));
    };
    script.src = `https://api.deezer.com/editorial/0/releases?limit=${limit}&output=jsonp&callback=${cb}`;
    script.onerror = () => {
      window.clearTimeout(timeout);
      delete w[cb];
      script.remove();
      resolve([]);
    };
    document.body.appendChild(script);
  });
}

export async function getLastReleases(userId: string | null, limit = 5): Promise<DeezerAlbum[]> {
  if (userId) {
    const { data: ratings } = await supabase
      .from('album_ratings')
      .select('artist_deezer_id, artist_name, rating')
      .eq('user_id', userId)
      .not('artist_deezer_id', 'is', null)
      .order('rating', { ascending: false })
      .limit(50);

    const uniqueArtists = Array.from(
      new Map(
        (ratings ?? [])
          .filter(r => r.artist_deezer_id)
          .map(r => [r.artist_deezer_id!, r.artist_name ?? '']),
      ).entries(),
    ).slice(0, 5);

    if (uniqueArtists.length > 0) {
      const all: DeezerAlbum[] = [];
      const results = await Promise.all(uniqueArtists.map(([id]) => getArtistAlbums(id, 20)));
      for (const list of results) all.push(...list);
      const sorted = all
        .filter(a => a.release_date)
        .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''));
      // Dedup by album id
      const seen = new Set<string>();
      const unique: DeezerAlbum[] = [];
      for (const a of sorted) {
        const key = String(a.id);
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(a);
        if (unique.length >= limit) break;
      }
      if (unique.length > 0) return unique;
    }
  }
  return deezerEditorialReleases(limit);
}

// ---------- Recommended artists ----------

interface LastfmSimilarArtist {
  name?: string;
  match?: string;
}
interface LastfmSimilarResponse {
  similarartists?: { artist?: LastfmSimilarArtist[] | LastfmSimilarArtist };
}
interface LastfmTopArtistsResponse {
  artists?: { artist?: LastfmSimilarArtist[] | LastfmSimilarArtist };
}

async function lastfmSimilar(artistName: string, limit: number): Promise<string[]> {
  try {
    const url = `${LASTFM_BASE}?method=artist.getsimilar&artist=${encodeURIComponent(artistName)}&limit=${limit}&api_key=${LASTFM_API_KEY}&format=json&autocorrect=1`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as LastfmSimilarResponse;
    const raw = json.similarartists?.artist;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.map(a => a?.name ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

async function lastfmTopArtists(limit: number): Promise<string[]> {
  try {
    const url = `${LASTFM_BASE}?method=chart.gettopartists&limit=${limit}&api_key=${LASTFM_API_KEY}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as LastfmTopArtistsResponse;
    const raw = json.artists?.artist;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr.map(a => a?.name ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveArtistsViaDeezer(names: string[], limit: number): Promise<DeezerArtist[]> {
  const out: DeezerArtist[] = [];
  const seen = new Set<string>();
  const concurrency = 4;
  for (let i = 0; i < names.length && out.length < limit; i += concurrency) {
    const slice = names.slice(i, i + concurrency);
    const lists = await Promise.all(slice.map(n => searchArtists(n, 1)));
    for (const list of lists) {
      const a = list[0];
      if (!a) continue;
      const key = String(a.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export async function getRecommendedArtists(
  userId: string | null,
  limit = 5,
): Promise<DeezerArtist[]> {
  if (userId) {
    // Top-rated artists by avg rating across this user's albums.
    const { data: ratings } = await supabase
      .from('album_ratings')
      .select('artist_deezer_id, artist_name, rating')
      .eq('user_id', userId)
      .not('artist_name', 'is', null)
      .order('rating', { ascending: false })
      .limit(50);

    const byArtist = new Map<string, { name: string; sum: number; count: number }>();
    for (const r of ratings ?? []) {
      const key = r.artist_deezer_id ?? r.artist_name ?? '';
      if (!key || !r.artist_name) continue;
      const entry = byArtist.get(key) ?? { name: r.artist_name, sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      byArtist.set(key, entry);
    }
    const ratedNames = new Set(
      Array.from(byArtist.values()).map(v => v.name.toLowerCase()),
    );
    const seeds = Array.from(byArtist.values())
      .sort((a, b) => b.sum / b.count - a.sum / a.count)
      .slice(0, 3)
      .map(v => v.name);

    if (seeds.length > 0) {
      const similarLists = await Promise.all(seeds.map(n => lastfmSimilar(n, 8)));
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const list of similarLists) {
        for (const n of list) {
          const lower = n.toLowerCase();
          if (ratedNames.has(lower) || seen.has(lower)) continue;
          seen.add(lower);
          merged.push(n);
        }
      }
      const resolved = await resolveArtistsViaDeezer(merged, limit);
      if (resolved.length > 0) return resolved;
    }
  }
  const top = await lastfmTopArtists(20);
  return resolveArtistsViaDeezer(top, limit);
}

// ---------- Recently rated ----------

export interface RecentlyRatedEntry {
  id: string;
  albumId: string | null;
  albumTitle: string;
  artistId: string | null;
  artistName: string | null;
  coverUrl: string | null;
  rating: number;
  ratedAt: string;
}

export async function getRecentlyRated(
  userId: string | null,
  limit = 3,
): Promise<RecentlyRatedEntry[]> {
  let query = supabase
    .from('album_ratings')
    .select('id, album_deezer_id, album_title, artist_deezer_id, artist_name, cover_url, rating, rated_at')
    .order('rated_at', { ascending: false })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);

  const { data } = await query;
  return (data ?? []).map(r => ({
    id: r.id,
    albumId: r.album_deezer_id,
    albumTitle: r.album_title,
    artistId: r.artist_deezer_id,
    artistName: r.artist_name,
    coverUrl: r.cover_url,
    rating: r.rating,
    ratedAt: r.rated_at,
  }));
}

// ---------- Playlists ----------

export interface HomePlaylist {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  trackCount: number;
}

export async function getHomePlaylists(
  userId: string | null,
  limit = 2,
): Promise<HomePlaylist[]> {
  if (!userId) return [];
  const { data } = await supabase
    .from('playlists')
    .select('id, name, description, cover_url, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  const playlists = data ?? [];
  if (playlists.length === 0) return [];

  const ids = playlists.map(p => p.id);
  const { data: counts } = await supabase
    .from('playlist_tracks')
    .select('playlist_id')
    .in('playlist_id', ids);

  const countMap = new Map<string, number>();
  for (const t of counts ?? []) {
    countMap.set(t.playlist_id, (countMap.get(t.playlist_id) ?? 0) + 1);
  }

  return playlists.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    coverUrl: p.cover_url,
    trackCount: countMap.get(p.id) ?? 0,
  }));
}
