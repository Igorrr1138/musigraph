/**
 * Genre Mapping System — Bandcamp-style taxonomy.
 *
 * Maps noisy/granular Last.fm tags to a small set of clean parent categories
 * so we can show consistent genre badges and (later) power a genre discovery page.
 */

export type GenreCategory =
  | 'Metal'
  | 'Rock'
  | 'Electronic'
  | 'Hip-Hop'
  | 'Pop'
  | 'Jazz'
  | 'Folk/Acoustic'
  | 'R&B/Soul'
  | 'Country'
  | 'Reggae'
  | 'Classical'
  | 'Experimental'
  | 'Various';

export const GENRE_DATABASE: Record<Exclude<GenreCategory, 'Various'>, string[]> = {
  Metal: [
    'metal', 'heavy metal', 'thrash metal', 'groove metal', 'death metal',
    'black metal', 'power metal', 'doom metal', 'sludge', 'metalcore',
    'deathcore', 'progressive metal', 'symphonic metal', 'industrial metal', 'grindcore',
  ],
  Rock: [
    'rock', 'alternative rock', 'indie rock', 'punk', 'post-punk', 'hard rock',
    'psychedelic rock', 'grunge', 'post-rock', 'shoegaze', 'garage rock',
    'progressive rock', 'noise rock', 'math rock', 'gothic rock',
  ],
  Electronic: [
    'electronic', 'techno', 'house', 'ambient', 'idm', 'synthwave', 'trance',
    'dubstep', 'drum and bass', 'downtempo', 'vaporwave', 'electro', 'industrial',
    'breakcore', 'deep house',
  ],
  'Hip-Hop': [
    'hip-hop', 'hip hop', 'rap', 'trap', 'boom bap', 'lo-fi hip hop', 'cloud rap',
    'gangsta rap', 'conscious hip hop', 'instrumental hip hop', 'hardcore hip hop',
  ],
  Pop: [
    'pop', 'synth-pop', 'synthpop', 'indie pop', 'dream pop', 'art pop', 'j-pop',
    'k-pop', 'chamber pop', 'electropop', 'hyperpop',
  ],
  Jazz: [
    'jazz', 'fusion', 'bebop', 'free jazz', 'cool jazz', 'vocal jazz', 'acid jazz',
    'smooth jazz', 'hard bop',
  ],
  'Folk/Acoustic': [
    'folk', 'indie folk', 'singer-songwriter', 'acoustic', 'americana',
    'traditional folk', 'neofolk',
  ],
  'R&B/Soul': [
    'soul', 'r&b', 'rnb', 'funk', 'neo-soul', 'contemporary r&b', 'motown', 'disco',
  ],
  Country: ['country', 'bluegrass', 'alt-country', 'outlaw country', 'honky tonk'],
  Reggae: ['reggae', 'dub', 'ska', 'dancehall', 'roots reggae'],
  Classical: [
    'classical', 'contemporary classical', 'minimalism', 'opera', 'orchestral', 'baroque',
  ],
  Experimental: [
    'experimental', 'avant-garde', 'avantgarde', 'drone', 'noise', 'field recordings',
    'dark ambient',
  ],
};

/**
 * Normalize a raw tag/genre string so cosmetic variations collapse together.
 * Lowercases, replaces hyphens/underscores with spaces, and collapses
 * runs of whitespace. E.g. "Nu-Metal", "nu metal", "nu_metal" -> "nu metal".
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Common shorthand aliases that normalization alone can't fix (missing
 * spaces, abbreviations). Keys AND values are already normalized form.
 */
const genreAliases: Record<string, string> = {
  'prog rock': 'progressive rock',
  'prog metal': 'progressive metal',
  'hiphop': 'hip hop',
  'synthpop': 'synth pop',
  'postrock': 'post rock',
  'postpunk': 'post punk',
  'numetal': 'nu metal',
  'dnb': 'drum and bass',
  'rnb': 'r&b',
  'r and b': 'r&b',
  'idm': 'idm',
};

function normalizeTag(tag: string): string {
  const n = normalizeString(tag);
  return genreAliases[n] ?? n;
}

// Build a fast lookup: normalized tag -> category. Longer/more-specific tags
// are inserted first so exact matches win (e.g. "death metal" beats "metal").
const TAG_TO_CATEGORY: Map<string, GenreCategory> = (() => {
  const entries: Array<[string, GenreCategory]> = [];
  for (const [category, tags] of Object.entries(GENRE_DATABASE) as Array<[GenreCategory, string[]]>) {
    for (const t of tags) entries.push([normalizeTag(t), category]);
  }
  entries.sort((a, b) => b[0].length - a[0].length);
  return new Map(entries);
})();

function normalize(tag: string): string {
  return normalizeTag(tag);
}

/** Canonical form for dedup — same as normalizeString. */
function canonicalize(tag: string): string {
  return normalizeString(tag);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word containment check.
 *
 * Returns true if `knownTag` appears in `tag` as a discrete token rather than
 * a substring of a larger word. This prevents false positives such as
 * "metallica" matching the genre "metal", or "anthrax" matching nothing
 * accidentally. Hyphens, slashes and ampersands all count as word boundaries
 * so multi-word genres like "hip-hop" and "r&b" still match cleanly.
 */
function containsAsWord(tag: string, knownTag: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(knownTag)}([^a-z0-9]|$)`, 'i');
  return re.test(tag);
}

/**
 * Resolve a list of raw tags (from Last.fm or elsewhere) to a single clean
 * parent category. Returns the first matching category, falling back to
 * "Various" if nothing matches.
 */
export function resolveGenre(tags: string[] | null | undefined): GenreCategory {
  if (!tags || tags.length === 0) return 'Various';

  for (const raw of tags) {
    if (!raw) continue;
    const tag = normalize(raw);

    // Exact match first
    const direct = TAG_TO_CATEGORY.get(tag);
    if (direct) return direct;

    // Whole-word match against known sub-genre tags (longest first wins)
    for (const [knownTag, category] of TAG_TO_CATEGORY) {
      if (containsAsWord(tag, knownTag)) return category;
    }
  }

  return 'Various';
}

/**
 * Map any raw tag to its parent category, or null if it isn't a recognised
 * music genre/sub-genre. Used to filter out noise like "favorites", artist
 * names ("metallica"), or random descriptors while keeping specific
 * sub-genres ("groove metal", "shoegaze").
 */
export function categoryForTag(rawTag: string): GenreCategory | null {
  const tag = normalize(rawTag);
  if (!tag) return null;
  const direct = TAG_TO_CATEGORY.get(tag);
  if (direct) return direct;
  for (const [knownTag, category] of TAG_TO_CATEGORY) {
    if (containsAsWord(tag, knownTag)) return category;
  }
  return null;
}

function titleCase(tag: string): string {
  return tag
    .split(/\s+/)
    .map(w => (w.length <= 3 && w !== w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export interface ResolvedGenreTag {
  /** Display label, e.g. "Groove Metal" */
  label: string;
  /** Lowercase slug used for routing, e.g. "groove-metal" */
  slug: string;
  /** Parent category, e.g. "Metal" */
  category: GenreCategory;
}

/**
 * Resolve a raw tag list to a deduped list of specific sub-genre badges
 * (e.g. ["Groove Metal", "Metalcore", "Thrash Metal"]). Tags that don't map
 * to any known music category are dropped. Falls back to a single "Various"
 * entry when nothing matches.
 */
export function resolveGenres(
  tags: string[] | null | undefined,
  limit = 5,
  excludeName?: string | null,
): ResolvedGenreTag[] {
  const fallback: ResolvedGenreTag = { label: 'Music', slug: 'music', category: 'Various' };
  if (!tags || tags.length === 0) return [fallback];

  const exclude = excludeName ? canonicalize(excludeName) : '';
  const seen = new Set<string>();
  const out: ResolvedGenreTag[] = [];

  for (const raw of tags) {
    if (!raw) continue;
    const tag = normalize(raw);
    const canon = canonicalize(tag);
    if (exclude && (canon === exclude || canon.includes(exclude) || exclude.includes(canon))) continue;
    const category = categoryForTag(tag);
    if (!category) continue;
    if (seen.has(canon)) continue;
    seen.add(canon);
    out.push({
      label: titleCase(tag.replace(/-/g, ' ')),
      slug: canon.replace(/\s+/g, '-'),
      category,
    });
    if (out.length >= limit) break;
  }

  if (out.length === 0) return [fallback];
  return out;
}

/**
 * Filter raw Last.fm-style tags down to recognised musical genres,
 * excluding any tag that matches the artist's name. Returns up to `limit`
 * resolved genres, or a single "Music" fallback when nothing matches.
 */
export function getValidGenres(
  apiTags: Array<{ name: string }> | string[] | null | undefined,
  artistName?: string | null,
  limit = 5,
): ResolvedGenreTag[] {
  const names = (apiTags ?? []).map(t => (typeof t === 'string' ? t : t?.name)).filter(Boolean) as string[];
  return resolveGenres(names, limit, artistName);
}

/**
 * Ordered list of parent categories used by the Discovery page navigation.
 * Order is taste-driven (most-trafficked categories first) and matches the
 * wireframe so Rock anchors the left edge.
 */
export const PARENT_CATEGORIES: ReadonlyArray<Exclude<GenreCategory, 'Various'>> = [
  'Rock', 'Metal', 'Electronic', 'Hip-Hop', 'Pop', 'Jazz',
  'R&B/Soul', 'Folk/Acoustic', 'Country', 'Reggae', 'Classical', 'Experimental',
];

/** Return all sub-genre tags for a parent category, lowercase canonical. */
export function getSubGenresForCategory(category: GenreCategory): string[] {
  if (category === 'Various') return [];
  return (GENRE_DATABASE[category] ?? []).map(s => s.toLowerCase());
}

/** URL-safe slug for a parent category, e.g. "Hip-Hop" -> "hip-hop". */
export function parentCategorySlug(category: Exclude<GenreCategory, 'Various'>): string {
  return category.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Reverse lookup: slug -> parent category, or null if not a parent slug. */
export function parentCategoryFromSlug(slug: string | null | undefined): Exclude<GenreCategory, 'Various'> | null {
  if (!slug) return null;
  const target = slug.toLowerCase();
  for (const cat of PARENT_CATEGORIES) {
    if (parentCategorySlug(cat) === target) return cat;
  }
  return null;
}

/** Format a raw tag as a clean display label, e.g. "groove metal" -> "Groove Metal". */
export function formatTagLabel(tag: string): string {
  return titleCase(tag.replace(/-/g, ' '));
}
