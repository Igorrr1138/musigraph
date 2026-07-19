/**
 * MusicBrainz client — PRIMARY source of the discography skeleton.
 *
 * The pipeline in `musicPipeline.ts` uses MB for: artist resolution,
 * chronology (first-release-date on release-groups), classification
 * (primary + secondary types), genres/tags, and MBID-backed album pages.
 *
 * Resolution strategy:
 *   1. Search by the artist's display name and prefer an exact normalized
 *      name match.
 *   2. Fall back to the strongest high-confidence name result.
 *
 * All requests carry a descriptive User-Agent (MB policy) and are bounded
 * by a short timeout. Every helper returns null / [] on failure so the
 * caller can degrade safely.
 */

import type { DeezerAlbum, DeezerTrack } from './deezer';

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const MB_HEADERS: HeadersInit = {
  Accept: 'application/json',
  'User-Agent': 'SoundVault/1.0 ( https://musigraph.lovable.app )',
};
const DEFAULT_TIMEOUT = 8_000;
const MBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export function isMusicBrainzId(value: string | undefined | null): boolean {
  return Boolean(value && MBID_RE.test(value));
}

export function coverArtArchiveReleaseGroupUrl(
  releaseGroupMbid: string,
  size: 250 | 500 | 1200 = 500,
): string {
  return `${CAA_BASE}/release-group/${releaseGroupMbid}/front-${size}`;
}

interface MbArtistSearchResponse {
  artists?: Array<{ id: string; score?: number; name?: string }>;
}

function normalizeArtistName(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Resolve the MusicBrainz artist MBID by artist name.
 *
 * Do not trust URL-relation search here: MB's Lucene search can return
 * unrelated artists named "URL"/"Url" with very high scores, which poisons
 * the discography cache and forces the UI back to wrong provider dates.
 */
export async function findArtistMbid(
  _deezerId: string,
  artistName?: string,
): Promise<string | null> {
  if (!artistName) return null;

  const wanted = normalizeArtistName(artistName);
  if (!wanted) return null;

  const q = encodeURIComponent(`artist:"${lucene(artistName)}"`);
  const r = await mbFetch<MbArtistSearchResponse>(
    `/artist/?query=${q}&limit=10`,
  );
  const hits = r?.artists ?? [];
  const exact = hits.find((hit) => hit.id && normalizeArtistName(hit.name) === wanted);
  if (exact?.id) return exact.id;

  const best = hits.find((hit) => hit.id && (hit.score ?? 0) >= 80);
  return best?.id ?? null;
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

interface MbReleaseGroupDetailResponse {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string | null;
  'secondary-types'?: string[];
  'artist-credit'?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
  releases?: Array<{
    id: string;
    title?: string;
    date?: string;
    status?: string;
    country?: string;
  }>;
}

interface MbReleaseDetailResponse {
  id: string;
  title: string;
  date?: string;
  'artist-credit'?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
  media?: Array<{
    tracks?: Array<{
      id?: string;
      title?: string;
      position?: number | string;
      length?: number;
      recording?: {
        id?: string;
        title?: string;
        length?: number;
        'artist-credit'?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
      };
    }>;
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

function mbRecordTypeToAppType(recordType: MbRecordType): string {
  return recordType === 'compilation' ? 'compile' : recordType;
}

function scoreReleaseForAlbumPage(release: { date?: string; status?: string; country?: string }): number {
  const official = release.status?.toLowerCase() === 'official' ? 100 : 0;
  const worldwide = release.country === 'XW' ? 12 : 0;
  const priorityCountry = ['US', 'GB', 'XE'].includes(release.country ?? '') ? 6 : 0;
  const hasDate = release.date ? 2 : 0;
  return official + worldwide + priorityCountry + hasDate;
}

function pickRepresentativeRelease(releases: MbReleaseGroupDetailResponse['releases'] = []) {
  return [...releases]
    .filter((release) => release.id)
    .sort((a, b) => {
      const score = scoreReleaseForAlbumPage(b) - scoreReleaseForAlbumPage(a);
      if (score !== 0) return score;
      const da = a.date ?? '9999-12-31';
      const db = b.date ?? '9999-12-31';
      return da.localeCompare(db);
    })[0];
}

export async function fetchReleaseGroupAlbum(
  releaseGroupMbid: string,
  fallback: { artistId?: string; artistName?: string } = {},
): Promise<DeezerAlbum | null> {
  if (!isMusicBrainzId(releaseGroupMbid)) return null;

  const group = await mbFetch<MbReleaseGroupDetailResponse>(
    `/release-group/${releaseGroupMbid}?inc=artists+releases`,
    10_000,
  );
  if (!group?.id || !group.title) return null;

  const recordType = classifyReleaseGroup(group['primary-type'], group['secondary-types']) ?? 'album';
  const representative = pickRepresentativeRelease(group.releases);
  const release = representative?.id
    ? await mbFetch<MbReleaseDetailResponse>(`/release/${representative.id}?inc=artists+recordings+media`, 10_000)
    : null;

  const date = group['first-release-date'] || release?.date || representative?.date || undefined;
  const yearNum = date ? parseInt(date.slice(0, 4), 10) : NaN;
  const artistName = fallback.artistName ?? artistCreditName(group['artist-credit']) ?? artistCreditName(release?.['artist-credit']);
  const artistMbid = artistCreditMbid(group['artist-credit']) ?? artistCreditMbid(release?.['artist-credit']);
  const coverUrl = coverArtArchiveReleaseGroupUrl(releaseGroupMbid, 500);

  let position = 0;
  const tracks: DeezerTrack[] = (release?.media ?? []).flatMap((medium) =>
    (medium.tracks ?? []).map((track) => {
      position += 1;
      const recording = track.recording;
      const durationMs = track.length ?? recording?.length ?? 0;
      return {
        id: recording?.id ?? track.id ?? `${releaseGroupMbid}-${position}`,
        title: recording?.title ?? track.title ?? `Track ${position}`,
        duration: durationMs ? Math.round(durationMs / 1000) : 0,
        track_position: typeof track.position === 'number' ? track.position : position,
        artist: artistName
          ? { id: fallback.artistId ?? artistMbid ?? '', name: artistName }
          : undefined,
        album: { id: releaseGroupMbid, title: group.title, cover_xl: coverUrl },
      };
    }),
  );

  return {
    id: releaseGroupMbid,
    mbid: releaseGroupMbid,
    title: group.title,
    cover_small: coverUrl,
    cover_medium: coverUrl,
    cover_big: coverUrl,
    cover_xl: coverUrl,
    release_date: date,
    record_type: mbRecordTypeToAppType(recordType),
    original_year: Number.isFinite(yearNum) ? yearNum : undefined,
    nb_tracks: tracks.length || undefined,
    artist: artistName
      ? { id: fallback.artistId ?? artistMbid ?? '', name: artistName }
      : undefined,
    tracks: { data: tracks },
  };
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

// ---------- Search (MB-only, source-of-truth for search results) ----------

export interface MbArtistSearchResult {
  mbid: string;
  name: string;
  disambiguation?: string;
  country?: string;
  type?: string;
  tags: string[];
}

export interface MbReleaseGroupSearchResult {
  mbid: string;
  title: string;
  year?: number;
  primaryType?: string;
  artistName?: string;
  artistMbid?: string;
}

export interface MbRecordingSearchResult {
  mbid: string;
  title: string;
  lengthMs?: number;
  artistName?: string;
  artistMbid?: string;
  releaseTitle?: string;
  releaseMbid?: string;
}

interface MbArtistSearchDetailed {
  artists?: Array<{
    id: string;
    name?: string;
    disambiguation?: string;
    country?: string;
    type?: string;
    tags?: Array<{ name: string; count?: number }>;
  }>;
}

interface MbReleaseGroupSearchResponse {
  'release-groups'?: Array<{
    id: string;
    title: string;
    'first-release-date'?: string;
    'primary-type'?: string;
    'artist-credit'?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
  }>;
}

interface MbRecordingSearchResponse {
  recordings?: Array<{
    id: string;
    title: string;
    length?: number;
    'artist-credit'?: Array<{ name?: string; artist?: { id?: string; name?: string } }>;
    releases?: Array<{ id: string; title: string }>;
  }>;
}

function artistCreditName(
  credit?: Array<{ name?: string; artist?: { name?: string } }>,
): string | undefined {
  if (!credit || credit.length === 0) return undefined;
  return credit.map((c) => c.name ?? c.artist?.name ?? '').filter(Boolean).join(', ') || undefined;
}

function artistCreditMbid(
  credit?: Array<{ artist?: { id?: string } }>,
): string | undefined {
  return credit?.[0]?.artist?.id ?? undefined;
}

export async function searchArtistsMB(query: string, limit = 12): Promise<MbArtistSearchResult[]> {
  const q = encodeURIComponent(`artist:${lucene(query)}`);
  const r = await mbFetch<MbArtistSearchDetailed>(`/artist/?query=${q}&limit=${limit}`);
  const artists = r?.artists ?? [];
  return artists
    .filter((a) => a.id && a.name)
    .map((a) => ({
      mbid: a.id,
      name: a.name as string,
      disambiguation: a.disambiguation || undefined,
      country: a.country || undefined,
      type: a.type || undefined,
      tags: (a.tags ?? [])
        .filter((t) => t?.name)
        .sort((x, y) => (y.count ?? 0) - (x.count ?? 0))
        .slice(0, 4)
        .map((t) => t.name.toLowerCase()),
    }));
}

export async function searchReleaseGroupsMB(
  query: string,
  limit = 12,
): Promise<MbReleaseGroupSearchResult[]> {
  // Restrict to primary types we actually surface as albums/EPs.
  const q = encodeURIComponent(`${lucene(query)} AND (primarytype:album OR primarytype:ep)`);
  const r = await mbFetch<MbReleaseGroupSearchResponse>(
    `/release-group/?query=${q}&limit=${limit}`,
  );
  const groups = r?.['release-groups'] ?? [];
  return groups
    .filter((g) => g.id && g.title)
    .map((g) => {
      const date = g['first-release-date'];
      const year = date ? parseInt(date.slice(0, 4), 10) : NaN;
      return {
        mbid: g.id,
        title: g.title,
        year: Number.isFinite(year) ? year : undefined,
        primaryType: g['primary-type'] || undefined,
        artistName: artistCreditName(g['artist-credit']),
        artistMbid: artistCreditMbid(g['artist-credit']),
      };
    });
}

export async function searchRecordingsMB(
  query: string,
  limit = 20,
): Promise<MbRecordingSearchResult[]> {
  const q = encodeURIComponent(lucene(query));
  const r = await mbFetch<MbRecordingSearchResponse>(`/recording/?query=${q}&limit=${limit}`);
  const recs = r?.recordings ?? [];
  return recs
    .filter((rec) => rec.id && rec.title)
    .map((rec) => ({
      mbid: rec.id,
      title: rec.title,
      lengthMs: typeof rec.length === 'number' ? rec.length : undefined,
      artistName: artistCreditName(rec['artist-credit']),
      artistMbid: artistCreditMbid(rec['artist-credit']),
      releaseTitle: rec.releases?.[0]?.title,
      releaseMbid: rec.releases?.[0]?.id,
    }));
}
