import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { cleanSearchQuery } from '@/lib/cleanMetadata';

interface Track {
  id: string;
  title: string;
  position: number;
  length?: number;
}

type RepeatMode = 'off' | 'all' | 'one';

interface YouTubePlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  currentAlbumMbid: string | null;
  artistName: string | null;
  albumTitle: string | null;
  volume: number;
  tracks: Track[];
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: Track, albumMbid: string, artistName?: string, albumTitle?: string, allTracks?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setVolumeDucked: (ducked: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

const YouTubePlayerContext = createContext<YouTubePlayerState | null>(null);

const YOUTUBE_API_KEY = 'AIzaSyA_rjOkH6E2T-cebeeuXzxiti0B7T91J-k';

const defaultState: YouTubePlayerState = {
  isPlaying: false, currentTrack: null, currentAlbumMbid: null,
  artistName: null, albumTitle: null, volume: 80, tracks: [],
  currentTime: 0, duration: 0, shuffle: false, repeat: 'off',
  playTrack: () => {}, togglePlay: () => {}, nextTrack: () => {},
  prevTrack: () => {}, seekTo: () => {},
  setVolume: () => {}, setVolumeDucked: () => {},
  toggleShuffle: () => {}, cycleRepeat: () => {},
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiReadyRef = useRef(false);
  const preVolRef = useRef(80);
  const pendingSearchRef = useRef<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shuffleRef = useRef(false);
  const repeatRef = useRef<RepeatMode>('off');
  const tracksRef = useRef<Track[]>([]);
  const currentTrackRef = useRef<Track | null>(null);
  const currentAlbumMbidRef = useRef<string | null>(null);
  const artistNameRef = useRef<string | null>(null);
  const albumTitleRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { currentAlbumMbidRef.current = currentAlbumMbid; }, [currentAlbumMbid]);
  useEffect(() => { artistNameRef.current = artistName; }, [artistName]);
  useEffect(() => { albumTitleRef.current = albumTitle; }, [albumTitle]);

  // Progress tracking
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
        setCurrentTime(playerRef.current.getCurrentTime() || 0);
        const dur = playerRef.current.getDuration() || 0;
        if (dur > 0) setDuration(dur);
      }
    }, 250);
  }, []);

  const stopProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopProgressTracking(), [stopProgressTracking]);

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

  const getNextTrack = useCallback((direction: 'next' | 'prev' = 'next') => {
    const t = tracksRef.current;
    const cur = currentTrackRef.current;
    if (!cur || t.length === 0) return null;

    if (repeatRef.current === 'one') return cur;

    if (shuffleRef.current && direction === 'next') {
      const others = t.filter(tr => tr.position !== cur.position);
      return others.length > 0 ? others[Math.floor(Math.random() * others.length)] : cur;
    }

    const idx = t.findIndex(tr => tr.position === cur.position);
    if (direction === 'next') {
      if (idx < t.length - 1) return t[idx + 1];
      return repeatRef.current === 'all' ? t[0] : null;
    } else {
      if (idx > 0) return t[idx - 1];
      return repeatRef.current === 'all' ? t[t.length - 1] : null;
    }
  }, []);

  const handleTrackEnded = useCallback(() => {
    const next = getNextTrack('next');
    if (next && currentAlbumMbidRef.current) {
      playTrackInternal(next, currentAlbumMbidRef.current, artistNameRef.current || undefined, albumTitleRef.current || undefined, tracksRef.current);
    } else {
      setIsPlaying(false);
      stopProgressTracking();
    }
  }, [getNextTrack, stopProgressTracking]);

  const handleTrackEndedRef = useRef(handleTrackEnded);
  useEffect(() => { handleTrackEndedRef.current = handleTrackEnded; }, [handleTrackEnded]);

  const initPlayer = useCallback((videoId: string) => {
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoId);
      startProgressTracking();
      return;
    }

    if (!containerRef.current) {
      const div = document.createElement('div');
      div.id = 'yt-hidden-player';
      div.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-9999px';
      document.body.appendChild(div);
      containerRef.current = div;
    }

    playerRef.current = new window.YT.Player('yt-hidden-player', {
      height: '1', width: '1', videoId,
      playerVars: { autoplay: 1, controls: 0 },
      events: {
        onReady: (e: any) => {
          e.target.setVolume(volume);
          e.target.playVideo();
          setIsPlaying(true);
          startProgressTracking();
        },
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            startProgressTracking();
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            stopProgressTracking();
            handleTrackEndedRef.current();
          }
        },
      },
    });
  }, [volume, startProgressTracking, stopProgressTracking]);

  // Parse ISO 8601 duration (PT4M33S) to seconds
  const parseISODuration = (iso: string): number => {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
  };

  const ALBUM_KEYWORDS = /\b(full album|complete album|entire album|álbum completo|full lp|whole album|album completo|disco completo|all songs|playlist|mix|compilation|greatest hits|discography)\b/i;

  const searchAndPlay = useCallback(async (query: string, expectedDurationSec?: number) => {
    if (!apiReadyRef.current) {
      pendingSearchRef.current = query;
      return;
    }
    console.log('[YouTube] Searching for:', query, 'expected duration:', expectedDurationSec);
    try {
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&videoEmbeddable=true&key=${YOUTUBE_API_KEY}`;
      const resp = await fetch(searchUrl);
      if (!resp.ok) { console.error('[YouTube] API error:', resp.status); return; }
      const data = await resp.json();
      const items = data.items || [];
      if (items.length === 0) { console.error('[YouTube] No results found'); return; }

      // Fetch durations for all candidates
      const ids = items.map((i: any) => i.id?.videoId).filter(Boolean).join(',');
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${YOUTUBE_API_KEY}`;
      const detailsResp = await fetch(detailsUrl);
      const detailsData = await detailsResp.json();

      type Candidate = { id: string; title: string; duration: number; score: number };
      const candidates: Candidate[] = (detailsData.items || []).map((it: any) => {
        const id = it.id;
        const title: string = it.snippet?.title || '';
        const duration = parseISODuration(it.contentDetails?.duration || 'PT0S');
        let score = 0;

        // Heavy penalty for album/compilation uploads
        if (ALBUM_KEYWORDS.test(title)) score -= 1000;

        // Penalty for very long videos (likely full albums) when no expected duration
        if (!expectedDurationSec && duration > 900) score -= 500; // > 15min

        // Duration match scoring
        if (expectedDurationSec && expectedDurationSec > 0) {
          const diff = Math.abs(duration - expectedDurationSec);
          if (diff <= 5) score += 1000;
          else if (diff <= 15) score += 500;
          else if (diff <= 30) score += 100;
          else if (diff > 60) score -= 200;
          // Strong penalty if YT video is much longer than expected (full album case)
          if (duration > expectedDurationSec * 2.5 && duration > 600) score -= 2000;
        }

        // Bonus for "official audio/video/lyrics"
        if (/official\s+(audio|video|music\s+video|lyric)/i.test(title)) score += 50;

        return { id, title, duration, score };
      });

      candidates.sort((a, b) => b.score - a.score);
      console.log('[YouTube] Ranked candidates:', candidates.map(c => ({ title: c.title, dur: c.duration, score: c.score })));

      const best = candidates[0];
      if (best) { console.log('[YouTube] Playing:', best.title, best.id); initPlayer(best.id); }
      else console.error('[YouTube] No suitable candidate');
    } catch (err) { console.error('[YouTube] Search failed:', err); }
  }, [initPlayer]);

  const playTrackInternal = useCallback((track: Track, albumMbid: string, artist?: string, album?: string, allTracks?: Track[]) => {
    setCurrentTrack(track);
    setCurrentAlbumMbid(albumMbid);
    setArtistName(artist || null);
    setAlbumTitle(album || null);
    if (allTracks) setTracks(allTracks);
    setCurrentTime(0);
    setDuration(0);
    const cleanedTitle = cleanSearchQuery(track.title);
    const query = `${artist || ''} ${cleanedTitle} official audio`.trim();
    searchAndPlay(query);
  }, [searchAndPlay]);

  const playTrack = useCallback((track: Track, albumMbid: string, artist?: string, album?: string, allTracks?: Track[]) => {
    playTrackInternal(track, albumMbid, artist, album, allTracks);
  }, [playTrackInternal]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  }, [isPlaying]);

  const nextTrack = useCallback(() => {
    const next = getNextTrack('next');
    if (next && currentAlbumMbidRef.current) {
      playTrackInternal(next, currentAlbumMbidRef.current, artistNameRef.current || undefined, albumTitleRef.current || undefined, tracksRef.current);
    }
  }, [getNextTrack, playTrackInternal]);

  const prevTrack = useCallback(() => {
    // If more than 3s in, restart current track
    if (playerRef.current?.getCurrentTime && playerRef.current.getCurrentTime() > 3) {
      playerRef.current.seekTo(0, true);
      setCurrentTime(0);
      return;
    }
    const prev = getNextTrack('prev');
    if (prev && currentAlbumMbidRef.current) {
      playTrackInternal(prev, currentAlbumMbidRef.current, artistNameRef.current || undefined, albumTitleRef.current || undefined, tracksRef.current);
    }
  }, [getNextTrack, playTrackInternal]);

  const seekTo = useCallback((seconds: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (playerRef.current?.setVolume) playerRef.current.setVolume(vol);
  }, []);

  const setVolumeDucked = useCallback((ducked: boolean) => {
    if (ducked) { preVolRef.current = volume; setVolume(15); }
    else setVolume(preVolRef.current);
  }, [volume, setVolume]);

  const toggleShuffle = useCallback(() => setShuffle(p => !p), []);
  const cycleRepeat = useCallback(() => setRepeat(p => p === 'off' ? 'all' : p === 'all' ? 'one' : 'off'), []);

  return (
    <YouTubePlayerContext.Provider value={{
      isPlaying, currentTrack, currentAlbumMbid, artistName, albumTitle, volume, tracks,
      currentTime, duration, shuffle, repeat,
      playTrack, togglePlay, nextTrack, prevTrack, seekTo,
      setVolume, setVolumeDucked, toggleShuffle, cycleRepeat,
    }}>
      {children}
    </YouTubePlayerContext.Provider>
  );
}
