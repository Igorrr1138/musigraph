/**
 * Genre Whitelist
 *
 * Single source of truth for "is this string a real musical genre?".
 *
 * Built directly on top of GENRE_DATABASE in genreMap.ts so the app keeps
 * exactly one curated taxonomy. Used to:
 *   - Filter Last.fm tag responses (drop "seen live", "favorites", etc.)
 *   - Validate /genre/:slug route parameters
 *   - Power the Genre Discovery page's pre-defined genre tiles & autocomplete
 *
 * Slug rules (URL-safe, lossless round-trip via SLUG_INDEX):
 *   "Alternative Rock" -> "alternative-rock"
 *   "R&B"              -> "r-and-b"
 *   "Hip-Hop"          -> "hip-hop"
 */

import { GENRE_DATABASE, categoryForTag, type GenreCategory } from './genreMap';

export interface WhitelistedGenre {
  /** Display label, e.g. "Alternative Rock" */
  label: string;
  /** URL slug, e.g. "alternative-rock" */
  slug: string;
  /** Parent category, e.g. "Rock" */
  category: GenreCategory;
  /** Lowercase canonical key used for tag matching against artists_cache.tags */
  key: string;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => {
      if (!w) return w;
      const lower = w.toLowerCase();
      // Preserve all-caps acronyms longer than one char (e.g. "IDM")
      if (w === w.toUpperCase() && w.length > 1) return w;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function toSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Flatten GENRE_DATABASE into a deduped, alphabetised list of canonical
 * sub-genres. The parent categories (Metal, Rock, ...) are also exposed as
 * pseudo-entries with `key === category.toLowerCase()` so a slug like
 * /genre/metal still resolves.
 */
export const ALL_WHITELISTED_GENRES: WhitelistedGenre[] = (() => {
  const seen = new Map<string, WhitelistedGenre>();

  // Sub-genres first.
  for (const [category, tags] of Object.entries(GENRE_DATABASE) as Array<[GenreCategory, string[]]>) {
    for (const raw of tags) {
      const key = raw.toLowerCase().trim();
      const slug = toSlug(key);
      if (!slug || seen.has(slug)) continue;
      seen.set(slug, { label: titleCase(key), slug, category, key });
    }
  }

  // Parent categories.
  for (const category of Object.keys(GENRE_DATABASE) as GenreCategory[]) {
    const key = category.toLowerCase();
    const slug = toSlug(category);
    if (slug && !seen.has(slug)) {
      seen.set(slug, { label: category, slug, category, key });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
})();

const SLUG_INDEX = new Map(ALL_WHITELISTED_GENRES.map(g => [g.slug, g]));
const KEY_INDEX = new Map(ALL_WHITELISTED_GENRES.map(g => [g.key, g]));

/**
 * Resolve a /genre/:slug parameter to its canonical genre entry. Returns
 * null when the slug isn't a recognised musical genre/sub-genre. The page
 * component uses this to fall back to the parent category or "All Artists".
 */
export function genreFromSlug(slug: string | null | undefined): WhitelistedGenre | null {
  if (!slug) return null;
  return SLUG_INDEX.get(slug.toLowerCase()) ?? null;
}

/**
 * Look up by raw tag string (exact-match lowercase). For lenient matching
 * including word-boundary checks ("alternative rock" -> Rock), use
 * isWhitelistedTag below.
 */
export function genreFromTag(tag: string | null | undefined): WhitelistedGenre | null {
  if (!tag) return null;
  const key = tag.trim().toLowerCase();
  if (!key) return null;
  return KEY_INDEX.get(key) ?? null;
}

/**
 * True when `tag` matches a sub-genre or a parent category in the whitelist.
 * Falls back to `categoryForTag()` from genreMap.ts for word-boundary
 * matches like "death metal" -> Metal.
 */
export function isWhitelistedTag(tag: string | null | undefined): boolean {
  if (!tag) return false;
  const key = tag.trim().toLowerCase();
  if (!key) return false;
  if (KEY_INDEX.has(key)) return true;
  return categoryForTag(key) !== null;
}

/**
 * Filter a list of raw tags down to whitelisted music genres only.
 * Preserves order, dedupes by canonical lowercase key.
 */
export function filterWhitelistedTags(tags: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    if (!raw) continue;
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    if (!isWhitelistedTag(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
