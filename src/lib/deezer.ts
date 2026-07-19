/**
 * Deezer API client (browser-side via JSONP to bypass CORS).
 *
 * Deezer is the DATA LAYER of the purification pipeline: it supplies album
 * lists, tracklists, covers, and artist visuals. Historical release
 * chronology and genre hierarchy come from MusicBrainz (see `musicbrainz.ts`) and
 * are merged onto these payloads by `musicPipeline.ts`. This module no
 * longer performs any Last.fm date correction of its own.
 */

import { supabase } from '@/integrations/supabase/client';

const DEEZER_BASE = 'https://api.deezer.com';
const JSONP_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- Types (subset of the Deezer payload we actually use) ----------

export interface DeezerArtist {
  id: number | string;
  name: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
  type?: string;
}

export interface DeezerAlbum {
  id: number | string;
  title: string;
  cover_small?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  record_type?: string;
  /** Original release year (Deezer year fallback). */
  original_year?: number;
  /** Set by the pipeline: title carries Deluxe/Expanded/Remastered markers. */
  is_deluxe?: boolean;
  /** From Deezer's `explicit_lyrics` when available. */
  is_explicit?: boolean;
  nb_tracks?: number;
  artist?: DeezerArtist;
  tracks?: { data: DeezerTrack[] };
  genres?: { data: Array<{ id: number; name: string }> };
}

export interface DeezerTrack {
  id: number | string;
  title: string;
  title_short?: string;
  duration: number; // seconds
  track_position?: number;
  disk_number?: number;
  preview?: string;
  isrc?: string;
  artist?: DeezerArtist;
  album?: { id: number | string; title: string; cover_xl?: string };
}

interface DeezerListResponse<T> {
  data?: T[];
  total?: number;
  next?: string;
  error?: { type: string; message: string; code: number };
}

// ---------- JSONP transport ----------

let jsonpCounter = 0;

function deezerJsonp<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('Deezer JSONP requires a browser environment'));
  }

  return new Promise<T>((resolve, reject) => {
    jsonpCounter += 1;
    const callbackName = `deezerCb_${Date.now()}_${jsonpCounter}_${Math.random().toString(36).slice(2)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      try { delete w[callbackName]; } catch { /* noop */ }
      script.remove();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Deezer request timed out: ${path}`));
    }, JSONP_TIMEOUT_MS);

    w[callbackName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const qs = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      output: 'jsonp',
      callback: callbackName,
    }).toString();

    script.src = `${DEEZER_BASE}${path}?${qs}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error(`Deezer request failed: ${path}`));
    };

    document.body.appendChild(script);
  });
}

async function deezerPaginatedList<T>(path: string, limit = 100): Promise<T[]> {
  const pageSize = Math.min(limit, 100);
  const items: T[] = [];
  let index = 0;

  while (items.length < limit) {
    const data = await deezerJsonp<DeezerListResponse<T>>(path, { limit: pageSize, index });
    const batch = data.data ?? [];
    items.push(...batch);

    if (batch.length === 0 || !data.next) break;
    index += batch.length;
  }

  return items.slice(0, limit);
}

// ---------- Image helpers ----------

const DEEZER_EMPTY_IMAGE_HASH = 'd41d8cd98f00b204e9800998ecf8427e';

export function isUsableImage(url: string | undefined | null): boolean {
  return Boolean(url && !url.includes(DEEZER_EMPTY_IMAGE_HASH));
}

export function pickArtistImage(artist: DeezerArtist | undefined | null): string | null {
  if (!artist) return null;
  const candidates = [artist.picture_xl, artist.picture_big, artist.picture_medium, artist.picture_small];
  return candidates.find(isUsableImage) ?? null;
}

export function pickAlbumCover(album: { cover_xl?: string; cover_big?: string; cover_medium?: string; cover_small?: string } | undefined | null): string | null {
  if (!album) return null;
  const candidates = [album.cover_xl, album.cover_big, album.cover_medium, album.cover_small];
  return candidates.find(isUsableImage) ?? null;
}

// ---------- Search ----------

export async function searchArtists(query: string, limit = 12): Promise<DeezerArtist[]> {
  try {
    const data = await deezerJsonp<DeezerListResponse<DeezerArtist>>('/search/artist', { q: query, limit });
    return data.data ?? [];
  } catch (err) {
    console.error('[Deezer] searchArtists failed:', err);
    return [];
  }
}

export async function searchAlbums(query: string, limit = 12): Promise<DeezerAlbum[]> {
  try {
    const data = await deezerJsonp<DeezerListResponse<DeezerAlbum>>('/search/album', { q: query, limit });
    return data.data ?? [];
  } catch (err) {
    console.error('[Deezer] searchAlbums failed:', err);
    return [];
  }
}

export async function searchTracks(query: string, limit = 12): Promise<DeezerTrack[]> {
  try {
    const data = await deezerJsonp<DeezerListResponse<DeezerTrack>>('/search/track', { q: query, limit });
    return data.data ?? [];
  } catch (err) {
    console.error('[Deezer] searchTracks failed:', err);
    return [];
  }
}

export async function getRelatedArtists(deezerId: string, limit = 8): Promise<DeezerArtist[]> {
  try {
    const data = await deezerJsonp<DeezerListResponse<DeezerArtist>>(`/artist/${deezerId}/related`, { limit });
    return data.data ?? [];
  } catch (err) {
    console.error('[Deezer] getRelatedArtists failed:', err);
    return [];
  }
}

export async function getArtistTopTracks(deezerId: string, limit = 10): Promise<DeezerTrack[]> {
  try {
    const data = await deezerJsonp<DeezerListResponse<DeezerTrack>>(`/artist/${deezerId}/top`, { limit });
    return data.data ?? [];
  } catch (err) {
    console.error('[Deezer] getArtistTopTracks failed:', err);
    return [];
  }
}


// ---------- Entity getters with cache ----------

export async function getArtist(deezerId: string): Promise<DeezerArtist | null> {
  const { data: cached } = await supabase
    .from('artists_cache')
    .select('*')
    .eq('deezer_id', deezerId)
    .maybeSingle();

  if (cached) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age > CACHE_TTL_MS) void fetchAndCacheArtist(deezerId);
    return {
      id: deezerId,
      name: cached.name,
      picture_xl: cached.image_url ?? undefined,
      picture_big: cached.image_url ?? undefined,
    };
  }

  return fetchAndCacheArtist(deezerId);
}

async function fetchAndCacheArtist(deezerId: string): Promise<DeezerArtist | null> {
  try {
    const artist = await deezerJsonp<DeezerArtist & { error?: unknown }>(`/artist/${deezerId}`);
    if ((artist as { error?: unknown }).error) return null;

    void supabase.from('artists_cache').upsert({
      deezer_id: String(artist.id),
      name: artist.name,
      image_url: pickArtistImage(artist),
      cached_at: new Date().toISOString(),
    }, { onConflict: 'deezer_id' }).then(({ error }) => {
      if (error) console.warn('[Deezer] artist cache upsert error:', error);
    });

    return artist;
  } catch (err) {
    console.error('[Deezer] getArtist failed:', err);
    return null;
  }
}

/**
 * Fetch all albums for an artist from Deezer. Raw data only — chronological
 * corrections, dedup, and genre enrichment all happen downstream in
 * `musicPipeline.ts` using MusicBrainz as the primary source.
 */
export async function getArtistAlbums(deezerId: string, limit = 100): Promise<DeezerAlbum[]> {
  try {
    return await deezerPaginatedList<DeezerAlbum>(`/artist/${deezerId}/albums`, limit);
  } catch (err) {
    console.error('[Deezer] getArtistAlbums failed:', err);
    return [];
  }
}

export async function getAlbum(deezerId: string): Promise<DeezerAlbum | null> {
  try {
    const album = await deezerJsonp<DeezerAlbum & { error?: unknown }>(`/album/${deezerId}`);
    if ((album as { error?: unknown }).error) return null;

    void supabase.from('albums_cache').upsert({
      deezer_id: String(album.id),
      title: album.title,
      cover_url: pickAlbumCover(album),
      release_date: album.release_date ?? null,
      artist_name: album.artist?.name ?? null,
      artist_deezer_id: album.artist?.id ? String(album.artist.id) : null,
      track_count: album.nb_tracks ?? null,
      cached_at: new Date().toISOString(),
    }, { onConflict: 'deezer_id' }).then(({ error }) => {
      if (error) console.warn('[Deezer] album cache upsert error:', error);
    });

    return album;
  } catch (err) {
    console.error('[Deezer] getAlbum failed:', err);
    return null;
  }
}

// ---------- Utilities ----------

export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Map Deezer record_type -> human-friendly category bucket used by the
 * discography organizer. Deezer values: "album", "ep", "single", "compile".
 */
export function deezerRecordCategory(recordType?: string): 'Album' | 'EP' | 'Single' | 'Compilation' | 'Other' {
  switch ((recordType ?? '').toLowerCase()) {
    case 'album': return 'Album';
    case 'ep': return 'EP';
    case 'single': return 'Single';
    case 'compile': return 'Compilation';
    default: return 'Other';
  }
}
