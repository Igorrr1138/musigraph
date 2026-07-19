/**
 * Music-data purification pipeline — MUSICBRAINZ-ONLY for release metadata.
 *
 * Flow:
 *   1. Warm cache (music_cache, TTL 30 d) — one Supabase read.
 *   2. Resolve the MB artist MBID by name, then fetch release-groups + genres.
 *   3. MB is the only source for title, release date, original year, and
 *      record type. Deezer is used only to attach an existing app ID/cover
 *      when a normalized title match exists.
 *   4. Persist the MB-normalized payload back into `music_cache`.
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
  source: 'musicbrainz';
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
  live: 'live',
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
 * Merge an MB release with an optional matching Deezer edition. MB is the
 * source of truth for title + year + record_type; Deezer may supply only
 * the existing route ID, cover art, artist shape, and explicit flag.
 */
function mergeMbRelease(release: MbRelease, deezer?: DeezerAlbum): DeezerAlbum {
  const maybeDeezer = deezer as (DeezerAlbum & { explicit_lyrics?: unknown }) | undefined;
  const explicit =
    typeof maybeDeezer?.explicit_lyrics === 'boolean'
      ? maybeDeezer.explicit_lyrics
      : undefined;

  return {
    id: deezer?.id ?? release.mbid,
    title: release.title,
    cover_small: deezer?.cover_small,
    cover_medium: deezer?.cover_medium,
    cover_big: deezer?.cover_big,
    cover_xl: deezer?.cover_xl,
    release_date: release.date,
    record_type: MB_TO_DEEZER_RECORD_TYPE[release.record_type],
    original_year: release.year,
    is_deluxe: looksLikeVariant(deezer?.title ?? release.title),
    is_explicit: explicit,
    nb_tracks: deezer?.nb_tracks,
    artist: deezer?.artist,
  };
}

/**
 * Fetch a purified, MusicBrainz-driven discography for an artist. Cheap
 * on warm cache (single Supabase read). Cold: one MB search, one MB
 * release-groups call, one MB artist detail (genres), and one optional
 * Deezer album-list call for covers/route IDs only.
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

    if (cached?.data && cached.data.source === 'musicbrainz') {
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

  let mergedAlbums: DeezerAlbum[] = [];
  const source = 'musicbrainz' as const;

  if (mbReleases.length > 0) {
    // MUSICBRAINZ-ONLY METADATA PATH -----------------------------------
    const deezerByKey = new Map<string, DeezerAlbum[]>();
    for (const d of deezerAlbums) {
      const key = normalizeAlbumTitle(d.title);
      const bucket = deezerByKey.get(key);
      if (bucket) bucket.push(d);
      else deezerByKey.set(key, [d]);
    }

    // Collapse MB release-groups sharing a normalized title (e.g. original
    // + "Deluxe Box Set" reissue) to the earliest first-release-date. This
    // guarantees `original_year` reflects the album's real debut, not a
    // remaster/reissue year, before dedupeByEditionPriority runs downstream.
    const mbByKey = new Map<string, MbRelease>();
    for (const rel of mbReleases) {
      const key = normalizeAlbumTitle(rel.title);
      const prev = mbByKey.get(key);
      if (!prev) { mbByKey.set(key, rel); continue; }
      const prevDate = prev.date ?? '9999-12-31';
      const relDate = rel.date ?? '9999-12-31';
      if (relDate < prevDate) mbByKey.set(key, rel);
    }

    const matched = Array.from(mbByKey.values())
      .map((rel) => {
        const key = normalizeAlbumTitle(rel.title);
        const best = pickBestEdition(deezerByKey.get(key) ?? []);
        return mergeMbRelease(rel, best);
      })
      .filter((a) => Number.isFinite(Number(a.original_year)));

    mergedAlbums = matched;
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
