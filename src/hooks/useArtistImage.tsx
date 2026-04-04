import { useState, useEffect } from 'react';

const imageCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();
const DEEZER_SEARCH_LIMIT = 5;
const JSONP_TIMEOUT_MS = 10000;
const DEEZER_EMPTY_IMAGE_HASH = 'd41d8cd98f00b204e9800998ecf8427e';

interface DeezerArtist {
  name: string;
  picture_medium?: string;
  picture_big?: string;
  picture_xl?: string;
}

interface DeezerArtistSearchResponse {
  data?: DeezerArtist[];
}

interface AudioDbArtist {
  strArtist?: string;
  strArtistAlternate?: string;
  strArtistThumb?: string;
}

interface AudioDbArtistSearchResponse {
  artists?: AudioDbArtist[] | null;
}

function normalizeArtistKey(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getEditDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const distances = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let previousDiagonal = distances[0];
    distances[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const current = distances[j];
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      distances[j] = Math.min(
        distances[j] + 1,
        distances[j - 1] + 1,
        previousDiagonal + substitutionCost,
      );
      previousDiagonal = current;
    }
  }

  return distances[right.length];
}

function hasUsableImage(url: string | undefined | null) {
  return Boolean(url && !url.includes(DEEZER_EMPTY_IMAGE_HASH));
}

function scoreCandidate(candidateName: string | undefined, cacheKey: string) {
  if (!candidateName) return 0;

  const normalizedCandidate = normalizeArtistKey(candidateName);
  if (!normalizedCandidate) return 0;
  if (normalizedCandidate === cacheKey) return 5;
  if (normalizedCandidate.includes(cacheKey) || cacheKey.includes(normalizedCandidate)) return 4;
  if (getEditDistance(normalizedCandidate, cacheKey) <= 1) return 3;

  return 0;
}

function pickArtistImage(artists: DeezerArtist[] | undefined, cacheKey: string): string | null {
  const bestMatch = (artists ?? [])
    .map((artist) => ({
      score: scoreCandidate(artist.name, cacheKey),
      url: artist.picture_xl || artist.picture_big || artist.picture_medium || null,
    }))
    .filter((candidate) => hasUsableImage(candidate.url))
    .sort((left, right) => right.score - left.score)[0];

  return bestMatch?.url || null;
}

function pickAudioDbImage(artists: AudioDbArtist[] | undefined, cacheKey: string) {
  const bestMatch = (artists ?? [])
    .map((artist) => ({
      score: Math.max(
        scoreCandidate(artist.strArtist, cacheKey),
        scoreCandidate(artist.strArtistAlternate, cacheKey),
      ),
      url: artist.strArtistThumb || null,
    }))
    .filter((candidate) => hasUsableImage(candidate.url))
    .sort((left, right) => right.score - left.score)[0];

  return bestMatch?.url || null;
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

async function fetchFromAudioDb(artistName: string, cacheKey: string) {
  const response = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`);
  if (!response.ok) return null;

  const data: AudioDbArtistSearchResponse = await response.json();
  return pickAudioDbImage(data.artists ?? undefined, cacheKey);
}

async function fetchArtistImage(artistName: string): Promise<string | null> {
  const cacheKey = normalizeArtistKey(artistName);

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const deezerData = await fetchArtistSearchJsonp(artistName);
      const deezerImage = pickArtistImage(deezerData.data, cacheKey);
      if (deezerImage) {
        imageCache.set(cacheKey, deezerImage);
        return deezerImage;
      }
    } catch {
      // Fall through to TheAudioDB fallback.
    }

    try {
      const audioDbImage = await fetchFromAudioDb(artistName, cacheKey);
      imageCache.set(cacheKey, audioDbImage);
      return audioDbImage;
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
  const normalizedKey = artistName ? normalizeArtistKey(artistName) : '';
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    if (!normalizedKey) return null;
    return imageCache.get(normalizedKey) ?? null;
  });
  const [isLoading, setIsLoading] = useState(Boolean(normalizedKey && !imageCache.has(normalizedKey)));

  useEffect(() => {
    if (!artistName || !normalizedKey) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    if (imageCache.has(normalizedKey)) {
      setImageUrl(imageCache.get(normalizedKey)!);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let isMounted = true;

    fetchArtistImage(artistName).then((url) => {
      if (!isMounted) return;
      setImageUrl(url);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [artistName, normalizedKey]);

  return { imageUrl, isLoading };
}
