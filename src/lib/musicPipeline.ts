/**
 * Music-data purification pipeline (Wikidata primary, Deezer fallback).
 *
 * Responsibilities:
 *   1. Read the purified discography from `music_cache` if fresh (TTL 30 d).
 *   2. Otherwise: fetch raw albums from Deezer, resolve the Wikidata QID,
 *      pull P577 dates + P136 genres from Wikidata SPARQL, merge them onto
 *      the Deezer payload as `original_year`, flag `is_deluxe` / `is_explicit`
 *      for the edition-priority de-duplication step, and write the whole
 *      thing back into `music_cache`.
 *
 * Everything downstream (ArtistPage, buildDiscography) consumes the result
 * of `getArtistDiscography()` — the Deezer/Last.fm/Wikidata calls stop here.
 */

import { supabase } from '@/integrations/supabase/client';
import { getArtistAlbums, type DeezerAlbum } from './deezer';
import { normalizeAlbumTitle, looksLikeVariant } from './discography';
import {
  findArtistQid,
  fetchArtistAlbums,
  fetchArtistGenres,
  type WikidataAlbum,
} from './wikidata';

const MUSIC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface PurifiedDiscographyPayload {
  albums: DeezerAlbum[];
  wikidata_qid: string | null;
  wikidata_genres: string[];
  source: 'wikidata' | 'deezer';
  fetched_at: string;
}

interface MusicCacheRow {
  artist_deezer_id: string;
  wikidata_qid: string | null;
  source: string;
  data: PurifiedDiscographyPayload;
  cached_at: string;
}

/**
 * Fetch a purified, Wikidata-enriched discography for an artist. Cheap on
 * warm cache: a single Supabase read. Cold cache: 1 Deezer paginated list,
 * up to 3 Wikidata calls (all with short timeouts), and a single cache
 * upsert (fire-and-forget).
 */
export async function getArtistDiscography(
  deezerId: string,
  artistName?: string,
): Promise<PurifiedDiscographyPayload> {
  // 1. Warm-cache read.
  const { data: cached } = await supabase
    .from('music_cache')
    .select('*')
    .eq('artist_deezer_id', deezerId)
    .maybeSingle<MusicCacheRow>();

  if (cached?.data) {
    const age = Date.now() - new Date(cached.cached_at).getTime();
    if (age < MUSIC_CACHE_TTL_MS) return cached.data;
  }

  // 2. Deezer (data + fallback dates).
  const albums = await getArtistAlbums(deezerId, 200);
  const resolvedName =
    artistName ?? albums.find((a) => a.artist?.name)?.artist?.name ?? '';

  // 3. Wikidata (primary chronology + genres). All failures are non-fatal.
  let wdAlbums: WikidataAlbum[] = [];
  let wdGenres: string[] = [];
  let qid: string | null = null;
  try {
    qid = await findArtistQid(deezerId, resolvedName || undefined);
    if (qid) {
      const [a, g] = await Promise.all([
        fetchArtistAlbums(qid).catch(() => []),
        fetchArtistGenres(qid).catch(() => []),
      ]);
      wdAlbums = a;
      wdGenres = g;
    }
  } catch (err) {
    console.warn('[Wikidata] pipeline lookup failed:', err);
  }

  // 4. Merge: fill `original_year` from Wikidata by normalized-title match,
  //    fall back to Deezer's release_date year.
  const wdByKey = new Map<string, WikidataAlbum>();
  for (const wa of wdAlbums) wdByKey.set(normalizeAlbumTitle(wa.title), wa);

  const enriched: DeezerAlbum[] = albums.map((a) => {
    const key = normalizeAlbumTitle(a.title);
    const wa = wdByKey.get(key);
    const wikidataYear = wa?.year;
    const deezerYear = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : NaN;
    const originalYear =
      wikidataYear ?? (Number.isFinite(deezerYear) ? deezerYear : undefined);

    return {
      ...a,
      original_year: originalYear,
      is_deluxe: looksLikeVariant(a.title ?? ''),
      is_explicit:
        typeof (a as { explicit_lyrics?: unknown }).explicit_lyrics === 'boolean'
          ? (a as { explicit_lyrics?: boolean }).explicit_lyrics
          : undefined,
    };
  });

  const payload: PurifiedDiscographyPayload = {
    albums: enriched,
    wikidata_qid: qid,
    wikidata_genres: wdGenres,
    source: qid ? 'wikidata' : 'deezer',
    fetched_at: new Date().toISOString(),
  };

  // 5. Persist (fire-and-forget so we never block the UI on cache writes).
  void supabase
    .from('music_cache')
    .upsert(
      [
        {
          artist_deezer_id: deezerId,
          wikidata_qid: qid,
          source: payload.source,
          data: payload as unknown as import('@/integrations/supabase/types').Database['public']['Tables']['music_cache']['Insert']['data'],
          cached_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'artist_deezer_id' },
    )
    .then(({ error }) => {
      if (error) console.warn('[music_cache] upsert error:', error);
    });

  return payload;
}
