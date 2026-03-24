import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface Track {
  id: string;
  title: string;
  position: number;
  length?: number;
}

interface YouTubePlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentAlbumMbid: string | null;
  artistName: string | null;
  albumTitle: string | null;
  volume: number;
  tracks: Track[];
  playTrack: (track: Track, albumMbid: string, artistName?: string, albumTitle?: string, allTracks?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  setVolume: (vol: number) => void;
  setVolumeDucked: (ducked: boolean) => void;
}

const YouTubePlayerContext = createContext<YouTubePlayerState | null>(null);

const YOUTUBE_API_KEY = 'AIzaSyA_rjOkH6E2T-cebeeuXzxiti0B7T91J-k';

const defaultState: YouTubePlayerState = {
  isPlaying: false, currentTrack: null, currentAlbumMbid: null,
  artistName: null, albumTitle: null, volume: 80, tracks: [],
  playTrack: () => {}, togglePlay: () => {}, nextTrack: () => {},
  setVolume: () => {}, setVolumeDucked: () => {},
};

export function useYouTubePlayer() {
  const ctx = useContext(YouTubePlayerContext);
  return ctx ?? defaultState;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YouTubePlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentAlbumMbid, setCurrentAlbumMbid] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState<string | null>(null);
  const [volume, setVolumeState] = useState(80);
  const [tracks, setTracks] = useState<Track[]>([]);
  
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiReadyRef = useRef(false);
  const preVolRef = useRef(80);
  const pendingSearchRef = useRef<string | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      apiReadyRef.current = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiReadyRef.current = true;
      if (pendingSearchRef.current) {
        searchAndPlay(pendingSearchRef.current);
        pendingSearchRef.current = null;
      }
    };
  }, []);

  const initPlayer = useCallback((videoId: string) => {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      return;
    }

    // Create container if needed
    if (!containerRef.current) {
      const div = document.createElement('div');
      div.id = 'yt-hidden-player';
      div.style.position = 'fixed';
      div.style.width = '1px';
      div.style.height = '1px';
      div.style.opacity = '0';
      div.style.pointerEvents = 'none';
      div.style.top = '-9999px';
      document.body.appendChild(div);
      containerRef.current = div;
    }

    playerRef.current = new window.YT.Player('yt-hidden-player', {
      height: '1',
      width: '1',
      videoId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: (e: any) => {
          e.target.setVolume(volume);
          e.target.playVideo();
          setIsPlaying(true);
        },
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.PLAYING) setIsPlaying(true);
          else if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
          else if (e.data === window.YT.PlayerState.ENDED) setIsPlaying(false);
        },
      },
    });
  }, [volume]);

  const searchAndPlay = useCallback(async (query: string) => {
    if (!apiReadyRef.current) {
      pendingSearchRef.current = query;
      return;
    }

    console.log('[YouTube] Searching for:', query);

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=5&key=${YOUTUBE_API_KEY}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error('[YouTube] API error:', resp.status, await resp.text());
        return;
      }
      const data = await resp.json();
      console.log('[YouTube] Search results:', data.items?.map((i: any) => ({ title: i.snippet?.title, id: i.id?.videoId })));

      const videoId = data.items?.[0]?.id?.videoId;
      if (videoId) {
        console.log('[YouTube] Playing videoId:', videoId);
        initPlayer(videoId);
      } else {
        console.error('[YouTube] No results found');
      }
    } catch (err) {
      console.error('[YouTube] Search failed:', err);
    }
  }, [initPlayer]);

  const playTrack = useCallback((track: Track, albumMbid: string, artist?: string, album?: string, allTracks?: Track[]) => {
    setCurrentTrack(track);
    setCurrentAlbumMbid(albumMbid);
    setArtistName(artist || null);
    setAlbumTitle(album || null);
    if (allTracks) setTracks(allTracks);

    const query = `${artist || ''} ${track.title} official audio`.trim();
    searchAndPlay(query);
  }, [searchAndPlay]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPlaying]);

  const nextTrack = useCallback(() => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.position === currentTrack.position);
    const next = tracks[idx + 1] || tracks[0];
    if (next && currentAlbumMbid) {
      playTrack(next, currentAlbumMbid, artistName || undefined, albumTitle || undefined, tracks);
    }
  }, [currentTrack, tracks, currentAlbumMbid, artistName, albumTitle, playTrack]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(vol);
    }
  }, []);

  const setVolumeDucked = useCallback((ducked: boolean) => {
    if (ducked) {
      preVolRef.current = volume;
      setVolume(15);
    } else {
      setVolume(preVolRef.current);
    }
  }, [volume, setVolume]);

  return (
    <YouTubePlayerContext.Provider value={{
      isPlaying, currentTrack, currentAlbumMbid, artistName, albumTitle, volume, tracks,
      playTrack, togglePlay, nextTrack, setVolume, setVolumeDucked,
    }}>
      {children}
    </YouTubePlayerContext.Provider>
  );
}
