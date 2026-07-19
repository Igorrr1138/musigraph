/**
 * Cover-lookup helper — MusicBrainz + Cover Art Archive only.
 *
 * Filename kept for import compatibility during the Deezer removal. The
 * `deezerId` field on `CoverRef` now carries a MusicBrainz MBID.
 */
import {
  searchArtistsMB,
  searchReleaseGroupsMB,
  coverArtArchiveReleaseGroupUrl,
} from './musicbrainz';
import { normalizeAlbumTitle } from './discography';

export interface CoverRef {
  /** Retained field name for compatibility — holds a MusicBrainz MBID. */
  deezerId: string;
  coverUrl: string | null;
}

const artistCache = new Map<string, CoverRef | null>();
const albumCache = new Map<string, CoverRef | null>();

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function lookupArtistCover(name: string): Promise<CoverRef | null> {
  const key = norm(name);
  if (!key) return null;
  if (artistCache.has(key)) return artistCache.get(key) ?? null;

  try {
    const results = await searchArtistsMB(name, 5);
    const hit = results.find((r) => norm(r.name) === key) ?? results[0] ?? null;
    // MusicBrainz has no artist images — coverUrl is always null here.
    const ref: CoverRef | null = hit ? { deezerId: hit.mbid, coverUrl: null } : null;
    artistCache.set(key, ref);
    return ref;
  } catch {
    artistCache.set(key, null);
    return null;
  }
}

export async function lookupAlbumCover(
  title: string,
  artist?: string,
): Promise<CoverRef | null> {
  const key = `${norm(title)}::${norm(artist ?? '')}`;
  if (!key) return null;
  if (albumCache.has(key)) return albumCache.get(key) ?? null;

  const targetTitle = normalizeAlbumTitle(title);
  const targetArtist = norm(artist ?? '');
  const query = artist ? `${title} AND artist:${artist}` : title;

  try {
    const results = await searchReleaseGroupsMB(query, 10);
    const hit =
      results.find(
        (r) =>
          normalizeAlbumTitle(r.title) === targetTitle &&
          (!targetArtist || norm(r.artistName ?? '') === targetArtist),
      ) ??
      results.find((r) => normalizeAlbumTitle(r.title) === targetTitle) ??
      null;
    const ref: CoverRef | null = hit
      ? { deezerId: hit.mbid, coverUrl: coverArtArchiveReleaseGroupUrl(hit.mbid, 500) }
      : null;
    albumCache.set(key, ref);
    return ref;
  } catch {
    albumCache.set(key, null);
    return null;
  }
}
