/**
 * Deezer API client (browser-side via JSONP to bypass CORS).
 *
 * Deezer is the primary source for search, visuals, and track lists.
 * Original release dates — which Deezer sometimes reports as the remaster year
 * rather than the original release year for catalog re-releases — are corrected
 * in getArtistAlbums() via Last.fm's album.getinfo API and then persisted back
 * to albums_cache so the Ratings chart X-axis stays accurate.
 */

import { supabase } from '@/integrations/supabase/client';
import { normalizeAlbumTitle, getCleanTitle } from './discography';
import { getOriginalReleaseDateMap } from './lastfm';

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
 * Fetch all albums for an artist from Deezer, then correct any release dates
 * that Deezer reports as the remaster year instead of the original year.
 *
 * Date correction strategy:
 *  1. Collect all studio albums / EPs (the types Deezer most commonly mislabels).
 *  2. Call Last.fm album.getinfo for each (batched, 4 concurrent, session-cached).
 *  3. Apply the Last.fm date when it is strictly earlier than Deezer's date.
 *  4. Persist any changed dates back to albums_cache so the Ratings page chart
 *     X-axis (which reads albums_cache.release_date) reflects the real year.
 */
export async function getArtistAlbums(deezerId: string, limit = 100): Promise<DeezerAlbum[]> {
  try {
    const albums = await deezerPaginatedList<DeezerAlbum>(`/artist/${deezerId}/albums`, limit);
    const artistName = albums.find(a => a.artist?.name)?.artist?.name;
    if (!artistName) return albums;

    // Only look up dates for album/EP types — those are the ones Deezer
    // commonly mislabels with the remaster year (e.g. Kill 'Em All → 2016).
    const lookupAlbums = albums
      .filter(a => {
        const rt = (a.record_type ?? '').toLowerCase();
        return rt === 'album' || rt === 'ep';
      })
      .map(a => ({
        normalizedTitle: normalizeAlbumTitle(a.title),
        cleanTitle: getCleanTitle(a.title),
      }));

    const originalDates = await getOriginalReleaseDateMap(artistName, lookupAlbums);
    if (originalDates.size === 0) return albums;

    // Apply corrected dates — never push a date *forward*, only earlier.
    const corrected = albums.map(album => {
      const normalized = normalizeAlbumTitle(album.title);
      const originalDate = originalDates.get(normalized);
      if (!originalDate) return album;
      const currentDate = album.release_date ?? '9999-12-31';
      return originalDate < currentDate
        ? { ...album, release_date: originalDate }
        : album;
    });

    // Persist corrected release_dates to albums_cache so the Ratings page chart
    // X-axis (which reads albums_cache.release_date) uses the real original year.
    // We only upsert the rows that actually changed to avoid unnecessary writes.
    const changed = corrected.filter((a, i) => a.release_date !== albums[i].release_date);
    if (changed.length > 0) {
      void supabase
        .from('albums_cache')
        .upsert(
          changed.map(album => ({
            deezer_id: String(album.id),
            title: album.title,
            release_date: album.release_date ?? null,
            artist_name: album.artist?.name ?? artistName,
            artist_deezer_id: album.artist?.id ? String(album.artist.id) : deezerId,
            cached_at: new Date().toISOString(),
          })),
          { onConflict: 'deezer_id' },
        )
        .then(({ error }) => {
          if (error) console.warn('[Deezer] corrected date cache write error:', error);
        });
    }

    return corrected;
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
