/**
 * Metadata purification — the "3-level" cleaning contract for the artist /
 * album pages:
 *
 *   1. TITLE SANITIZATION — strip streaming-platform reissue chatter from
 *      track titles ("(2010 Remaster)", "- Radio Edit", "[Mono Mix]" …).
 *      Titles are kept, only the noise is stripped.
 *
 *   2. NON-MUSICAL EXCLUSION — drop tracks that are commentary, interviews,
 *      audio liner notes, videos, or trailers. These pollute statistics.
 *
 *   3. CONTEXTUAL DUPLICATE FILTER — on Deluxe / Expanded editions, drop a
 *      track whose sanitized title already appeared earlier in the album AND
 *      whose raw title carries a variant marker (Live, Demo, Remix, Acoustic,
 *      Alternate, Version). Unique bonus songs are kept.
 *
 * Plus a duration floor (< 45 s) for anything that isn't a Single or EP —
 * skits, intros, and hidden filler get dropped from studio albums but stay
 * on singles/EPs where a 30-second interlude may be the entire release.
 */

import type { DeezerTrack } from './deezer';

// ---------- Title sanitizer ----------

/**
 * Trailing suffix separators (`-`, `–`, `—`, `:`) followed by streaming reissue
 * chatter. Matches at end of string only, so a track literally titled
 * "Album Version" stays intact when it isn't a suffix.
 */
const STREAMING_SUFFIX_RE =
  /\s*[-–—:]\s*(?:\d{2,4}\s+)?(?:remaster(?:ed)?(?:\s+\d{2,4})?|remix(?:ed)?|mono(?:\s+(?:mix|version))?|stereo(?:\s+(?:mix|version))?|radio\s+edit|single\s+(?:edit|version)|album\s+version|bonus\s+track|deluxe(?:\s+edition)?|extended(?:\s+(?:mix|version))?|clean(?:\s+version)?|explicit(?:\s+version)?|edit|version|acoustic(?:\s+version)?|instrumental|demo|alternate(?:\s+(?:take|version))?)\s*$/i;

/**
 * Bracketed reissue chatter — parenthesised or square-bracketed clauses
 * containing any of the keyword set. Applied globally so nested `(...)`
 * suffixes both go.
 */
const STREAMING_BRACKET_RE =
  /\s*[\(\[][^\)\]]*\b(?:remaster(?:ed)?|remix(?:ed)?|mono|stereo|radio\s+edit|single\s+(?:edit|version)|album\s+version|bonus\s+track|deluxe|extended|clean|explicit|edit|version|acoustic|instrumental|demo|alternate)\b[^\)\]]*[\)\]]/gi;

/**
 * Strip streaming reissue markers from a track title while preserving the
 * canonical song name. Idempotent — safe to call twice.
 *
 * Examples:
 *   "Enter Sandman (2010 Remastered Version)"   -> "Enter Sandman"
 *   "Nothing Else Matters - Live at Wembley"    -> "Nothing Else Matters"
 *   "One (Radio Edit) [Explicit]"               -> "One"
 */
export function sanitizeTrackTitle(title: string): string {
  if (!title) return '';
  let out = title;
  // Multiple suffixes can stack ("(Remastered) [Live]"); iterate until stable.
  for (let i = 0; i < 4; i++) {
    const before = out;
    out = out.replace(STREAMING_BRACKET_RE, '');
    out = out.replace(STREAMING_SUFFIX_RE, '');
    if (out === before) break;
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s*[-–—:]\s*$/, '').trim();
}

// ---------- Non-musical exclusion ----------

const NON_MUSICAL_RE =
  /\b(commentary|interview|audio\s+liner\s+notes?|liner\s+notes?|trailer|documentary|podcast|spoken\s+word|voice\s+memo|studio\s+chatter|behind\s+the\s+scenes)\b/i;

// "Video" is only a non-musical marker when it isn't part of "music video"
// or "lyric video" — those are just Deezer's way of tagging a normal audio
// track that had a video attached upstream.
const VIDEO_ONLY_RE = /(?:^|\s)video(?:\s|$)/i;

export function isNonMusicalTrack(title: string): boolean {
  if (!title) return false;
  if (NON_MUSICAL_RE.test(title)) return true;
  // Standalone "video" / "video interlude" / "music video track": treat as non-musical
  if (VIDEO_ONLY_RE.test(title) && !/\bmusic\s+video\b/i.test(title) && !/\blyric\s+video\b/i.test(title)) {
    return true;
  }
  return false;
}

// ---------- Variant marker (contextual dedup) ----------

/**
 * A track is considered a "variant" of an earlier one when its raw title
 * carries one of these markers. Used only inside `purifyTracks` for the
 * contextual duplicate filter on deluxe/expanded albums.
 */
const VARIANT_MARKER_RE =
  /\b(live|demo|remix(?:ed)?|acoustic|alternate|extended|mono|stereo|radio\s+edit|single\s+(?:edit|version)|instrumental|remaster(?:ed)?|version)\b/i;

// ---------- Public: purifyTracks ----------

export interface PurifyOpts {
  /** Skip the < 45 s duration floor. Singles/EPs may legitimately be short. */
  isSingleOrEP?: boolean;
  /**
   * When true, apply the contextual duplicate filter: drop a variant-marked
   * track whose sanitized title has already appeared earlier in the album.
   */
  isDeluxeOrExpanded?: boolean;
}

const MIN_TRACK_DURATION_S = 45;

/**
 * Apply all three purification rules to a tracklist:
 *   1. sanitize each title
 *   2. drop non-musical tracks
 *   3. drop < 45 s tracks (unless single/EP)
 *   4. drop contextual duplicates (deluxe only)
 *
 * Returns a *new* array of `DeezerTrack` objects with `title` overwritten by
 * the sanitized value. Order is preserved.
 */
export function purifyTracks(tracks: DeezerTrack[], opts: PurifyOpts = {}): DeezerTrack[] {
  const seen = new Set<string>();
  const out: DeezerTrack[] = [];

  for (const t of tracks) {
    const rawTitle = t.title ?? '';
    if (!rawTitle) continue;
    if (isNonMusicalTrack(rawTitle)) continue;

    const duration = t.duration ?? 0;
    if (!opts.isSingleOrEP && duration > 0 && duration < MIN_TRACK_DURATION_S) continue;

    const cleaned = sanitizeTrackTitle(rawTitle) || rawTitle;
    const key = cleaned.toLowerCase();

    if (opts.isDeluxeOrExpanded && seen.has(key) && VARIANT_MARKER_RE.test(rawTitle)) {
      continue; // contextual duplicate (e.g. "Song A - Live" after "Song A")
    }
    seen.add(key);
    out.push({ ...t, title: cleaned });
  }

  return out;
}
