import { useState, useEffect } from 'react';

const imageCache = new Map<string, string | null>();
const pendingRequests = new Map<string, Promise<string | null>>();
const contextCache = new Map<string, ArtistContext | null>();
const pendingContextRequests = new Map<string, Promise<ArtistContext | null>>();
const DEEZER_SEARCH_LIMIT = 5;
const MUSICBRAINZ_SEARCH_LIMIT = 5;
const JSONP_TIMEOUT_MS = 10000;
const MUSICBRAINZ_MIN_INTERVAL_MS = 1100;
const DEEZER_EMPTY_IMAGE_HASH = 'd41d8cd98f00b204e9800998ecf8427e';
const GENERIC_CONTEXT_TOKENS = new Set([
  'artist',
  'band',
  'group',
  'music',
  'musician',
  'singer',
  'songwriter',
  'solo',
  'duo',
  'trio',
  'quartet',
  'quintet',
  'male',
  'female',
  'mixed',
  'the',
  'and',
  'from',
  'with',
  'without',
  'present',
  'american',
  'british',
  'belgian',
  'french',
  'german',
  'japanese',
  'swedish',
  'norwegian',
  'dutch',
  'canadian',
  'australian',
  'us',
  'uk',
]);
let lastMusicBrainzRequestAt = 0;

interface ArtistImageHints {
  musicBrainzId?: string | null;
  genreHint?: string | string[] | null;
}

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
  strMusicBrainzID?: string;
  strGenre?: string;
  strStyle?: string;
}

interface AudioDbArtistSearchResponse {
  artists?: AudioDbArtist[] | null;
}

interface MusicBrainzTag {
  name: string;
}

interface MusicBrainzArtistSearchResult {
  id: string;
  name: string;
  score?: number | string;
  disambiguation?: string;
  tags?: MusicBrainzTag[];
}

interface MusicBrainzArtistSearchResponse {
  artists?: MusicBrainzArtistSearchResult[];
}

interface MusicBrainzUrlRelation {
  type?: string;
  url?: {
    resource?: string;
  };
}

interface MusicBrainzArtistDetails {
  id: string;
  disambiguation?: string;
  tags?: MusicBrainzTag[];
  relations?: MusicBrainzUrlRelation[];
}

interface ArtistContext {
  musicBrainzId?: string;
  genreTokens: string[];
  imageUrl?: string | null;
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

function buildHintSignature(hints?: ArtistImageHints) {
  const genreHints = Array.isArray(hints?.genreHint)
    ? hints?.genreHint
    : hints?.genreHint
      ? [hints.genreHint]
      : [];

  const normalizedHints = Array.from(
    new Set(
      genreHints
        .flatMap((hint) =>
          hint
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9]+/g),
        )
        .filter(Boolean),
    ),
  ).sort();

  return normalizedHints.join(',');
}

function buildCacheKey(artistName: string, hints?: ArtistImageHints) {
  const normalizedName = normalizeArtistKey(artistName);
  const normalizedMusicBrainzId = hints?.musicBrainzId?.trim().toLowerCase() ?? '';
  const hintSignature = buildHintSignature(hints);

  return [normalizedName, normalizedMusicBrainzId, hintSignature].filter(Boolean).join('::');
}

function extractContextTokens(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) =>
          (value ?? '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .split(/[^a-z0-9]+/g),
        )
        .filter((token) => token && !GENERIC_CONTEXT_TOKENS.has(token)),
    ),
  );
}

function getContextOverlapScore(text: string | undefined | null, genreTokens: string[]) {
  if (!text || !genreTokens.length) return 0;

  const candidateTokens = new Set(extractContextTokens([text]));
  return genreTokens.reduce((score, token) => score + (candidateTokens.has(token) ? 1 : 0), 0);
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

function getMusicBrainzArtistImageUrl(relations: MusicBrainzUrlRelation[] | undefined) {
  const resource = relations?.find((relation) => relation.type === 'image')?.url?.resource;
  if (!resource) return null;

  const commonsMatch = resource.match(/\/wiki\/File:(.+)$/);
  if (!commonsMatch) return resource;

  try {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(commonsMatch[1]))}`;
  } catch {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsMatch[1])}`;
  }
}

function pickMusicBrainzArtist(
  artists: MusicBrainzArtistSearchResult[] | undefined,
  cacheKey: string,
) {
  const bestMatch = (artists ?? [])
    .map((artist) => {
      const apiScore = Number(artist.score ?? 0);
      const nameScore = scoreCandidate(artist.name, cacheKey);

      return {
        artist,
        score: apiScore + nameScore * 20,
        nameScore,
      };
    })
    .sort((left, right) => right.score - left.score)[0];

  if (!bestMatch) return null;
  if (bestMatch.nameScore < 4 && Number(bestMatch.artist.score ?? 0) < 90) return null;

  return bestMatch.artist;
}

function pickArtistImage(artists: DeezerArtist[] | undefined, cacheKey: string): string | null {
  const exactMatchCount = (artists ?? []).filter(
    (artist) => normalizeArtistKey(artist.name) === cacheKey,
  ).length;

  if (exactMatchCount > 1) {
    return null;
  }

  const bestMatch = (artists ?? [])
    .map((artist) => ({
      score: scoreCandidate(artist.name, cacheKey),
      url: artist.picture_xl || artist.picture_big || artist.picture_medium || null,
    }))
    .filter((candidate) => hasUsableImage(candidate.url))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestMatch || bestMatch.score < 4) {
    return null;
  }

  return bestMatch.url;
}

function pickAudioDbImage(
  artists: AudioDbArtist[] | undefined,
  cacheKey: string,
  context: ArtistContext | null,
) {
  const exactMusicBrainzMatch = (artists ?? []).find(
    (artist) =>
      hasUsableImage(artist.strArtistThumb) &&
      Boolean(context?.musicBrainzId) &&
      artist.strMusicBrainzID === context?.musicBrainzId,
  );

  if (exactMusicBrainzMatch?.strArtistThumb) {
    return exactMusicBrainzMatch.strArtistThumb;
  }

  const bestMatch = (artists ?? [])
    .map((artist) => ({
      score:
        Math.max(
          scoreCandidate(artist.strArtist, cacheKey),
          scoreCandidate(artist.strArtistAlternate, cacheKey),
        ) * 10 +
        getContextOverlapScore(
          [artist.strGenre, artist.strStyle].filter(Boolean).join(' '),
          context?.genreTokens ?? [],
        ) *
          3 +
        (context?.musicBrainzId && artist.strMusicBrainzID === context.musicBrainzId ? 12 : 0),
      url: artist.strArtistThumb || null,
    }))
    .filter((candidate) => hasUsableImage(candidate.url))
    .sort((left, right) => right.score - left.score)[0];

  return bestMatch && bestMatch.score >= 20 ? bestMatch.url : null;
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

async function rateLimitedMusicBrainzFetch(url: string) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastMusicBrainzRequestAt;

  if (timeSinceLastRequest < MUSICBRAINZ_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MUSICBRAINZ_MIN_INTERVAL_MS - timeSinceLastRequest),
    );
  }

  lastMusicBrainzRequestAt = Date.now();

  // Funnels through the single global MusicBrainz queue (1 req/sec + retries).
  const res = await mbScheduledFetch(url);
  return res ?? new Response(null, { status: 503 });
}

async function fetchMusicBrainzArtistSearch(artistName: string) {
  const response = await rateLimitedMusicBrainzFetch(
    `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:${artistName}`)}&fmt=json&limit=${MUSICBRAINZ_SEARCH_LIMIT}`,
  );

  if (!response.ok) {
    throw new Error('MusicBrainz search failed');
  }

  return (await response.json()) as MusicBrainzArtistSearchResponse;
}

async function fetchMusicBrainzArtistDetails(musicBrainzId: string) {
  const response = await rateLimitedMusicBrainzFetch(
    `https://musicbrainz.org/ws/2/artist/${musicBrainzId}?inc=url-rels+tags&fmt=json`,
  );

  if (!response.ok) {
    throw new Error('MusicBrainz artist details failed');
  }

  return (await response.json()) as MusicBrainzArtistDetails;
}

async function resolveArtistContext(artistName: string, hints?: ArtistImageHints) {
  const contextKey = buildCacheKey(artistName, hints);

  if (contextCache.has(contextKey)) {
    return contextCache.get(contextKey)!;
  }

  if (pendingContextRequests.has(contextKey)) {
    return pendingContextRequests.get(contextKey)!;
  }

  const promise = (async () => {
    let musicBrainzId = hints?.musicBrainzId?.trim() || undefined;
    let imageUrl: string | null = null;
    let genreTokens = extractContextTokens([
      ...(Array.isArray(hints?.genreHint) ? hints?.genreHint : hints?.genreHint ? [hints.genreHint] : []),
    ]);

    try {
      if (!musicBrainzId) {
        const searchData = await fetchMusicBrainzArtistSearch(artistName);
        const bestArtist = pickMusicBrainzArtist(
          searchData.artists,
          normalizeArtistKey(artistName),
        );

        if (bestArtist) {
          musicBrainzId = bestArtist.id;
          genreTokens = Array.from(
            new Set([
              ...genreTokens,
              ...extractContextTokens([
                bestArtist.disambiguation,
                ...(bestArtist.tags ?? []).map((tag) => tag.name),
              ]),
            ]),
          );
        }
      }

      if (musicBrainzId) {
        const details = await fetchMusicBrainzArtistDetails(musicBrainzId);
        imageUrl = getMusicBrainzArtistImageUrl(details.relations);
        genreTokens = Array.from(
          new Set([
            ...genreTokens,
            ...extractContextTokens([
              details.disambiguation,
              ...(details.tags ?? []).map((tag) => tag.name),
            ]),
          ]),
        );
      }
    } catch {
      // Ignore context failures and continue with downstream providers.
    }

    const context: ArtistContext = {
      musicBrainzId,
      genreTokens,
      imageUrl,
    };

    contextCache.set(contextKey, context);
    return context;
  })();

  pendingContextRequests.set(contextKey, promise);
  const result = await promise;
  pendingContextRequests.delete(contextKey);
  return result;
}

async function fetchFromAudioDb(
  artistName: string,
  cacheKey: string,
  context: ArtistContext | null,
) {
  const response = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`);
  if (!response.ok) return null;

  const data: AudioDbArtistSearchResponse = await response.json();
  return pickAudioDbImage(data.artists ?? undefined, cacheKey, context);
}

async function fetchArtistImage(
  artistName: string,
  hints?: ArtistImageHints,
): Promise<string | null> {
  const cacheKey = buildCacheKey(artistName, hints);
  const normalizedArtistKey = normalizeArtistKey(artistName);

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    try {
      const artistContext = await resolveArtistContext(artistName, hints);

      if (hasUsableImage(artistContext?.imageUrl)) {
        imageCache.set(cacheKey, artistContext?.imageUrl ?? null);
        return artistContext?.imageUrl ?? null;
      }

      const audioDbImage = await fetchFromAudioDb(
        artistName,
        normalizedArtistKey,
        artistContext,
      );
      if (audioDbImage) {
        imageCache.set(cacheKey, audioDbImage);
        return audioDbImage;
      }
    } catch {
      // Fall through to Deezer fallback.
    }

    try {
      const deezerData = await fetchArtistSearchJsonp(artistName);
      const deezerImage = pickArtistImage(deezerData.data, normalizedArtistKey);
      imageCache.set(cacheKey, deezerImage);
      return deezerImage;
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

export function useArtistImage(
  artistName: string | undefined | null,
  hints?: ArtistImageHints,
) {
  const normalizedKey = artistName ? buildCacheKey(artistName, hints) : '';
  const genreHintKey = Array.isArray(hints?.genreHint)
    ? hints.genreHint.join('|')
    : hints?.genreHint ?? '';

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

    fetchArtistImage(artistName, hints).then((url) => {
      if (!isMounted) return;
      setImageUrl(url);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [artistName, normalizedKey, hints?.musicBrainzId, genreHintKey]);

  return { imageUrl, isLoading };
}
