/**
 * Deezer *cover-lookup only* helper.
 *
 * The rest of the search pipeline is MusicBrainz-driven. Deezer is used
 * strictly to find an artwork URL (and the corresponding Deezer numeric
 * ID used by internal routing to /artist/:id and /album/:id, since the
 * downstream artist/album pages still key on Deezer IDs).
 *
 * We NEVER read Deezer's metadata fields (release_date, record_type,
 * nb_album, nb_fan, titles, etc.) from here. Only the cover image URL
 * and the id are exposed.
 */
import { pickArtistImage, pickAlbumCover, searchArtists, searchAlbums } from './deezer';
import { normalizeAlbumTitle } from './discography';

export interface CoverRef {
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
    const results = await searchArtists(name, 5);
    const hit =
      results.find((r) => norm(r.name) === key) ??
      results[0] ??
      null;
    const ref: CoverRef | null = hit
      ? { deezerId: String(hit.id), coverUrl: pickArtistImage(hit) }
      : null;
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
  const query = artist ? `${title} ${artist}` : title;
  try {
    const results = await searchAlbums(query, 10);
    // Prefer entries whose normalized (variant-stripped) title matches AND
    // whose artist matches. Do not accept an artist-only match: it can attach
    // a wrong Deezer album id and create broken album pages.
    const hit =
      results.find(
        (r) =>
          normalizeAlbumTitle(r.title) === targetTitle &&
          (!targetArtist || norm(r.artist?.name ?? '') === targetArtist),
      ) ??
      results.find((r) => normalizeAlbumTitle(r.title) === targetTitle) ??
      null;
    const ref: CoverRef | null = hit
      ? { deezerId: String(hit.id), coverUrl: pickAlbumCover(hit) }
      : null;
    albumCache.set(key, ref);
    return ref;
  } catch {
    albumCache.set(key, null);
    return null;
  }
}
