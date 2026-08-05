import { useEffect, useState } from 'react';
import { fetchArtistReleases, coverArtArchiveReleaseGroupUrl } from '@/lib/musicbrainz';

/** Module-level caches so grids don't re-probe the same artwork on every render. */
const probeCache = new Map<string, Promise<boolean>>();
const artistCoverCache = new Map<string, Promise<string | null>>();

/** Resolves once we know whether Cover Art Archive actually serves this image. */
function imageExists(url: string): Promise<boolean> {
  const cached = probeCache.get(url);
  if (cached) return cached;
  const p = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  probeCache.set(url, p);
  return p;
}

async function resolveArtistCover(artistMbid: string): Promise<string | null> {
  try {
    const releases = await fetchArtistReleases(artistMbid);
    const ranked = [...releases]
      .sort((a, b) => {
        const rank = (r: typeof a) => (r.record_type === 'album' ? 0 : r.record_type === 'ep' ? 1 : 2);
        return rank(a) - rank(b) || (a.year ?? 9999) - (b.year ?? 9999);
      })
      .slice(0, 8);
    for (const rg of ranked) {
      const url = coverArtArchiveReleaseGroupUrl(rg.mbid, 500);
      if (url && (await imageExists(url))) return url;
    }
  } catch {
    /* ignore — fall back to placeholder icon */
  }
  return null;
}


/**
 * MusicBrainz has no artist images, so we borrow the cover of the artist's
 * first release-group that Cover Art Archive actually has artwork for.
 */
export function useArtistCoverArt(artistMbid: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!artistMbid) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setUrl(null);
    let p = artistCoverCache.get(artistMbid);
    if (!p) {
      p = resolveArtistCover(artistMbid);
      artistCoverCache.set(artistMbid, p);
    }
    p.then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [artistMbid]);

  return url;
}

/** Cover Art Archive URL for a release (not a release-group). */
export function coverArtArchiveReleaseUrl(mbid: string | undefined, size: 250 | 500 = 500): string | null {
  if (!mbid) return null;
  return `https://coverartarchive.org/release/${mbid}/front-${size}`;
}
