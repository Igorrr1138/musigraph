/**
 * Music-data purification pipeline — WIKIDATA-FIRST.
 *
 * Flow:
 *   1. Warm cache (music_cache, TTL 30 d) — one Supabase read.
 *   2. Fire Wikidata (QID → releases + genres) and Deezer (album list) in
 *      parallel. Both are needed for the merge; running them concurrently
 *      keeps first-load latency in check without changing the hierarchy
 *      (Wikidata is still the *source of truth*, Deezer is only enrichment).
 *   3. If Wikidata returned ≥ 1 release: use it as the baseline discography.
 *      Match each Wikidata release to a Deezer album by normalized title,
 *      collapse Deezer editions with the edition-priority score, and mint
 *      a DeezerAlbum whose title + original_year come from Wikidata but
 *      whose cover / IDs / record_type flags come from Deezer.
 *   4. Otherwise: graceful fallback to a pure Deezer discography with
 *      original_year filled from Deezer's own release_date.
 *   5. Persist the merged payload back into `music_cache` (fire-and-forget).
 *
 * Downstream (`buildDiscography`, `AlbumCard`, `ArtistPage`) only sees the
 * merged `DeezerAlbum[]` — Deezer / Wikidata plumbing stops in this file.
 */

import { supabase } from '@/integrations/supabase/client';
import { getArtistAlbums, type DeezerAlbum } from './deezer';
import { normalizeAlbumTitle, looksLikeVariant } from './discography';
import {
  findArtistQid,
  fetchArtistReleases,
  fetchArtistGenres,
  type WikidataRelease,
  type WikidataRecordType,
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

// Wikidata record_type → Deezer record_type string (the shape our downstream
// classifier already understands via `deezer.record_type`).
const WD_TO_DEEZER_RECORD_TYPE: Record<WikidataRecordType, string> = {
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

/**
 * Pick the "best" Deezer edition for a Wikidata release from a group of
 * candidates that share the same normalized title. Explicit > Clean,
 * Deluxe > Standard; ties broken by the earliest release_date.
 */
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
 * Merge a Wikidata release with its matching Deezer edition. Wikidata wins
 * on title + year + record_type; Deezer supplies IDs, cover art, and the
 * explicit flag. When no Deezer match exists, we still emit the release —
 * downstream cards will render without cover but chronology stays complete.
 */
function mergeWikidataWithDeezer(
  release: WikidataRelease,
  deezer: DeezerAlbum | undefined,
): DeezerAlbum {
  const explicit =
    typeof (deezer as { explicit_lyrics?: unknown } | undefined)?.explicit_lyrics === 'boolean'
      ? ((deezer as { explicit_lyrics?: boolean }).explicit_lyrics as boolean)
      : undefined;

  return {
    // Prefer the Deezer numeric ID so album pages, ratings, and covers keep
    // working. Fall back to the Wikidata QID prefixed with `wd:` so React
    // keys stay unique when Deezer has no match.
    id: deezer?.id ?? `wd:${release.qid}`,
    title: release.title,
    cover_small: deezer?.cover_small,
    cover_medium: deezer?.cover_medium,
    cover_big: deezer?.cover_big,
    cover_xl: deezer?.cover_xl,
    release_date: release.date ?? deezer?.release_date,
    record_type: WD_TO_DEEZER_RECORD_TYPE[release.record_type],
    original_year: release.year,
    is_deluxe: deezer ? looksLikeVariant(deezer.title ?? '') : false,
    is_explicit: explicit,
    nb_tracks: deezer?.nb_tracks,
    artist: deezer?.artist,
  };
}

/**
 * Legacy Deezer-only enrichment used ONLY when Wikidata has zero data on
 * this artist. Kept minimal — no historical date correction here, we take
 * Deezer's own release_date year and let the UI do the rest.
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
 * Fetch a purified, Wikidata-driven discography for an artist. Cheap on
 * warm cache (single Supabase read). Cold: one SPARQL query for releases,
 * one for genres, one QID resolve, and one Deezer paginated album list —
 * all fired concurrently with graceful degradation on any failure.
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

  // 2. Resolve Wikidata QID first — cheap query, gates the SPARQL fan-out.
  //    Kick off the Deezer album list in parallel; we need it for enrichment
  //    (Wikidata path) or as the fallback baseline (Wikidata-empty path).
  const deezerAlbumsPromise = getArtistAlbums(deezerId, 200).catch((err) => {
    console.warn('[Deezer] getArtistAlbums failed:', err);
    return [] as DeezerAlbum[];
  });

  let qid: string | null = null;
  try {
    // Kick off QID resolution now, but fall back safely if the name is
    // unknown yet — the Deezer albums promise will surface an artist name
    // we can retry with.
    qid = await findArtistQid(deezerId, artistName);
  } catch (err) {
    console.warn('[Wikidata] QID lookup failed:', err);
  }

  // Await Deezer here — we need its artist name for a QID retry, and its
  // albums for enrichment either way. Concurrent with the QID lookup above.
  const deezerAlbums = await deezerAlbumsPromise;

  if (!qid) {
    const resolvedName =
      artistName ?? deezerAlbums.find((a) => a.artist?.name)?.artist?.name;
    if (resolvedName) {
      try {
        qid = await findArtistQid(deezerId, resolvedName);
      } catch (err) {
        console.warn('[Wikidata] QID retry failed:', err);
      }
    }
  }

  // 3. Wikidata SPARQL fan-out — only when we have a QID.
  let wdReleases: WikidataRelease[] = [];
  let wdGenres: string[] = [];
  if (qid) {
    const [releases, genres] = await Promise.all([
      fetchArtistReleases(qid).catch(() => [] as WikidataRelease[]),
      fetchArtistGenres(qid).catch(() => [] as string[]),
    ]);
    wdReleases = releases;
    wdGenres = genres;
  }

  // 4. Merge or fallback.
  let mergedAlbums: DeezerAlbum[];
  let source: 'wikidata' | 'deezer';

  if (wdReleases.length > 0) {
    // WIKIDATA-FIRST PATH ------------------------------------------------
    // Group Deezer albums by normalized title so we can attach one edition
    // per Wikidata release (Explicit > Deluxe > Standard on ties).
    const deezerByKey = new Map<string, DeezerAlbum[]>();
    for (const d of deezerAlbums) {
      const key = normalizeAlbumTitle(d.title);
      const bucket = deezerByKey.get(key);
      if (bucket) bucket.push(d);
      else deezerByKey.set(key, [d]);
    }

    mergedAlbums = wdReleases.map((rel) => {
      const key = normalizeAlbumTitle(rel.title);
      const best = pickBestEdition(deezerByKey.get(key) ?? []);
      return mergeWikidataWithDeezer(rel, best);
    });
    source = 'wikidata';
  } else {
    // GRACEFUL FALLBACK --------------------------------------------------
    // Niche/indie artist with no Wikidata footprint — use Deezer as the
    // baseline (its own year, its own tracklist) and let downstream
    // build/purify do the rest.
    mergedAlbums = deezerOnlyPayload(deezerAlbums);
    source = 'deezer';
  }

  const payload: PurifiedDiscographyPayload = {
    albums: mergedAlbums,
    wikidata_qid: qid,
    wikidata_genres: wdGenres,
    source,
    fetched_at: new Date().toISOString(),
  };

  // 5. Persist (fire-and-forget — never block the UI on cache writes).
  void supabase
    .from('music_cache')
    .upsert(
      [
        {
          artist_deezer_id: deezerId,
          wikidata_qid: qid,
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

  return payload;
}
