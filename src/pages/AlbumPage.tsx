import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Disc3, ImageIcon, Loader2, PlayCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AddToPlaylistButton } from '@/components/music/AddToPlaylistButton';
import { SongDetails } from '@/components/music/SongDetails';
import {
  getAlbum,
  getArtistAlbums,
  pickAlbumCover,
  formatDuration,
  type DeezerAlbum,
  type DeezerTrack,
} from '@/lib/deezer';
import {
  resolveOriginalAlbumId,
  looksLikeVariant,
} from '@/lib/discography';
import { fetchReleaseGroupAlbum, isMusicBrainzId } from '@/lib/musicbrainz';
import { purifyTracks } from '@/lib/purify';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { emitTrackRating, onTrackRating } from '@/lib/ratingEvents';

const MOOD_TAGS = [
  'Joy / Uplift',
  'Sadness / Melancholy',
  'Calm / Relaxation',
  'Drive / Energy',
  'Nostalgia',
  'Heroism / Triumph',
  'Anxiety / Fear',
  'Dreaminess',
  'Excitement',
];

/* -------------------- Radial Gauge -------------------- */

function RadialScoreGauge({
  score,
  rated,
  total,
}: {
  score: number;
  rated: number;
  total: number;
}) {
  const pct = Math.max(0, Math.min(1, score / 10));
  const radius = 110;
  const cx = 130;
  const cy = 130;
  const circumference = Math.PI * radius;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative w-full max-w-[320px] mx-auto">
      <svg viewBox="0 0 260 160" className="w-full h-auto">
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="20"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="20"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-2 text-center">
        <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground mb-1">
          Average score
        </p>
        <p className="text-4xl font-bold leading-none">
          {score.toFixed(1)}
          <span className="text-muted-foreground text-2xl">/10</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          rated tracks: {rated}/{total}
        </p>
      </div>
    </div>
  );
}

/* -------------------- Track Row -------------------- */

interface TrackRowProps {
  track: DeezerTrack;
  index: number;
  position: number;
  albumTitle: string;
  albumCover: string | null;
  albumDeezerId: string;
  artistName?: string;
  rating: number;
  hoverRating: number;
  isPlaying: boolean;
  saving: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRate: (rating: number) => void;
  onHoverRate: (rating: number) => void;
  onPlay: () => void;
}

function TrackRow({
  track,
  position,
  albumTitle,
  albumCover,
  albumDeezerId,
  artistName,
  rating,
  hoverRating,
  isPlaying,
  saving,
  isExpanded,
  onToggleExpand,
  onRate,
  onHoverRate,
  onPlay,
}: TrackRowProps) {
  const display = hoverRating || rating;
  const pct = (display / 10) * 100;
  const [imgError, setImgError] = useState(false);

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const score = Math.max(1, Math.min(10, Math.ceil((x / rect.width) * 10)));
    onRate(score);
  };

  const handleBarMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const score = Math.max(1, Math.min(10, Math.ceil((x / rect.width) * 10)));
    onHoverRate(score);
  };

  return (
    <div
      className={cn(
        'group grid items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200',
        'grid-cols-[28px_56px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,1.2fr)_56px_44px]',
        'hover:bg-secondary/60 hover:shadow-sm',
        isPlaying && 'bg-primary/10',
      )}
    >
      {/* # */}
      <span className="text-sm font-mono text-muted-foreground text-center">{position}</span>

      {/* Artwork */}
      <button
        onClick={onPlay}
        className="relative w-12 h-12 rounded-md bg-secondary overflow-hidden flex items-center justify-center group/play"
      >
        {albumCover && !imgError ? (
          <img
            src={albumCover}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
        )}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity">
          <PlayCircle className="w-5 h-5 text-white" />
        </div>
      </button>

      {/* Title */}
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-medium',
            isPlaying ? 'text-primary' : 'text-foreground',
          )}
        >
          {track.title}
        </p>
        {artistName && (
          <p className="truncate text-xs text-muted-foreground sm:hidden">{artistName}</p>
        )}
      </div>

      {/* Album column / Song Details on hover */}
      <div className="relative min-w-0 hidden md:flex items-center">
        <span className="truncate text-sm text-muted-foreground group-hover:opacity-0 transition-opacity">
          {albumTitle}
        </span>
        <button
          type="button"
          onClick={onToggleExpand}
          className={cn(
            'absolute left-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium',
            'bg-background border border-border shadow-sm hover:bg-secondary',
            'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0',
            'transition-all duration-200',
            isExpanded && 'opacity-100 translate-x-0 bg-primary text-primary-foreground border-primary',
          )}
        >
          {isExpanded ? 'Hide details' : 'Song Details'}
        </button>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
          AVG
        </span>
        <div
          onClick={handleBarClick}
          onMouseMove={handleBarMove}
          onMouseLeave={() => onHoverRate(0)}
          className={cn(
            'relative flex-1 h-2.5 rounded-full bg-muted overflow-hidden cursor-pointer',
            saving && 'opacity-50',
          )}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={10}
          aria-valuenow={rating}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full"
            style={{
              width: `${pct}%`,
              transition: 'width 250ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>
        <span className="text-sm font-mono text-foreground w-4 text-right">
          {rating > 0 ? rating : '–'}
        </span>
      </div>

      {/* Duration */}
      <span className="text-sm font-mono text-muted-foreground text-right">
        {track.duration ? formatDuration(track.duration) : '--:--'}
      </span>

      {/* Add */}
      <div className="flex justify-center">
        <AddToPlaylistButton
          track={track}
          artistName={artistName}
          albumTitle={albumTitle}
          albumDeezerId={albumDeezerId}
          coverUrl={albumCover}
        />
      </div>
    </div>
  );
}

/* -------------------- Album Review -------------------- */

function AlbumReviewCard({ albumDeezerId }: { albumDeezerId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const draftKey = `album_review_draft_${albumDeezerId}`;
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load existing review or local draft
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (user) {
        const { data } = await supabase
          .from('album_reviews')
          .select('review_text, review_tags')
          .eq('user_id', user.id)
          .eq('album_deezer_id', albumDeezerId)
          .maybeSingle();
        if (cancelled) return;
        if (data) {
          setText(data.review_text ?? '');
          setTags(data.review_tags ?? []);
          setLoaded(true);
          return;
        }
      }
      const draft = localStorage.getItem(draftKey);
      if (draft && !cancelled) {
        try {
          const parsed = JSON.parse(draft);
          setText(parsed.text ?? '');
          setTags(parsed.tags ?? []);
        } catch {
          /* noop */
        }
      }
      setLoaded(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user, albumDeezerId, draftKey]);

  // Autosave draft
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(draftKey, JSON.stringify({ text, tags }));
  }, [text, tags, draftKey, loaded]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to save your album review.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('album_reviews')
      .upsert(
        {
          user_id: user.id,
          album_deezer_id: albumDeezerId,
          review_text: text,
          review_tags: tags,
        },
        { onConflict: 'user_id,album_deezer_id' },
      );
    setSaving(false);
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }
    localStorage.removeItem(draftKey);
    toast({ title: 'Review saved' });
  };

  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8">
      <div className="mb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          ♪ Album review
        </p>
        <h2 className="text-3xl md:text-4xl font-bold">Album review</h2>
      </div>

      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
        What do you feel listening this album?
      </label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write what this album feels like, where it peaks, and which tracks carry the identity."
        rows={6}
        className="resize-none bg-background/60 border-border/60 text-base"
      />

      <div className="flex flex-wrap gap-2 mt-5">
        {MOOD_TAGS.map((t) => {
          const active = tags.includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={cn(
                'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving} className="mt-6">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Save album review
      </Button>
    </section>
  );
}

/* -------------------- Page -------------------- */

const AlbumPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { playTrack: playYT, currentTrack: ytCurrentTrack } = useYouTubePlayer();

  const [album, setAlbum] = useState<DeezerAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coverError, setCoverError] = useState(false);
  const [originalAlbumId, setOriginalAlbumId] = useState<string | null>(null);
  const [trackRatings, setTrackRatings] = useState<Record<number, number>>({});
  const [hoverRatings, setHoverRatings] = useState<Record<number, number>>({});
  const [savingTrack, setSavingTrack] = useState<number | null>(null);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const routeArtistId = searchParams.get('artistId') ?? undefined;
  const routeArtistName = searchParams.get('artistName') ?? undefined;

  /* Album fetch */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setCoverError(false);
    const load = async () => {
      const data = isMusicBrainzId(id)
        ? await fetchReleaseGroupAlbum(id, { artistId: routeArtistId, artistName: routeArtistName })
        : await getAlbum(id);
      if (cancelled) return;
      setAlbum(data);
      setIsLoading(false);
    };
    load().catch((err) => {
      console.error('[AlbumPage] album fetch failed:', err);
      if (!cancelled) {
        setAlbum(null);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, routeArtistId, routeArtistName]);

  /* Resolve original release id (de-dupe Deluxe/Remasters) */
  useEffect(() => {
    if (!album?.artist?.id || isMusicBrainzId(String(album.id))) {
      setOriginalAlbumId(album?.id != null ? String(album.id) : null);
      return;
    }
    if (!album?.artist?.id) {
      setOriginalAlbumId(null);
      return;
    }
    let cancelled = false;
    getArtistAlbums(String(album.artist.id), 100).then((artistAlbums) => {
      if (cancelled) return;
      setOriginalAlbumId(resolveOriginalAlbumId(album, artistAlbums));
    });
    return () => {
      cancelled = true;
    };
  }, [album]);

  /* Track ratings */
  useEffect(() => {
    if (!user || !id) return;
    supabase
      .from('track_ratings')
      .select('track_position, rating')
      .eq('user_id', user.id)
      .eq('album_deezer_id', id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<number, number> = {};
        data.forEach((r) => {
          map[r.track_position] = r.rating;
        });
        setTrackRatings(map);
      });
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    return onTrackRating(({ albumId, trackPosition, rating }) => {
      if (albumId !== id) return;
      setTrackRatings((prev) => (prev[trackPosition] === rating ? prev : { ...prev, [trackPosition]: rating }));
    });
  }, [id]);

  /* Purified tracks (title sanitization, non-musical/short-track exclusion,
     contextual duplicate filter for Deluxe/Expanded editions). */
  const tracks = useMemo<DeezerTrack[]>(() => {
    if (!album?.tracks?.data) return [];
    const rt = (album.record_type ?? '').toLowerCase();
    const isSingleOrEP = rt === 'single' || rt === 'ep';
    const isDeluxeOrExpanded = looksLikeVariant(album.title ?? '');
    return purifyTracks(album.tracks.data, { isSingleOrEP, isDeluxeOrExpanded });
  }, [album]);

  const ratedScores = useMemo(() => Object.values(trackRatings), [trackRatings]);
  const avgScore =
    ratedScores.length > 0
      ? Number((ratedScores.reduce((a, b) => a + b, 0) / ratedScores.length).toFixed(1))
      : 0;

  /* Persist album-level score whenever it changes */
  const albumWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user || !id || !album || ratedScores.length === 0) return;
    if (albumWriteTimer.current) clearTimeout(albumWriteTimer.current);
    const score = Math.round(avgScore);
    const writeId = originalAlbumId ?? id;
    albumWriteTimer.current = setTimeout(() => {
      supabase
        .from('album_ratings')
        .upsert(
          {
            user_id: user.id,
            album_deezer_id: writeId,
            artist_deezer_id: album.artist?.id ? String(album.artist.id) : null,
            album_title: album.title,
            artist_name: album.artist?.name,
            cover_url: pickAlbumCover(album),
            rating: score,
            rated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,album_deezer_id' },
        )
        .then(({ error }) => {
          if (error) console.error('Error saving album score:', error);
        });
    }, 600);
    return () => {
      if (albumWriteTimer.current) clearTimeout(albumWriteTimer.current);
    };
  }, [avgScore, ratedScores.length, user, id, album, originalAlbumId]);

  const handleRateTrack = useCallback(
    (track: DeezerTrack, position: number, rating: number) => {
      if (!user || !id) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to rate tracks.',
          variant: 'destructive',
        });
        return;
      }
      setTrackRatings((prev) => ({ ...prev, [position]: rating }));
      setSavingTrack(position);
      supabase
        .from('track_ratings')
        .upsert(
          {
            user_id: user.id,
            album_deezer_id: id,
            track_deezer_id: String(track.id),
            track_title: track.title,
            track_position: position,
            rating,
            rated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,album_deezer_id,track_position' },
        )
        .then(({ error }) => {
          setSavingTrack(null);
          if (error) {
            console.error('Error saving track rating:', error);
            toast({
              title: 'Error',
              description: 'Failed to save track rating.',
              variant: 'destructive',
            });
          }
        });
    },
    [user, id, toast],
  );

  const handlePlay = useCallback(
    (track: DeezerTrack, position: number) => {
      if (!album) return;
      playYT(
        {
          id: String(track.id),
          title: track.title,
          position,
          length: track.duration * 1000,
        },
        String(id),
        album.artist?.name,
        album.title,
        tracks.map((t, i) => ({
          id: String(t.id),
          title: t.title,
          position: t.track_position ?? i + 1,
          length: t.duration * 1000,
        })),
      );
    },
    [album, id, tracks, playYT],
  );

  /* -------------------- Render -------------------- */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-6 w-40 mb-8" />
            <div className="flex flex-col md:flex-row gap-8">
              <Skeleton className="w-72 h-72 rounded-2xl" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Album not found</h1>
          <Link to="/" className="text-primary hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const artistName = album.artist?.name;
  const artistId = album.artist?.id;
  const coverUrl = pickAlbumCover(album);
  const recordType = (album.record_type ?? 'Album').charAt(0).toUpperCase() + (album.record_type ?? 'Album').slice(1);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Back nav */}
          {artistId && artistName && (
            <Link
              to={`/artist/${artistId}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to {artistName}
            </Link>
          )}

          {/* Hero */}
          <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-center mb-12">
            {/* Left: cover + metadata */}
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-secondary overflow-hidden flex-shrink-0 border border-border/60"
              >
                {coverUrl && !coverError ? (
                  <img
                    src={coverUrl}
                    alt={album.title}
                    className="w-full h-full object-cover"
                    onError={() => setCoverError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Disc3 className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex-1 min-w-0"
              >
                <Badge
                  variant="secondary"
                  className="rounded-full text-xs font-medium px-3 py-1 mb-3"
                >
                  {recordType}
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight mb-2">
                  {album.title}
                </h1>
                {artistName && artistId && (
                  <Link
                    to={`/artist/${artistId}`}
                    className="text-base font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {artistName}
                  </Link>
                )}
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  {album.release_date && <span>{album.release_date}</span>}
                  {album.release_date && tracks.length > 0 && <span>•</span>}
                  {tracks.length > 0 && (
                    <span>
                      {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Right: radial gauge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <RadialScoreGauge
                score={avgScore}
                rated={ratedScores.length}
                total={tracks.length}
              />
            </motion.div>
          </section>

          {/* Tracks */}
          <section className="mb-12">
            <div className="flex items-baseline justify-between mb-5 px-1">
              <h2 className="text-2xl font-bold">Tracks</h2>
              <p className="text-sm text-muted-foreground hidden md:block">
                Rate each song and compare against the rest of the record.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-2 sm:p-3">
              {/* Header row */}
              <div className="hidden md:grid grid-cols-[28px_56px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(180px,1.2fr)_56px_44px] gap-4 px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                <span className="text-center">#</span>
                <span></span>
                <span>Song name</span>
                <span>Album</span>
                <span>Rating</span>
                <span className="text-right">Time</span>
                <span></span>
              </div>

              <div className="py-1">
                <AnimatePresence initial={false}>
                  {tracks.map((track, idx) => {
                    const position = track.track_position ?? idx + 1;
                    const rating = trackRatings[position] ?? 0;
                    const hover = hoverRatings[position] ?? 0;
                    const isPlaying =
                      ytCurrentTrack?.position === position &&
                      ytCurrentTrack?.title === track.title;
                    const trackIdStr = String(track.id);
                    const isExpanded = expandedTrackId === trackIdStr;
                    return (
                      <motion.div
                        key={track.id ?? idx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: idx * 0.02 }}
                      >
                        <TrackRow
                          track={track}
                          index={idx}
                          position={position}
                          albumTitle={album.title}
                          albumCover={coverUrl}
                          albumDeezerId={String(id)}
                          artistName={artistName}
                          rating={rating}
                          hoverRating={hover}
                          isPlaying={isPlaying}
                          saving={savingTrack === position}
                          isExpanded={isExpanded}
                          onToggleExpand={() =>
                            setExpandedTrackId(isExpanded ? null : trackIdStr)
                          }
                          onRate={(r) => handleRateTrack(track, position, r)}
                          onHoverRate={(r) =>
                            setHoverRatings((prev) => ({ ...prev, [position]: r }))
                          }
                          onPlay={() => handlePlay(track, position)}
                        />
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <SongDetails
                              key={`details-${trackIdStr}`}
                              track={track}
                              albumDeezerId={String(id)}
                              albumCover={coverUrl}
                              artistName={artistName}
                              onClose={() => setExpandedTrackId(null)}
                            />
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 mt-2 border-t border-border/60">
                <span className="text-sm font-semibold text-muted-foreground">
                  Album Score ({ratedScores.length}/{tracks.length} tracks rated)
                </span>
                <span className="text-2xl font-bold">
                  {ratedScores.length > 0 ? `${avgScore.toFixed(1)}/10` : '–/10'}
                </span>
              </div>
            </div>
          </section>

          {/* Album review */}
          <AlbumReviewCard albumDeezerId={String(id)} />
        </div>
      </main>
    </div>
  );
};

export default AlbumPage;
