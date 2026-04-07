/**
 * Metadata Provider Abstraction
 * 
 * Priority: Spotify API (when available) → MusicBrainz (current, always available)
 * 
 * The Spotify integration will be activated once API credentials are provided.
 * Until then, MusicBrainz serves as the sole metadata source.
 */

export type MetadataSource = 'spotify' | 'musicbrainz';

export interface MetadataProviderConfig {
  spotifyAvailable: boolean;
  primarySource: MetadataSource;
}

// Default config — MusicBrainz only until Spotify is configured
export function getMetadataConfig(): MetadataProviderConfig {
  // TODO: Check if Spotify API key is available via environment/secrets
  const spotifyAvailable = false;

  return {
    spotifyAvailable,
    primarySource: spotifyAvailable ? 'spotify' : 'musicbrainz',
  };
}

/**
 * Search for artists — delegates to the appropriate provider
 * Currently always uses MusicBrainz. When Spotify is configured,
 * it will try Spotify first and fall back to MusicBrainz.
 */
export async function searchArtists(query: string): Promise<'musicbrainz'> {
  const config = getMetadataConfig();
  
  if (config.spotifyAvailable) {
    // TODO: Implement Spotify search
    // try { return await spotifySearchArtists(query); } catch { /* fall through */ }
  }

  // Always fall back to MusicBrainz (current implementation in musicbrainz.ts)
  return 'musicbrainz';
}

/**
 * Search for albums — delegates to the appropriate provider
 */
export async function searchAlbums(query: string): Promise<'musicbrainz'> {
  const config = getMetadataConfig();
  
  if (config.spotifyAvailable) {
    // TODO: Implement Spotify album search
  }

  return 'musicbrainz';
}

/**
 * ISRC Lookup — maps a track across providers
 * This will be activated when Spotify API is available
 */
export async function lookupISRC(_isrc: string): Promise<{
  spotify_id?: string;
  apple_music_id?: string;
  youtube_video_id?: string;
} | null> {
  // TODO: Implement when Spotify API credentials are provided
  // 1. Query isrc_mapping table first (cached)
  // 2. If not found, query Spotify API by ISRC
  // 3. Cache result in isrc_mapping table
  return null;
}
