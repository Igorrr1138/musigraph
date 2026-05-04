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
 * "Variant keywords" — words that mark "the same album, different packaging".
 * If a parenthesised, bracketed, or hyphen-suffixed clause contains any of
 * these, it gets stripped before titles are compared for de-duplication.
 *
 * Permissive on purpose: real-world reissue tags include combinations like
 * "(Deluxe / Remastered)", "(Deluxe Remastered Box Set)", "(20th Anniversary
 * Super Deluxe Edition)", etc., so we match any qualifier whose body contains
 * at least one keyword rather than enumerating every combination.
 */
const VARIANT_KEYWORDS_RE =
  /\b(?:deluxe|super\s+deluxe|expanded|remaster(?:ed)?|anniversary|reissue|reissued|bonus|special\s+edition|ultimate(?:\s+edition)?|box\s+set|collector(?:'s)?|limited(?:\s+edition)?|edition|version|mono|stereo)\b/i;

const VARIANT_PATTERNS: RegExp[] = [
  // Parenthesised qualifier containing at least one variant keyword.
  /\s*\([^)]*\b(?:deluxe|super\s+deluxe|expanded|remaster(?:ed)?(?:\s+\d{2,4})?|anniversary|reissue|reissued|bonus|special\s+edition|ultimate(?:\s+edition)?|box\s+set|collector(?:'s)?|limited(?:\s+edition)?|edition|version|mono|stereo)\b[^)]*\)\s*/gi,
  // Square-bracket qualifier with the same keywords.
  /\s*\[[^\]]*\b(?:deluxe|remaster(?:ed)?(?:\s+\d{2,4})?|anniversary|reissue|reissued|bonus|special|ultimate|box\s+set|edition|version)\b[^\]]*\]\s*/gi,
  // Hyphenated suffix forms ("- Deluxe Edition", "- Remastered 2011", "- Anniversary").
  /\s*-\s*(?:deluxe|super\s+deluxe|expanded|remaster(?:ed)?(?:\s+\d{2,4})?|anniversary|reissue|reissued|bonus|special\s+edition|ultimate)(?:\s+(?:edition|version))?\s*$/gi,
];

/**
 * Heuristics for detecting a live recording from the title alone.
 * Deezer doesn't have a "live" record_type — most live releases come back as
 * `record_type: 'album'`, so we have to recognise them from the title.
 */
const LIVE_PATTERNS: RegExp[] = [
  // Bare word "live" anywhere in the title — high recall, very few false
  // positives because "live" is rarely a content word in album titles.
  /\blive\b/i,
  /\bunplugged\b/i,
  /\bin\s+concert\b/i,
  // Symphonic / orchestral live records (e.g. "S&M", "S&M2 (Live with the
  // San Francisco Symphony)") — most of these include the word "Symphony".
  /\bsymphony\b/i,
  /\borchestra\b/i,
];

/**
 * Heuristics for detecting compilation / covers / tribute / soundtrack
 * releases that Deezer mislabels as `record_type: 'album'`.
 */
const COMPILATION_PATTERNS: RegExp[] = [
  /\bgreatest\s+hits\b/i,
  /\bbest\s+of\b/i,
  /\bcompilation\b/i,
  /\banthology\b/i,
  /\bcovers?\s+album\b/i,
  /\btribute\b/i,
  /\bblacklist\b/i, // covers/tribute albums (e.g. The Metallica Blacklist)
  /\b(?:original|motion\s+picture)\s+soundtrack\b/i,
];

/**
 * Normalize an album title for de-duplication: strip variant qualifiers
 * (Deluxe / Remastered / Anniversary / Reissue / Box Set / etc.), collapse
 * whitespace, and lowercase. Two titles compare equal when their normalized
 * forms match.
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

/** Title-based heuristic: is this a compilation / covers / tribute / soundtrack? */
export function isCompilationAlbum(album: { title: string }): boolean {
  return COMPILATION_PATTERNS.some(pattern => pattern.test(album.title));
}

/** Does this title look like a reissue / variant rather than an original release? */
export function looksLikeVariant(title: string): boolean {
  return VARIANT_KEYWORDS_RE.test(title);
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
 * Order of precedence is deliberate:
 *   1. Live (title-based) — Deezer has no live `record_type`.
 *   2. Compilation — by Deezer's `record_type: 'compile'` OR by title
 *      (greatest hits / soundtrack / tribute / etc.).
 *   3. Collaboration — album's primary artist differs from the page artist.
 *   4. Otherwise: trust Deezer's `record_type` (album / ep / single).
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

  if (isLiveAlbum(album)) return 'live';

  if (recordType === 'compile' || isCompilationAlbum(album)) return 'compilation';

  if (albumArtistId && albumArtistId !== ownArtistId) return 'collaboration';

  switch (recordType) {
    case 'album':  return 'studio';
    case 'ep':     return 'ep';
    case 'single': return 'single';
    default:       return 'studio'; // safest default for unknown types
  }
}

// ---------- De-duplication ----------

/**
 * Keep only the earliest-released variant of each normalized title.
 * Tiebreakers (when two variants share a release_date):
 *   1. Prefer the title that does NOT look like a reissue / variant
 *      (so "Album" wins over "Album (Deluxe)" if both are dated 2016).
 *   2. Fall back to lexical title order for full determinism.
 */
export function dedupePreferOldest<T extends DeezerAlbum>(albums: T[]): T[] {
  const byKey = new Map<string, T>();

  const score = (album: T): { date: string; isVariant: boolean; title: string } => ({
    date: album.release_date ?? '9999-12-31',
    isVariant: looksLikeVariant(album.title ?? ''),
    title: album.title ?? '',
  });

  for (const album of albums) {
    const key = normalizeAlbumTitle(album.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, album);
      continue;
    }

    const a = score(existing);
    const b = score(album);

    // Prefer the older release_date.
    if (b.date < a.date) {
      byKey.set(key, album);
      continue;
    }
    if (b.date > a.date) continue;

    // Same date — prefer the non-variant title (e.g. "Album" over "Album (Deluxe)").
    if (a.isVariant && !b.isVariant) {
      byKey.set(key, album);
      continue;
    }
    if (!a.isVariant && b.isVariant) continue;

    // Final tiebreak: lexical title order, so the result is stable.
    if (b.title.localeCompare(a.title) < 0) byKey.set(key, album);
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
 *  • classified by record_type + primary-artist + title heuristics
 *  • every bucket de-duplicated (Deluxe / Remastered / Anniversary collapsed
 *    onto the original; Singles also dedup'd to collapse re-releases)
 *  • every bucket sorted oldest → newest by release_date
 *
 * Live and Compilations are returned in their own buckets so the UI can
 * decide whether to show them and how (e.g. via filter tabs).
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
    singles:        sortByReleaseDateAsc(dedupePreferOldest(buckets.single)),
    collaborations: sortByReleaseDateAsc(dedupePreferOldest(buckets.collaboration)),
    live:           sortByReleaseDateAsc(dedupePreferOldest(buckets.live)),
    compilations:   sortByReleaseDateAsc(dedupePreferOldest(buckets.compilation)),
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
