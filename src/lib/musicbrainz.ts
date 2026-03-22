// MusicBrainz API utilities
const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE_URL = 'https://coverartarchive.org';
const USER_AGENT = 'MusicCatalogApp/1.0.0 (contact@example.com)';

// Rate limiting - MusicBrainz allows 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  
  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    },
  });
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
  'life-span'?: {
    begin?: string;
    end?: string;
    ended?: boolean;
  };
  type?: string;
  score?: number;
  tags?: Array<{ count: number; name: string }>;
}

export interface MusicBrainzRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  'release-group'?: {
    id: string;
    'primary-type'?: string;
  };
  'track-count'?: number;
  'artist-credit'?: Array<{
    artist: MusicBrainzArtist;
  }>;
  media?: Array<{
    tracks?: Array<{
      id: string;
      title: string;
      position: number;
      length?: number;
    }>;
  }>;
}

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string;
  'first-release-date'?: string;
  'artist-credit'?: Array<{
    artist: MusicBrainzArtist;
  }>;
}

export interface SearchResult<T> {
  created: string;
  count: number;
  offset: number;
  artists?: T[];
  releases?: T[];
  'release-groups'?: T[];
}

export async function searchArtists(query: string, limit = 10): Promise<MusicBrainzArtist[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch artists');
    
    const data: SearchResult<MusicBrainzArtist> = await response.json();
    return data.artists || [];
  } catch (error) {
    console.error('Error searching artists:', error);
    return [];
  }
}

export async function getArtist(mbid: string): Promise<MusicBrainzArtist | null> {
  const url = `${MUSICBRAINZ_BASE_URL}/artist/${mbid}?fmt=json&inc=release-groups`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;
    
    return response.json();
  } catch (error) {
    console.error('Error fetching artist:', error);
    return null;
  }
}

export async function getArtistReleaseGroups(mbid: string, limit = 50): Promise<MusicBrainzReleaseGroup[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/release-group?artist=${mbid}&fmt=json&limit=${limit}`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data['release-groups'] || [];
  } catch (error) {
    console.error('Error fetching release groups:', error);
    return [];
  }
}

export async function searchReleases(query: string, limit = 10): Promise<MusicBrainzRelease[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/release?query=${encodeURIComponent(query)}&fmt=json&limit=${limit}`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) throw new Error('Failed to fetch releases');
    
    const data: SearchResult<MusicBrainzRelease> = await response.json();
    return data.releases || [];
  } catch (error) {
    console.error('Error searching releases:', error);
    return [];
  }
}

export async function getRelease(mbid: string): Promise<MusicBrainzRelease | null> {
  const url = `${MUSICBRAINZ_BASE_URL}/release/${mbid}?fmt=json&inc=recordings+artist-credits+release-groups`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return null;
    
    return response.json();
  } catch (error) {
    console.error('Error fetching release:', error);
    return null;
  }
}

export async function getReleaseGroupReleases(releaseGroupId: string): Promise<MusicBrainzRelease[]> {
  const url = `${MUSICBRAINZ_BASE_URL}/release?release-group=${releaseGroupId}&fmt=json&limit=1`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.releases || [];
  } catch (error) {
    console.error('Error fetching release group releases:', error);
    return [];
  }
}

export function getCoverArtUrl(releaseGroupId: string, size: 'small' | 'large' | '250' | '500' | '1200' = '500'): string {
  return `${COVER_ART_BASE_URL}/release-group/${releaseGroupId}/front-${size}`;
}

export async function checkCoverArtExists(releaseGroupId: string): Promise<boolean> {
  try {
    const response = await fetch(`${COVER_ART_BASE_URL}/release-group/${releaseGroupId}`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
