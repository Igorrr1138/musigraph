const lyricsCache = new Map<string, string | null>();
const lyricsRequests = new Map<string, Promise<string | null>>();

function buildLyricsKey(artistName: string, trackTitle: string) {
  return `${artistName}::${trackTitle}`.toLowerCase().trim();
}

export async function fetchLyrics(artistName: string, trackTitle: string) {
  const cacheKey = buildLyricsKey(artistName, trackTitle);
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey) ?? null;
  }

  if (lyricsRequests.has(cacheKey)) {
    return lyricsRequests.get(cacheKey) ?? null;
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackTitle)}`,
      );

      if (!response.ok) {
        lyricsCache.set(cacheKey, null);
        return null;
      }

      const data = (await response.json()) as { lyrics?: string };
      const lyrics = typeof data.lyrics === "string" && data.lyrics.trim() ? data.lyrics.trim() : null;
      lyricsCache.set(cacheKey, lyrics);
      return lyrics;
    } catch {
      lyricsCache.set(cacheKey, null);
      return null;
    } finally {
      lyricsRequests.delete(cacheKey);
    }
  })();

  lyricsRequests.set(cacheKey, request);
  return request;
}
