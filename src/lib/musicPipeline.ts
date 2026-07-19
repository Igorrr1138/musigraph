/**
 * Music-data purification pipeline — MUSICBRAINZ-FIRST.
 *
 * Flow:
 *   1. Warm cache (music_cache, TTL 30 d) — one Supabase read.
 *   2. Resolve the MB artist MBID (URL-relation → name search), then
 *      fan out release-groups + genres in parallel with the Deezer album
 *      list. MB is the source of truth; Deezer is only enrichment.
 *   3. If MB returned ≥ 1 release group: use it as the baseline
 *      discography. Match each MB release to a Deezer edition by
 *      normalized title, collapse duplicates with the edition-priority
 *      score, and mint a DeezerAlbum whose title + original_year come
 *      from MB but whose cover / IDs / record_type flags come from Deezer.
 *   4. Otherwise: graceful fallback to a pure Deezer discography with
 *      original_year filled from Deezer's own release_date.
 *   5. Persist the merged payload back into `music_cache` (fire-and-forget).
 */

import { supabase } from '@/integrations/supabase/client';
import { getArtistAlbums, type DeezerAlbum } from './deezer';
import { normalizeAlbumTitle, looksLikeVariant } from './discography';
import {
  findArtistMbid,
  fetchArtistReleases,
  fetchArtistGenres,
  type MbRelease,
  type MbRecordType,
} from './musicbrainz';

const MUSIC_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface PurifiedDiscographyPayload {
  albums: DeezerAlbum[];
  mbid: string | null;
  genres: string[];
  source: 'musicbrainz' | 'deezer';
  fetched_at: string;
}

interface MusicCacheRow {
  artist_deezer_id: string;
  mbid: string | null;
  source: string;
  data: PurifiedDiscographyPayload;
  cached_at: string;
}

// MusicBrainz record_type → Deezer record_type string (the shape our
// downstream classifier already understands via `deezer.record_type`).
const MB_TO_DEEZER_RECORD_TYPE: Record<MbRecordType, string> = {
  album: 'album',
  ep: 'ep',
  single: 'single',
  live: 'album',      // buildDiscography reclassifies via title heuristics
  compilation: 'compile',
};

/** Higher-is-better edition score used to pick the best Deezer edition. */
function editionScore(album: DeezerAlbum): number {
  const explicit = (album as { explicit_lyrics?: boolean }).explicit_lyrics === true ? 4 : 0;
  const deluxe = looksLikeVariant(album.title ?? '') ? 2 : 0;
  return explicit + deluxe;
}

function pickBestEdition(candidates: DeezerAlbum[]): DeezerAlbum | undefined {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => {
    const s = editionScore(b) - editionScore(a);
    if (s !== 0) return s;
    const da = a.release_date ?? '9999-12-31';
    const db = b.release_date ?? '9999-12-31';
    return da.localeCompare(db);
  })[0];
}

/**
 * Merge an MB release with its matching Deezer edition. MB wins on
 * title + year + record_type; Deezer supplies IDs, cover art, and the
 * explicit flag.
 */
function mergeMbWithDeezer(release: MbRelease, deezer: DeezerAlbum): DeezerAlbum {
  const explicit =
    typeof (deezer as { explicit_lyrics?: unknown }).explicit_lyrics === 'boolean'
      ? ((deezer as { explicit_lyrics?: boolean }).explicit_lyrics as boolean)
      : undefined;

  return {
    id: deezer.id,
    title: release.title,
    cover_small: deezer.cover_small,
    cover_medium: deezer.cover_medium,
    cover_big: deezer.cover_big,
    cover_xl: deezer.cover_xl,
    release_date: release.date ?? deezer.release_date,
    record_type: MB_TO_DEEZER_RECORD_TYPE[release.record_type],
    original_year: release.year,
    is_deluxe: looksLikeVariant(deezer.title ?? ''),
    is_explicit: explicit,
    nb_tracks: deezer.nb_tracks,
    artist: deezer.artist,
  };
}

/**
 * Deezer-only enrichment used ONLY when MusicBrainz has zero data on this
 * artist. Fills `original_year` from Deezer's own release_date and lets
 * downstream `buildDiscography` classify.
 */
function deezerOnlyPayload(albums: DeezerAlbum[]): DeezerAlbum[] {
  return albums.map((a) => {
    const deezerYear = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : NaN;
    const explicit =
      typeof (a as { explicit_lyrics?: unknown }).explicit_lyrics === 'boolean'
        ? ((a as { explicit_lyrics?: boolean }).explicit_lyrics as boolean)
        : undefined;
    return {
      ...a,
      original_year: Number.isFinite(deezerYear) ? deezerYear : undefined,
      is_deluxe: looksLikeVariant(a.title ?? ''),
      is_explicit: explicit,
    };
  });
}

/**
 * Fetch a purified, MusicBrainz-driven discography for an artist. Cheap
 * on warm cache (single Supabase read). Cold: one MB search, one MB
 * release-groups call, one MB artist detail (genres), one Deezer
 * paginated album list — fired concurrently with graceful degradation.
 */
export async function getArtistDiscography(
  deezerId: string,
  artistName?: string,
  options: { forceRefresh?: boolean } = {},
): Promise<PurifiedDiscographyPayload> {
  const { forceRefresh = false } = options;

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('music_cache')
      .select('*')
      .eq('artist_deezer_id', deezerId)
      .maybeSingle<MusicCacheRow>();

    if (cached?.data) {
      const age = Date.now() - new Date(cached.cached_at).getTime();
      if (age < MUSIC_CACHE_TTL_MS) return cached.data;
    }
  }

  // Kick off Deezer albums immediately — we always need them.
  const deezerAlbumsPromise = getArtistAlbums(deezerId, 200).catch((err) => {
    console.warn('[Deezer] getArtistAlbums failed:', err);
    return [] as DeezerAlbum[];
  });

  // Resolve MBID concurrently with Deezer.
  let mbid: string | null = null;
  try {
    mbid = await findArtistMbid(deezerId, artistName);
  } catch (err) {
    console.warn('[MusicBrainz] MBID lookup failed:', err);
  }

  const deezerAlbums = await deezerAlbumsPromise;

  if (!mbid) {
    const resolvedName =
      artistName ?? deezerAlbums.find((a) => a.artist?.name)?.artist?.name;
    if (resolvedName) {
      try {
        mbid = await findArtistMbid(deezerId, resolvedName);
      } catch (err) {
        console.warn('[MusicBrainz] MBID retry failed:', err);
      }
    }
  }

  let mbReleases: MbRelease[] = [];
  let mbGenres: string[] = [];
  if (mbid) {
    const [releases, genres] = await Promise.all([
      fetchArtistReleases(mbid).catch(() => [] as MbRelease[]),
      fetchArtistGenres(mbid).catch(() => [] as string[]),
    ]);
    mbReleases = releases;
    mbGenres = genres;
  }

  let mergedAlbums: DeezerAlbum[];
  let source: 'musicbrainz' | 'deezer';

  if (mbReleases.length > 0) {
    // MUSICBRAINZ-FIRST PATH -------------------------------------------
    const deezerByKey = new Map<string, DeezerAlbum[]>();
    for (const d of deezerAlbums) {
      const key = normalizeAlbumTitle(d.title);
      const bucket = deezerByKey.get(key);
      if (bucket) bucket.push(d);
      else deezerByKey.set(key, [d]);
    }

    mergedAlbums = mbReleases
      .map((rel) => {
        const key = normalizeAlbumTitle(rel.title);
        const best = pickBestEdition(deezerByKey.get(key) ?? []);
        // Drop MB releases we can't back with a Deezer edition — they'd
        // render as blank, unclickable cards otherwise.
        if (!best) return null;
        return mergeMbWithDeezer(rel, best);
      })
      .filter((a): a is DeezerAlbum => a !== null);
    source = 'musicbrainz';
  } else {
    mergedAlbums = deezerOnlyPayload(deezerAlbums);
    source = 'deezer';
  }

  const payload: PurifiedDiscographyPayload = {
    albums: mergedAlbums,
    mbid,
    genres: mbGenres,
    source,
    fetched_at: new Date().toISOString(),
  };

  const upsertPromise = supabase
    .from('music_cache')
    .upsert(
      [
        {
          artist_deezer_id: deezerId,
          mbid,
          source,
          data: payload as unknown as import('@/integrations/supabase/types').Database['public']['Tables']['music_cache']['Insert']['data'],
          cached_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'artist_deezer_id' },
    )
    .then(({ error }) => {
      if (error) console.warn('[music_cache] upsert error:', error);
    });

  if (forceRefresh) {
    await upsertPromise;
  } else {
    void upsertPromise;
  }

  return payload;
}
