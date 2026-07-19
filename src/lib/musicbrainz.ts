/**
 * MusicBrainz client — PRIMARY source of the discography skeleton.
 *
 * The pipeline in `musicPipeline.ts` uses MB for: artist resolution,
 * chronology (first-release-date on release-groups), classification
 * (primary + secondary types), and genres/tags. Deezer is only used to
 * enrich each MB release group with cover art, IDs, and tracklists.
 *
 * Resolution strategy:
 *   1. Try MB URL-relation search on the Deezer artist URL
 *      (`url:"deezer.com/artist/<ID>"`) — exact 1:1 match when someone has
 *      linked the artist on MB.
 *   2. Fall back to `artist/?query=artist:"Name"` and pick the top score.
 *
 * All requests carry a descriptive User-Agent (MB policy) and are bounded
 * by a short timeout. Every helper returns null / [] on failure so the
 * caller can degrade to a Deezer-only path.
 */

const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_HEADERS: HeadersInit = {
  Accept: 'application/json',
  'User-Agent': 'SoundVault/1.0 ( https://musigraph.lovable.app )',
};
const DEFAULT_TIMEOUT = 8_000;

async function mbFetch<T>(path: string, timeoutMs = DEFAULT_TIMEOUT): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${MB_BASE}${path}${path.includes('?') ? '&' : '?'}fmt=json`, {
      headers: MB_HEADERS,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Escape a value for the Lucene-style MB query string. */
function lucene(s: string): string {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/])/g, '\\$1');
}

interface MbArtistSearchResponse {
  artists?: Array<{ id: string; score?: number; name?: string }>;
}

/**
 * Resolve the MusicBrainz artist MBID for a Deezer artist. Primary path:
 * URL relation to the Deezer artist page. Fallback: name search.
 */
export async function findArtistMbid(
  deezerId: string,
  artistName?: string,
): Promise<string | null> {
  // Path 1 — URL relation.
  const url = `https://www.deezer.com/artist/${deezerId}`;
  const q1 = encodeURIComponent(`url:"${lucene(url)}"`);
  const r1 = await mbFetch<MbArtistSearchResponse>(
    `/artist/?query=${q1}&limit=1`,
    5000,
  );
  const hit1 = r1?.artists?.[0];
  if (hit1?.id && (hit1.score ?? 0) >= 90) return hit1.id;

  // Path 2 — name search.
  if (!artistName) return hit1?.id ?? null;
  const q2 = encodeURIComponent(`artist:"${lucene(artistName)}"`);
  const r2 = await mbFetch<MbArtistSearchResponse>(
    `/artist/?query=${q2}&limit=5`,
  );
  const best = r2?.artists?.[0];
  return best?.id ?? hit1?.id ?? null;
}

export type MbRecordType = 'album' | 'ep' | 'single' | 'live' | 'compilation';

export interface MbRelease {
  mbid: string;
  title: string;
  /** ISO date (YYYY, YYYY-MM, or YYYY-MM-DD). */
  date?: string;
  year?: number;
  record_type: MbRecordType;
}

interface MbReleaseGroupsResponse {
  'release-groups'?: Array<{
    id: string;
    title: string;
    'first-release-date'?: string;
    'primary-type'?: string | null;
    'secondary-types'?: string[];
  }>;
}

/** Map an MB (primary, secondary[]) pair to our internal record_type. */
function classifyReleaseGroup(
  primary: string | null | undefined,
  secondary: string[] | undefined,
): MbRecordType | null {
  const sec = new Set((secondary ?? []).map((s) => s.toLowerCase()));
  if (sec.has('live')) return 'live';
  if (sec.has('compilation') || sec.has('soundtrack') || sec.has('mixtape/street')) {
    return 'compilation';
  }
  // Everything with a secondary type we don't recognize (Demo, Interview,
  // Audio drama, Spokenword, Remix, DJ-mix…) is dropped — keeps the
  // discography focused on real listenable studio output.
  if (sec.size > 0) return null;

  switch ((primary ?? '').toLowerCase()) {
    case 'album':
      return 'album';
    case 'ep':
      return 'ep';
    case 'single':
      return 'single';
    case 'broadcast':
    case 'other':
      return null;
    default:
      return null;
  }
}

/**
 * Fetch the artist's release groups (albums/EPs/singles/live/compilation).
 * Paginated at 100 per page; MB caps at 100 so we walk offsets until empty.
 */
export async function fetchArtistReleases(mbid: string): Promise<MbRelease[]> {
  const out: MbRelease[] = [];
  const seen = new Set<string>();
  const pageSize = 100;

  for (let offset = 0; offset < 500; offset += pageSize) {
    const path = `/release-group?artist=${mbid}&type=album|ep|single&limit=${pageSize}&offset=${offset}`;
    const r = await mbFetch<MbReleaseGroupsResponse>(path);
    const groups = r?.['release-groups'] ?? [];
    if (groups.length === 0) break;

    for (const g of groups) {
      if (!g.id || !g.title || seen.has(g.id)) continue;
      const rt = classifyReleaseGroup(g['primary-type'], g['secondary-types']);
      if (!rt) continue;

      const date = g['first-release-date'] || undefined;
      const yearNum = date ? parseInt(date.slice(0, 4), 10) : NaN;
      const year = Number.isFinite(yearNum) ? yearNum : undefined;

      seen.add(g.id);
      out.push({ mbid: g.id, title: g.title, date, year, record_type: rt });
    }
    if (groups.length < pageSize) break;
  }

  return out;
}

interface MbArtistDetailResponse {
  genres?: Array<{ name: string; count?: number }>;
  tags?: Array<{ name: string; count?: number }>;
}

/**
 * Fetch the artist's genres. Prefers the curated `genres` array (MB's
 * new structured field); falls back to community `tags`. Returns
 * lowercase, count-sorted, deduplicated labels.
 */
export async function fetchArtistGenres(mbid: string): Promise<string[]> {
  const r = await mbFetch<MbArtistDetailResponse>(
    `/artist/${mbid}?inc=genres+tags`,
    5000,
  );
  if (!r) return [];
  const source = (r.genres && r.genres.length > 0 ? r.genres : r.tags) ?? [];
  const sorted = [...source]
    .filter((g) => g?.name && (g.count ?? 0) >= 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of sorted) {
    const label = g.name.toLowerCase().trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
