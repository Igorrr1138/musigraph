/**
 * Genre Discovery — fast, progressive data pipeline for /genre/:slug.
 *
 * Design contract (performance first):
 *   1. Last.fm `tag.gettopartists` / `tag.gettopalbums` gives us NAMES only.
 *      That single request resolves in ~200ms and is enough to paint the grid.
 *   2. MusicBrainz IDs + Cover Art Archive artwork are resolved lazily, in
 *      the background, at a bounded concurrency of 4 so we never fan out
 *      30-50 simultaneous requests (which triggers HTTP 429 + a frozen UI).
 *   3. Every resolution is persisted to `music_cache` and read back with a
 *      SINGLE bulk `.in()` query on the next visit → sub-50ms repeat loads.
 *
 * Last.fm's own image URLs are ignored entirely: they now always point at the
 * grey star placeholder (`2a96cbd8b46e442fc41c2b86b821562f.png`).
 */

import { supabase } from '@/integrations/supabase/client';
import {
  searchArtistsMB,
  searchReleaseGroupsMB,
  fetchArtistReleaseGroupsPage,
  coverArtArchiveReleaseGroupUrl,
} from './musicbrainz';
import { genreFromSlug, type WhitelistedGenre } from './genreWhitelist';

const LASTFM_API_KEY = '3786d2446250a6394a81de4d0855df60';
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const CACHE_SOURCE = 'genre-discovery';
const CONCURRENCY = 4;

export type SortMode = 'top' | 'newest' | 'oldest';

export interface DiscoveryFilters {
  country?: string | null;
  decade?: number | null;
  sort?: SortMode;
  limit?: number;
  page?: number;
}

/** A grid item as soon as Last.fm answers — renderable immediately. */
export interface GenreEntry {
  /** Stable cache/react key. */
  key: string;
  kind: 'artist' | 'album';
  /** Artist name, or album title for album entries. */
  name: string;
  /** Album entries only: the credited artist. */
  artistName?: string;
  tag: string;
}

/** Everything we learn about an entry once background resolution completes. */
export interface ResolvedEntry {
  mbid: string | null;
  imageUrl: string | null;
  artistMbid?: string | null;
  year?: number | null;
}

/* ------------------------------------------------------------------ */
/* Last.fm — names only                                                */
/* ------------------------------------------------------------------ */

function slugKeyPart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function lastfm<T>(params: Record<string, string>): Promise<T | null> {
  try {
    const qs = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: 'json' });
    const res = await fetch(`${LASTFM_BASE}?${qs.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[genreDiscovery] Last.fm request failed:', err);
    return null;
  }
}

function genreOrNull(slug: string): WhitelistedGenre | null {
  return genreFromSlug(slug) ?? null;
}

export async function getGenreArtistEntries(
  slug: string,
  { limit = 24, page = 1 }: { limit?: number; page?: number } = {},
): Promise<GenreEntry[]> {
  const genre = genreOrNull(slug);
  if (!genre) return [];
  const json = await lastfm<{ topartists?: { artist?: Array<{ name?: string }> | { name?: string } } }>({
    method: 'tag.gettopartists',
    tag: genre.key,
    limit: String(Math.min(Math.max(limit, 1), 100)),
    page: String(Math.max(page, 1)),
  });
  const raw = json?.topartists?.artist;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .map(a => (a?.name ?? '').trim())
    .filter(Boolean)
    .slice(0, limit)
    .map(name => ({
      key: `gc:artist:${slugKeyPart(name)}`,
      kind: 'artist' as const,
      name,
      tag: genre.key,
    }));
}

export async function getGenreAlbumEntries(
  slug: string,
  { limit = 24, page = 1 }: { limit?: number; page?: number } = {},
): Promise<GenreEntry[]> {
  const genre = genreOrNull(slug);
  if (!genre) return [];
  type LfAlbum = { name?: string; artist?: { name?: string; '#text'?: string } | string };
  const json = await lastfm<{ albums?: { album?: LfAlbum[] | LfAlbum } }>({
    method: 'tag.gettopalbums',
    tag: genre.key,
    limit: String(Math.min(Math.max(limit, 1), 50)),
    page: String(Math.max(page, 1)),
  });
  const raw = json?.albums?.album;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .map(entry => {
      const title = entry?.name?.trim();
      if (!title) return null;
      const artistName =
        (typeof entry.artist === 'string'
          ? entry.artist
          : entry.artist?.name ?? entry.artist?.['#text'] ?? ''
        ).trim() || undefined;
      return {
        key: `gc:album:${slugKeyPart(artistName ?? '')}|${slugKeyPart(title)}`,
        kind: 'album' as const,
        name: title,
        artistName,
        tag: genre.key,
      } satisfies GenreEntry;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Cache-first, throttled resolution                                   */
/* ------------------------------------------------------------------ */

/** In-memory memo so re-mounts and pagination never re-resolve an entry. */
const memo = new Map<string, ResolvedEntry>();

interface CacheRowData {
  mbid?: string | null;
  image_url?: string | null;
  artist_mbid?: string | null;
  year?: number | null;
}

/** SINGLE bulk read of everything we already know about these entries. */
async function readCache(keys: string[]): Promise<Map<string, ResolvedEntry>> {
  const out = new Map<string, ResolvedEntry>();
  if (keys.length === 0) return out;
  try {
    const { data, error } = await supabase
      .from('music_cache')
      .select('artist_deezer_id, mbid, data')
      .in('artist_deezer_id', keys);
    if (error) return out;
    for (const row of data ?? []) {
      const d = (row.data ?? {}) as CacheRowData;
      out.set(row.artist_deezer_id, {
        mbid: row.mbid ?? d.mbid ?? null,
        imageUrl: d.image_url ?? null,
        artistMbid: d.artist_mbid ?? null,
        year: d.year ?? null,
      });
    }
  } catch {
    /* cache is an optimisation — never fatal */
  }
  return out;
}

/** Fire-and-forget persistence so the next visit is a pure cache hit. */
function writeCache(rows: Array<{ key: string; resolved: ResolvedEntry }>): void {
  if (rows.length === 0) return;
  void supabase
    .from('music_cache')
    .upsert(
      rows.map(({ key, resolved }) => ({
        artist_deezer_id: key,
        mbid: resolved.mbid,
        source: CACHE_SOURCE,
        data: {
          mbid: resolved.mbid,
          image_url: resolved.imageUrl,
          artist_mbid: resolved.artistMbid ?? null,
          year: resolved.year ?? null,
        },
      })),
      { onConflict: 'artist_deezer_id' },
    )
    .then(({ error }) => {
      if (error) console.warn('[genreDiscovery] cache upsert skipped:', error.message);
    });
}

async function resolveArtist(name: string): Promise<ResolvedEntry> {
  // ONE request buys us both the artist MBID (via artist-credit) and a cover
  // (MusicBrainz stores no artist images, so we borrow release-group art).
  const groups = await searchReleaseGroupsMB(`artist:"${name}"`, 3);
  const match =
    groups.find(g => (g.artistName ?? '').toLowerCase() === name.toLowerCase() && g.artistMbid) ??
    groups.find(g => g.artistMbid) ??
    null;
  if (match?.artistMbid) {
    return {
      mbid: match.artistMbid,
      imageUrl: coverArtArchiveReleaseGroupUrl(match.mbid, 500),
      artistMbid: match.artistMbid,
    };
  }
  const hits = await searchArtistsMB(name, 1);
  const artist = hits[0];
  if (!artist) return { mbid: null, imageUrl: null };
  return { mbid: artist.mbid, imageUrl: null, artistMbid: artist.mbid };
}

async function resolveAlbum(title: string, artistName?: string): Promise<ResolvedEntry> {
  const query = artistName ? `${artistName} ${title}` : title;
  const hits = await searchReleaseGroupsMB(query, 1);
  const rg = hits[0];
  if (!rg) return { mbid: null, imageUrl: null };
  return {
    mbid: rg.mbid,
    imageUrl: coverArtArchiveReleaseGroupUrl(rg.mbid, 500),
    artistMbid: rg.artistMbid ?? null,
    year: rg.year ?? null,
  };
}

/**
 * Resolve a batch of entries progressively.
 *
 * Cache hits are emitted in one shot before any network work starts; misses
 * are processed in chunks of 4 and streamed back through `onResolved` as they
 * land, so the grid fills in without ever blocking.
 */
export async function resolveGenreEntries(
  entries: ReadonlyArray<GenreEntry>,
  onResolved: (key: string, resolved: ResolvedEntry) => void,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  const pending: GenreEntry[] = [];

  // 0. In-memory memo.
  const needsLookup: GenreEntry[] = [];
  for (const e of entries) {
    const hit = memo.get(e.key);
    if (hit) onResolved(e.key, hit);
    else needsLookup.push(e);
  }
  if (needsLookup.length === 0 || isCancelled()) return;

  // 1. One bulk Supabase read for everything else.
  const cached = await readCache(needsLookup.map(e => e.key));
  if (isCancelled()) return;
  for (const e of needsLookup) {
    const hit = cached.get(e.key);
    if (hit && (hit.mbid || hit.imageUrl)) {
      memo.set(e.key, hit);
      onResolved(e.key, hit);
    } else {
      pending.push(e);
    }
  }

  // 2. Throttled network resolution, 4 at a time.
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    if (isCancelled()) return;
    const chunk = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async entry => {
        try {
          const resolved =
            entry.kind === 'artist'
              ? await resolveArtist(entry.name)
              : await resolveAlbum(entry.name, entry.artistName);
          return { key: entry.key, resolved };
        } catch {
          return { key: entry.key, resolved: { mbid: null, imageUrl: null } as ResolvedEntry };
        }
      }),
    );
    for (const { key, resolved } of results) {
      memo.set(key, resolved);
      if (!isCancelled()) onResolved(key, resolved);
    }
    writeCache(results.filter(r => r.resolved.mbid));
  }
}
