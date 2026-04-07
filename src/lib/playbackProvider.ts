/**
 * Playback Provider Abstraction
 * 
 * Priority logic:
 * 1. Spotify SDK (if user has Premium + connected account)
 * 2. YouTube IFrame (current fallback, always available)
 * 
 * Future: Apple Music via MusicKit JS
 */

export type PlaybackProvider = 'spotify' | 'youtube' | 'apple';

export interface PlaybackCapabilities {
  provider: PlaybackProvider;
  canPlay: boolean;
  requiresPremium: boolean;
  label: string;
}

// Check which providers the user has available
export function getAvailableProviders(
  primaryProvider: PlaybackProvider = 'youtube',
  connectedProviders: PlaybackProvider[] = []
): PlaybackCapabilities[] {
  const providers: PlaybackCapabilities[] = [];

  // Spotify — requires Premium
  if (connectedProviders.includes('spotify')) {
    providers.push({
      provider: 'spotify',
      canPlay: true, // Will need runtime check for Premium
      requiresPremium: true,
      label: 'Spotify',
    });
  }

  // YouTube — always available as fallback
  providers.push({
    provider: 'youtube',
    canPlay: true,
    requiresPremium: false,
    label: 'YouTube',
  });

  // Sort: primary provider first, then by availability
  return providers.sort((a, b) => {
    if (a.provider === primaryProvider) return -1;
    if (b.provider === primaryProvider) return 1;
    return 0;
  });
}

// Resolve the best provider for playback
export function resolvePlaybackProvider(
  primaryProvider: PlaybackProvider = 'youtube',
  connectedProviders: PlaybackProvider[] = [],
  hasSpotifyPremium: boolean = false
): PlaybackProvider {
  if (primaryProvider === 'spotify' && connectedProviders.includes('spotify') && hasSpotifyPremium) {
    return 'spotify';
  }

  // Fallback to YouTube (always works)
  return 'youtube';
}
