import { useState, useEffect } from 'react';

// In-memory cache shared across all components
const imageCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();

async function fetchArtistImage(artistName: string): Promise<string | null> {
  const cacheKey = artistName.toLowerCase().trim();
  
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      // Try Deezer API first (no auth needed, reliable artist images)
      const res = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5&output=jsonp`
      );
      
      // Deezer might have CORS issues, try with corsproxy
      if (!res.ok) throw new Error('Direct failed');
      
      const data = await res.json();
      const match = data?.data?.find((a: any) => 
        a.name.toLowerCase() === cacheKey ||
        a.name.toLowerCase().includes(cacheKey) ||
        cacheKey.includes(a.name.toLowerCase())
      ) || data?.data?.[0];

      if (match?.picture_xl || match?.picture_big || match?.picture_medium) {
        const url = match.picture_xl || match.picture_big || match.picture_medium;
        imageCache.set(cacheKey, url);
        return url;
      }
      
      imageCache.set(cacheKey, null);
      return null;
    } catch {
      // Fallback: try via corsproxy
      try {
        const proxyRes = await fetch(
          `https://corsproxy.io/?${encodeURIComponent(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`)}`
        );
        if (!proxyRes.ok) throw new Error('Proxy failed');
        
        const data = await proxyRes.json();
        const match = data?.data?.find((a: any) =>
          a.name.toLowerCase() === cacheKey ||
          a.name.toLowerCase().includes(cacheKey) ||
          cacheKey.includes(a.name.toLowerCase())
        ) || data?.data?.[0];

        if (match?.picture_xl || match?.picture_big || match?.picture_medium) {
          const url = match.picture_xl || match.picture_big || match.picture_medium;
          imageCache.set(cacheKey, url);
          return url;
        }
        
        imageCache.set(cacheKey, null);
        return null;
      } catch {
        imageCache.set(cacheKey, null);
        return null;
      }
    }
  })();

  pendingRequests.set(cacheKey, promise);
  const result = await promise;
  pendingRequests.delete(cacheKey);
  return result;
}

export function useArtistImage(artistName: string | undefined | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    if (!artistName) return null;
    return imageCache.get(artistName.toLowerCase().trim()) ?? null;
  });
  const [isLoading, setIsLoading] = useState(!imageCache.has(artistName?.toLowerCase().trim() ?? ''));

  useEffect(() => {
    if (!artistName) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    const key = artistName.toLowerCase().trim();
    if (imageCache.has(key)) {
      setImageUrl(imageCache.get(key)!);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchArtistImage(artistName).then(url => {
      setImageUrl(url);
      setIsLoading(false);
    });
  }, [artistName]);

  return { imageUrl, isLoading };
}
