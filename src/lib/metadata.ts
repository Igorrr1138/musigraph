/**
 * Album metadata helpers.
 *
 * Provides utilities to derive an album's *original* release year — as opposed
 * to the Deezer catalog date, which frequently reflects a remaster/deluxe/
 * reissue upload year (e.g. Deezer returns 2016 for "Ride the Lightning"
 * instead of 1984). We clean the title before querying Last.fm so that
 * "Master of Puppets (Remastered 2017)" still matches "Master of Puppets".
 *
 * Performance notes:
 * - Uses Last.fm `album.getinfo` via `fetchOriginalAlbumYear` in `lastfm.ts`,
 *   which is session-cached (in-memory) per (artist, cleanTitle) pair.
 * - `enrichAlbumsWithOriginalYear` runs after the initial UI paint and only
 *   hits Last.fm for albums whose title looks like a reissue OR whose
 *   record_type is album/EP. Everything runs with bounded concurrency so it
 *   never blocks or degrades page load.
 */

import { fetchOriginalAlbumYear } from "@/lib/lastfm";
import type { DeezerAlbum } from "@/lib/deezer";

/**
 * Strip common reissue markers from an album title so it matches the canonical
 * release on Last.fm / MusicBrainz. Removes bracketed reissue tags
 * ("(Remastered)", "[Deluxe Edition]", "(2016 Remaster)", ...) and trailing
 * "- Remastered YYYY" style suffixes. Idempotent.
 */
export function cleanAlbumTitle(title: string): string {
  if (!title) return "";
  let out = title;

  // Bracketed reissue markers: (...) or [...] containing any of the keywords.
  const bracketed = /\s*[\(\[][^\)\]]*(remaster(ed)?|deluxe|expanded|anniversary|special\s*edition|bonus|reissue|super\s*deluxe|extended|explicit|clean)[^\)\]]*[\)\]]/gi;
  out = out.replace(bracketed, "");

  // Trailing "- Remastered", "- Remastered 2016", "– Deluxe Edition", etc.
  const trailing = /\s*[-–—:]\s*(remaster(ed)?(\s*\d{2,4})?|deluxe(\s*edition)?|expanded(\s*edition)?|anniversary(\s*edition)?|special\s*edition|reissue|super\s*deluxe|extended(\s*version)?)\s*$/gi;
  out = out.replace(trailing, "");

  // Bare "Remastered YYYY" tail with no separator.
  out = out.replace(/\s+remastered(\s*\d{2,4})?\s*$/gi, "");

  // Collapse whitespace.
  return out.replace(/\s{2,}/g, " ").trim();
}

const REISSUE_MARKER =
  /\b(remaster(ed)?|deluxe|expanded|anniversary|reissue|super\s*deluxe|special\s*edition|bonus)\b/i;

/**
 * Heuristic: does this album look like a reissue whose Deezer release_date is
 * likely the reissue year rather than the original? Used to pick which albums
 * are worth a Last.fm round-trip.
 */
function isLikelyReissue(album: DeezerAlbum): boolean {
  return REISSUE_MARKER.test(album.title ?? "");
}

/**
 * Should we bother looking up an original year for this album? Studio albums
 * and EPs are the main offenders; singles/live/compilations rarely matter for
 * the chronological discography timeline.
 */
function isCandidate(album: DeezerAlbum): boolean {
  const rt = (album.record_type ?? "").toLowerCase();
  if (rt === "album" || rt === "ep") return true;
  return isLikelyReissue(album);
}

/**
 * Fast path: if `release_date` already looks correct (Deezer's date matches
 * Last.fm, or there is no reissue marker in the title), we can derive
 * `original_year` from `release_date` directly without any network I/O.
 *
 * This runs synchronously, so it's applied inline on the initial render and
 * costs nothing. The async pass then only corrects the remaining candidates.
 */
export function annotateOriginalYearFast(albums: DeezerAlbum[]): DeezerAlbum[] {
  return albums.map((a) => {
    if (a.original_year) return a;
    if (isLikelyReissue(a)) return a; // needs the async lookup
    const y = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : NaN;
    return Number.isFinite(y) ? { ...a, original_year: y } : a;
  });
}

/**
 * Enrich albums with `original_year` by querying Last.fm for reissue-looking
 * titles. Runs with bounded concurrency (default 4) and is entirely
 * side-effect-free — returns a *new* array.
 *
 * Skip conditions (no network call):
 *   - `album.original_year` is already set
 *   - the album is not a candidate (see `isCandidate`)
 *
 * Result merge:
 *   - if Last.fm returns a year, we take it as `original_year`
 *   - otherwise we fall back to the year in `release_date`
 */
export async function enrichAlbumsWithOriginalYear(
  albums: DeezerAlbum[],
  artistName: string,
  concurrency = 4,
): Promise<DeezerAlbum[]> {
  if (!artistName || albums.length === 0) return albums;

  const result = [...albums];
  const targets: Array<{ index: number; cleanTitle: string; fallbackYear?: number }> = [];

  albums.forEach((a, index) => {
    if (a.original_year || !isCandidate(a)) return;
    const cleanTitle = cleanAlbumTitle(a.title);
    if (!cleanTitle) return;
    const fallback = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : undefined;
    targets.push({ index, cleanTitle, fallbackYear: Number.isFinite(fallback as number) ? fallback : undefined });
  });

  if (targets.length === 0) return result;

  let cursor = 0;
  async function worker() {
    while (cursor < targets.length) {
      const mine = targets[cursor++];
      const year = await fetchOriginalAlbumYear(artistName, mine.cleanTitle);
      const chosen = year ?? mine.fallbackYear;
      if (chosen) {
        result[mine.index] = { ...result[mine.index], original_year: chosen };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return result;
}
