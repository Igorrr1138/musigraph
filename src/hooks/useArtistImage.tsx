import { useState, useEffect } from 'react';

// In-memory cache shared across all components
const imageCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();
const DEEZER_SEARCH_LIMIT = 5;
const JSONP_TIMEOUT_MS = 10000;

interface DeezerArtist {
  name: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
}

interface DeezerArtistSearchResponse {
  data?: DeezerArtist[];
}

function pickArtistImage(artists: DeezerArtist[] | undefined, cacheKey: string): string | null {
  const normalizedArtists = artists ?? [];
  const match = normalizedArtists.find((artist) => {
    const normalizedName = artist.name.toLowerCase();
    return (
      normalizedName === cacheKey ||
      normalizedName.includes(cacheKey) ||
      cacheKey.includes(normalizedName)
    );
  }) ?? normalizedArtists[0];

  return match?.picture_xl || match?.picture_big || match?.picture_medium || null;
}

function fetchArtistSearchJsonp(artistName: string): Promise<DeezerArtistSearchResponse> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return Promise.reject(new Error('JSONP artist search requires a browser environment'));
  }

  return new Promise((resolve, reject) => {
    const callbackName = `deezerArtistSearch_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const deezerWindow = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete deezerWindow[callbackName];
      script.remove();
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Artist image request timed out'));
    }, JSONP_TIMEOUT_MS);

    deezerWindow[callbackName] = (data: DeezerArtistSearchResponse) => {
      cleanup();
      resolve(data);
    };

    script.src = `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=${DEEZER_SEARCH_LIMIT}&output=jsonp&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      reject(new Error('Artist image request failed'));
    };

    document.body.appendChild(script);
  });
}

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
      const data = await fetchArtistSearchJsonp(artistName);
      const url = pickArtistImage(data.data, cacheKey);
      imageCache.set(cacheKey, url);
      return url;
    } catch {
      imageCache.set(cacheKey, null);
      return null;
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
    let isMounted = true;

    fetchArtistImage(artistName).then(url => {
      if (!isMounted) return;
      setImageUrl(url);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [artistName]);

  return { imageUrl, isLoading };
}
