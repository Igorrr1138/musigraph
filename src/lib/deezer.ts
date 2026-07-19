/**
 * Music data facade — MusicBrainz + Cover Art Archive only.
 *
 * The filename is retained for import compatibility during the Deezer
 * removal; every call in here now hits musicbrainz.org / coverartarchive.org.
 * All entity IDs are MusicBrainz MBIDs (UUID strings). No deezer.com traffic.
 *
 * (This file will be renamed in a follow-up pass; keeping the exported
 * names/types stable lets the rest of the app compile unchanged.)
 */

import {
  searchArtistsMB,
  searchReleaseGroupsMB,
  searchRecordingsMB,
  fetchArtistReleases,
  fetchReleaseGroupAlbum,
  coverArtArchiveReleaseGroupUrl,
} from './musicbrainz';

// ---------- Types (shape preserved for downstream compatibility) ----------

export interface DeezerArtist {
  id: number | string;
  name: string;
  picture_small?: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
  nb_album?: number;
  nb_fan?: number;
  type?: string;
}

export interface DeezerAlbum {
  id: number | string;
  mbid?: string | null;
  title: string;
  cover_small?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  release_date?: string;
  record_type?: string;
  original_year?: number;
  is_deluxe?: boolean;
  is_explicit?: boolean;
  nb_tracks?: number;
  artist?: DeezerArtist;
  tracks?: { data: DeezerTrack[] };
  genres?: { data: Array<{ id: number; name: string }> };
}

export interface DeezerTrack {
  id: number | string;
  title: string;
  title_short?: string;
  duration: number;
  track_position?: number;
  disk_number?: number;
  preview?: string;
  isrc?: string;
  artist?: DeezerArtist;
  album?: { id: number | string; title: string; cover_xl?: string };
}

// ---------- Image helpers ----------

export function isUsableImage(url: string | undefined | null): boolean {
  return Boolean(url);
}

/** MusicBrainz exposes no artist images — always null. */
export function pickArtistImage(_artist: DeezerArtist | undefined | null): string | null {
  return null;
}

export function pickAlbumCover(album: { cover_xl?: string; cover_big?: string; cover_medium?: string; cover_small?: string } | undefined | null): string | null {
  if (!album) return null;
  return album.cover_xl ?? album.cover_big ?? album.cover_medium ?? album.cover_small ?? null;
}

// ---------- Search (delegates to MusicBrainz) ----------

export async function searchArtists(query: string, limit = 12): Promise<DeezerArtist[]> {
  try {
    const results = await searchArtistsMB(query, limit);
    return results.map((a) => ({ id: a.mbid, name: a.name, type: 'artist' }));
  } catch (err) {
    console.error('[music] searchArtists failed:', err);
    return [];
  }
}

export async function searchAlbums(query: string, limit = 12): Promise<DeezerAlbum[]> {
  try {
    const results = await searchReleaseGroupsMB(query, limit);
    return results.map((g) => {
      const cover = coverArtArchiveReleaseGroupUrl(g.mbid, 500);
      return {
        id: g.mbid,
        mbid: g.mbid,
        title: g.title,
        cover_small: cover,
        cover_medium: cover,
        cover_big: cover,
        cover_xl: cover,
        release_date: g.year ? String(g.year) : undefined,
        original_year: g.year,
        record_type: (g.primaryType ?? 'album').toLowerCase(),
        artist: g.artistName
          ? { id: g.artistMbid ?? '', name: g.artistName }
          : undefined,
      };
    });
  } catch (err) {
    console.error('[music] searchAlbums failed:', err);
    return [];
  }
}

export async function searchTracks(query: string, limit = 12): Promise<DeezerTrack[]> {
  try {
    const results = await searchRecordingsMB(query, limit);
    return results.map((r) => ({
      id: r.mbid,
      title: r.title,
      duration: r.lengthMs ? Math.round(r.lengthMs / 1000) : 0,
      artist: r.artistName ? { id: r.artistMbid ?? '', name: r.artistName } : undefined,
      album: r.releaseMbid
        ? {
            id: r.releaseMbid,
            title: r.releaseTitle ?? '',
            cover_xl: coverArtArchiveReleaseGroupUrl(r.releaseMbid, 500),
          }
        : undefined,
    }));
  } catch (err) {
    console.error('[music] searchTracks failed:', err);
    return [];
  }
}

// ---------- Entity getters (MusicBrainz-backed) ----------

export async function getArtist(mbid: string): Promise<DeezerArtist | null> {
  try {
    const r = await fetch(
      `https://musicbrainz.org/ws/2/artist/${mbid}?fmt=json`,
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string; name?: string };
    if (!j?.id || !j.name) return null;
    return { id: j.id, name: j.name, type: 'artist' };
  } catch (err) {
    console.error('[music] getArtist failed:', err);
    return null;
  }
}

/**
 * MusicBrainz has no popularity signal. Returns a sample of recordings by
 * the artist as a stand-in for "top tracks".
 */
export async function getArtistTopTracks(mbid: string, limit = 10): Promise<DeezerTrack[]> {
  try {
    const results = await searchRecordingsMB(`arid:${mbid}`, limit);
    return results.map((r) => ({
      id: r.mbid,
      title: r.title,
      duration: r.lengthMs ? Math.round(r.lengthMs / 1000) : 0,
      artist: r.artistName ? { id: r.artistMbid ?? mbid, name: r.artistName } : undefined,
      album: r.releaseMbid
        ? {
            id: r.releaseMbid,
            title: r.releaseTitle ?? '',
            cover_xl: coverArtArchiveReleaseGroupUrl(r.releaseMbid, 500),
          }
        : undefined,
    }));
  } catch (err) {
    console.error('[music] getArtistTopTracks failed:', err);
    return [];
  }
}

/**
 * "Related artists" via MB artist-artist relations (associated acts, band
 * members, etc.). Sparse compared to the previous curated list, but stays
 * within MusicBrainz.
 */
export async function getRelatedArtists(mbid: string, limit = 8): Promise<DeezerArtist[]> {
  try {
    const r = await fetch(
      `https://musicbrainz.org/ws/2/artist/${mbid}?inc=artist-rels&fmt=json`,
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) return [];
    const j = (await r.json()) as {
      relations?: Array<{ artist?: { id?: string; name?: string } }>;
    };
    const seen = new Set<string>();
    const out: DeezerArtist[] = [];
    for (const rel of j.relations ?? []) {
      const id = rel.artist?.id;
      const name = rel.artist?.name;
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name, type: 'artist' });
      if (out.length >= limit) break;
    }
    return out;
  } catch (err) {
    console.error('[music] getRelatedArtists failed:', err);
    return [];
  }
}

export async function getArtistAlbums(mbid: string, limit = 200): Promise<DeezerAlbum[]> {
  try {
    const releases = await fetchArtistReleases(mbid);
    return releases.slice(0, limit).map((rel) => {
      const cover = coverArtArchiveReleaseGroupUrl(rel.mbid, 500);
      return {
        id: rel.mbid,
        mbid: rel.mbid,
        title: rel.title,
        cover_small: cover,
        cover_medium: cover,
        cover_big: cover,
        cover_xl: cover,
        release_date: rel.date,
        original_year: rel.year,
        record_type: rel.record_type === 'compilation' ? 'compile' : rel.record_type,
      };
    });
  } catch (err) {
    console.error('[music] getArtistAlbums failed:', err);
    return [];
  }
}

export async function getAlbum(mbid: string): Promise<DeezerAlbum | null> {
  try {
    return await fetchReleaseGroupAlbum(mbid);
  } catch (err) {
    console.error('[music] getAlbum failed:', err);
    return null;
  }
}

// ---------- Utilities ----------

export function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function deezerRecordCategory(recordType?: string): 'Album' | 'EP' | 'Single' | 'Compilation' | 'Other' {
  switch ((recordType ?? '').toLowerCase()) {
    case 'album': return 'Album';
    case 'ep': return 'EP';
    case 'single': return 'Single';
    case 'compile':
    case 'compilation': return 'Compilation';
    default: return 'Other';
  }
}
