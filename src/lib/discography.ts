/**
 * Discography organizer — turns a raw Deezer album list into a clean,
 * Wikipedia-style, chronologically ordered set of buckets:
 *
 *   Studio Albums | EPs | Singles | Collaborations | (extras: Live, Compilations)
 *
 * Pure functions only (no I/O). Pair with getArtistAlbums() in `./deezer.ts`.
 */

import type { DeezerAlbum } from './deezer';

// ---------- Title normalization ----------

/**
 * Patterns that mark "the same album, different packaging". Stripped before
 * we compare titles for de-duplication.
 */
const VARIANT_PATTERNS: RegExp[] = [
  // Parenthesised qualifiers
  /\s*\(\s*deluxe(?:\s+edition)?\s*\)\s*/gi,
  /\s*\(\s*super\s+deluxe(?:\s+edition)?\s*\)\s*/gi,
  /\s*\(\s*expanded(?:\s+edition)?\s*\)\s*/gi,
  /\s*\(\s*remaster(?:ed)?(?:\s+\d{2,4})?\s*\)\s*/gi,
  /\s*\(\s*\d{1,3}(?:st|nd|rd|th)?\s+anniversary(?:\s+edition)?\s*\)\s*/gi,
  /\s*\(\s*anniversary(?:\s+edition)?\s*\)\s*/gi,
  /\s*\(\s*reissue\s*\)\s*/gi,
  /\s*\(\s*bonus\s+(?:track|tracks|edition)\s*\)\s*/gi,
  /\s*\(\s*special\s+edition\s*\)\s*/gi,
  // Bracketed qualifiers
  /\s*\[\s*deluxe(?:\s+edition)?\s*\]\s*/gi,
  /\s*\[\s*remaster(?:ed)?(?:\s+\d{2,4})?\s*\]\s*/gi,
  // Hyphenated suffixes ("- Deluxe", "- Remastered 2011")
  /\s*-\s*deluxe(?:\s+edition)?\s*$/gi,
  /\s*-\s*remaster(?:ed)?(?:\s+\d{2,4})?\s*$/gi,
  /\s*-\s*anniversary(?:\s+edition)?\s*$/gi,
];

/**
 * Heuristics for detecting a live recording from the title alone.
 * Deezer often labels live releases with `record_type: "album"`, so we
 * fall back to title patterns.
 */
const LIVE_PATTERNS: RegExp[] = [
  /\(\s*live(?:\s+at\b[^)]*)?\s*\)/i,
  /\[\s*live\b[^\]]*\]/i,
  /\blive\s+at\b/i,
  /\blive\s+in\b/i,
  /\blive\s+from\b/i,
];

/**
 * Normalize an album title for de-duplication: strip variant qualifiers
 * (Deluxe / Remastered / Anniversary / Reissue), collapse whitespace, and
 * lowercase. Two titles compare equal when their normalized forms match.
 */
export function normalizeAlbumTitle(title: string): string {
  let normalized = title;
  for (const pattern of VARIANT_PATTERNS) normalized = normalized.replace(pattern, ' ');
  return normalized.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Title-based heuristic: is this a live recording? */
export function isLiveAlbum(album: { title: string }): boolean {
  return LIVE_PATTERNS.some(pattern => pattern.test(album.title));
}

// ---------- Categorization ----------

export type DiscographyCategory =
  | 'studio'
  | 'ep'
  | 'single'
  | 'compilation'
  | 'live'
  | 'collaboration';

export interface ClassifiedAlbum extends DeezerAlbum {
  category: DiscographyCategory;
  normalizedTitle: string;
}

/**
 * Classify a single Deezer album into a discography bucket.
 *
 * @param album       The Deezer album payload.
 * @param artistId    The artist whose page is being rendered. If the album's
 *                    primary artist differs, the album is a Collaboration.
 */
export function classifyAlbum(
  album: DeezerAlbum,
  artistId: string | number,
): DiscographyCategory {
  const recordType = (album.record_type ?? '').toLowerCase();
  const albumArtistId = album.artist?.id != null ? String(album.artist.id) : null;
  const ownArtistId = String(artistId);

  // Live detection by title beats whatever record_type Deezer assigns,
  // because Deezer typically labels live releases as `record_type: 'album'`.
  if (isLiveAlbum(album)) return 'live';

  // Primary-artist check: if the album's artist isn't the one we're viewing,
  // bucket it as a collaboration regardless of record_type.
  if (albumArtistId && albumArtistId !== ownArtistId) return 'collaboration';

  switch (recordType) {
    case 'album':   return 'studio';
    case 'ep':      return 'ep';
    case 'single':  return 'single';
    case 'compile': return 'compilation';
    default:        return 'studio'; // safest default for unknown types
  }
}

// ---------- De-duplication ----------

/**
 * Keep only the earliest-released variant of each normalized title.
 * Releases without a date sort to the end of the priority order, so
 * a dated original always wins over an undated re-issue.
 */
export function dedupePreferOldest<T extends DeezerAlbum>(albums: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const album of albums) {
    const key = normalizeAlbumTitle(album.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, album);
      continue;
    }

    const existingDate = existing.release_date ?? '';
    const candidateDate = album.release_date ?? '';

    if (!existingDate && candidateDate) {
      byKey.set(key, album);
    } else if (existingDate && candidateDate && candidateDate < existingDate) {
      byKey.set(key, album);
    }
  }

  return Array.from(byKey.values());
}

// ---------- Sorting ----------

/** Ascending sort by release_date. Undated releases sort last; ties broken by title. */
export function sortByReleaseDateAsc<T extends DeezerAlbum>(albums: T[]): T[] {
  return [...albums].sort((a, b) => {
    const dateA = a.release_date ?? '9999-12-31';
    const dateB = b.release_date ?? '9999-12-31';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

// ---------- Top-level builder ----------

export interface Discography {
  studioAlbums:   ClassifiedAlbum[];
  eps:            ClassifiedAlbum[];
  singles:        ClassifiedAlbum[];
  collaborations: ClassifiedAlbum[];
  live:           ClassifiedAlbum[];
  compilations:   ClassifiedAlbum[];
}

/**
 * Turn a raw Deezer album list into a Wikipedia-style discography:
 *
 *  • classified by record_type + primary-artist check
 *  • studio albums de-duplicated (Deluxe / Remastered / Anniversary collapsed
 *    into the original)
 *  • every bucket sorted oldest → newest by release_date
 *
 * Live and Compilations are returned in their own buckets so the UI can
 * decide whether to show them (e.g. via a "Show extras" toggle).
 */
export function buildDiscography(
  albums: DeezerAlbum[],
  artistId: string | number,
): Discography {
  const classified: ClassifiedAlbum[] = albums.map(album => ({
    ...album,
    category: classifyAlbum(album, artistId),
    normalizedTitle: normalizeAlbumTitle(album.title),
  }));

  const buckets = {
    studio:        classified.filter(a => a.category === 'studio'),
    ep:            classified.filter(a => a.category === 'ep'),
    single:        classified.filter(a => a.category === 'single'),
    collaboration: classified.filter(a => a.category === 'collaboration'),
    live:          classified.filter(a => a.category === 'live'),
    compilation:   classified.filter(a => a.category === 'compilation'),
  };

  return {
    studioAlbums:   sortByReleaseDateAsc(dedupePreferOldest(buckets.studio)),
    eps:            sortByReleaseDateAsc(dedupePreferOldest(buckets.ep)),
    singles:        sortByReleaseDateAsc(buckets.single),
    collaborations: sortByReleaseDateAsc(dedupePreferOldest(buckets.collaboration)),
    live:           sortByReleaseDateAsc(buckets.live),
    compilations:   sortByReleaseDateAsc(buckets.compilation),
  };
}

// ---------- Rating-original-resolution helper ----------

/**
 * Given an album the user rated and the artist's full Deezer album list,
 * return the deezer_id of the *original* release that shares the same
 * normalized title (oldest dated variant). Falls back to the input
 * album's id if no original is found.
 *
 * Used by the rating write path so a rating on
 * "The Way of All Flesh (Deluxe Edition)" lands on the row for
 * "The Way of All Flesh". Going-forward only — does not migrate
 * existing rows in music_cache.
 */
export function resolveOriginalAlbumId(
  rated: DeezerAlbum,
  artistAlbums: DeezerAlbum[],
): string {
  const ratedKey = normalizeAlbumTitle(rated.title);
  const candidates = artistAlbums.filter(
    album => normalizeAlbumTitle(album.title) === ratedKey,
  );
  if (candidates.length === 0) return String(rated.id);
  return String(sortByReleaseDateAsc(candidates)[0].id);
}
