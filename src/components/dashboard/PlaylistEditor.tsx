import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Search, Pencil, Save, X, Music, Plus, ChevronLeft, Trash2, ImageIcon, Sparkles } from '@/components/icons';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  searchTracks,
  searchArtists,
  getRelatedArtists,
  getArtistTopTracks,
  formatDuration,
  pickArtistImage,

  type DeezerTrack,
  type DeezerArtist,
} from '@/lib/deezer';

interface PlaylistTrack {
  id?: string;
  position: number;
  track_deezer_id: string;
  track_title: string;
  artist_name: string | null;
  artist_deezer_id: string | null;
  album_title: string | null;
  album_deezer_id: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
}

export function PlaylistEditor() {
  const params = useParams<{ artistName?: string; playlistId?: string }>();
  const id = params.playlistId ?? params.artistName;

  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const isAuto = id === 'auto-top-rated';
  const isNew = id === 'new';
  const isExisting = !isNew && !isAuto;

  const [name, setName] = useState('New playlist №1');
  const [editingName, setEditingName] = useState(isNew);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [savedPlaylistId, setSavedPlaylistId] = useState<string | null>(isExisting ? id! : null);
  const [dirty, setDirty] = useState(false);

  // ----- Load existing or auto playlist -----
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (isNew) {
        setLoading(false);
        return;
      }

      if (isAuto) {
        setName('Top Rated Tracks');
        const { data: rs } = await supabase
          .from('track_ratings')
          .select('*')
          .eq('user_id', user.id)
          .gte('rating', 8)
          .order('rated_at', { ascending: false });

        // Cache tables (albums_cache/tracks_cache) were removed during the
        // MusicBrainz migration. Auto-playlist rows now render with only the
        // fields present on the rating rows themselves.
        const albumMap = new Map<string, { cover: string | null; artist: string | null; title: string | null }>();
        const durMap = new Map<string, number | null>();

        setTracks(
          (rs ?? []).map((r, idx) => {
            const albumInfo = r.album_deezer_id ? albumMap.get(r.album_deezer_id) : null;
            return {
              position: idx,
              track_deezer_id: r.track_deezer_id ?? '',
              track_title: r.track_title,
              artist_name: albumInfo?.artist ?? null,
              artist_deezer_id: null,
              album_title: albumInfo?.title ?? null,
              album_deezer_id: r.album_deezer_id ?? null,
              cover_url: albumInfo?.cover ?? null,
              duration_seconds: r.track_deezer_id ? durMap.get(r.track_deezer_id) ?? null : null,
            };
          }),
        );
        setLoading(false);
        return;
      }

      // Existing playlist
      const { data: pl } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (pl) setName(pl.name);
      const { data: pts } = await supabase
        .from('playlist_tracks')
        .select('*')
        .eq('playlist_id', id!)
        .order('position');
      setTracks(
        (pts ?? []).map((t) => ({
          id: t.id,
          position: t.position,
          track_deezer_id: t.track_deezer_id,
          track_title: t.track_title,
          artist_name: t.artist_name,
          artist_deezer_id: t.artist_deezer_id,
          album_title: t.album_title,
          album_deezer_id: t.album_deezer_id,
          cover_url: t.cover_url,
          duration_seconds: t.duration_seconds,
        })),
      );
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const addTrack = (t: DeezerTrack | PlaylistTrack) => {
    const candidate: PlaylistTrack =
      'track_deezer_id' in t
        ? (t as PlaylistTrack)
        : {
            position: tracks.length,
            track_deezer_id: String((t as DeezerTrack).id),
            track_title: (t as DeezerTrack).title,
            artist_name: (t as DeezerTrack).artist?.name ?? null,
            artist_deezer_id: (t as DeezerTrack).artist?.id
              ? String((t as DeezerTrack).artist!.id)
              : null,
            album_title: (t as DeezerTrack).album?.title ?? null,
            album_deezer_id: (t as DeezerTrack).album?.id
              ? String((t as DeezerTrack).album!.id)
              : null,
            cover_url: (t as DeezerTrack).album?.cover_xl ?? null,
            duration_seconds: (t as DeezerTrack).duration ?? null,
          };
    if (tracks.some((x) => x.track_deezer_id === candidate.track_deezer_id)) {
      toast({ title: 'Already added', description: candidate.track_title });
      return;
    }
    setTracks((prev) => [...prev, { ...candidate, position: prev.length }]);
    setDirty(true);
  };

  const removeTrack = (deezerId: string) => {
    setTracks((prev) => prev.filter((t) => t.track_deezer_id !== deezerId));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      let playlistId = savedPlaylistId;
      if (!playlistId) {
        const { data, error } = await supabase
          .from('playlists')
          .insert({ user_id: user.id, name })
          .select('id')
          .single();
        if (error) throw error;
        playlistId = data.id;
        setSavedPlaylistId(playlistId);
      } else {
        await supabase.from('playlists').update({ name }).eq('id', playlistId);
        await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId);
      }

      if (tracks.length) {
        const rows = tracks.map((t, idx) => ({
          playlist_id: playlistId!,
          user_id: user.id,
          position: idx,
          track_deezer_id: t.track_deezer_id,
          track_title: t.track_title,
          artist_name: t.artist_name,
          artist_deezer_id: t.artist_deezer_id,
          album_title: t.album_title,
          album_deezer_id: t.album_deezer_id,
          cover_url: t.cover_url,
          duration_seconds: t.duration_seconds,
        }));
        const { error: insErr } = await supabase.from('playlist_tracks').insert(rows);
        if (insErr) throw insErr;
      }

      toast({ title: 'Saved', description: `Playlist \"${name}\" saved.` });
      setDirty(false);
      navigate('/dashboard/playlists');
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading…</div>;
  }

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration_seconds ?? 0), 0);

  return (
    <div>
      <Link
        to="/dashboard/playlists"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> All playlists
      </Link>

      <div className="rounded-2xl border border-border/40 bg-card/40 p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0">
            {isAuto ? (
              <Sparkles className="w-9 h-9 text-primary" />
            ) : (
              <ImageIcon className="w-9 h-9 text-primary/80" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {editingName && !isAuto ? (
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => setEditingName(false)}
                autoFocus
                className="text-2xl md:text-3xl font-boldonse h-auto py-2"
              />
            ) : (
              <button
                onClick={() => !isAuto && setEditingName(true)}
                className="flex items-center gap-3 text-left group"
              >
                <h1 className="text-3xl md:text-4xl font-boldonse">{name}</h1>
                {!isAuto && (
                  <Pencil className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                )}
              </button>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {tracks.length} track{tracks.length === 1 ? '' : 's'}
              {totalDuration > 0 && <> · {Math.round(totalDuration / 60)} min</>}
              {isAuto && <> · Auto-updates from your 8+ ratings</>}
            </p>
          </div>
          {!isAuto && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={!dirty && !isNew}
                className="bg-foreground text-background hover:bg-foreground/90"
              >
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
              <Button variant="secondary" onClick={() => navigate('/dashboard/playlists')}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
            </div>
          )}
        </div>

        {!isAuto && (
          <>
            <h2 className="text-base text-muted-foreground mb-2">Let's add tracks to your playlist</h2>
            <TrackSearch
              onAdd={addTrack}
              existing={tracks.map((t) => t.track_deezer_id)}
            />
          </>
        )}

        {/* Track list */}
        <div className="mt-8">
          <h2 className="text-sm uppercase tracking-[0.18em] text-muted-foreground mb-3">
            In this playlist
          </h2>
          {tracks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
              {isAuto
                ? 'Rate some tracks 8 or above to populate this playlist.'
                : 'Search above and add tracks to get started.'}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {tracks.map((t, i) => (
                <li
                  key={t.track_deezer_id + i}
                  className="flex items-center gap-3 py-3 group"
                >
                  <span className="w-6 text-right text-sm text-muted-foreground">{i + 1}</span>
                  <div className="w-11 h-11 rounded-md bg-secondary flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {t.cover_url ? (
                      <img src={t.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.track_title}</p>
                    <p className="text-sm text-muted-foreground truncate">{t.artist_name}</p>
                  </div>
                  <p className="hidden sm:block text-sm text-muted-foreground truncate max-w-[180px]">
                    {t.album_title}
                  </p>
                  <span className="text-sm text-muted-foreground tabular-nums w-12 text-right">
                    {t.duration_seconds ? formatDuration(t.duration_seconds) : '—'}
                  </span>
                  {!isAuto && (
                    <button
                      onClick={() => removeTrack(t.track_deezer_id)}
                      className="p-2 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Search dropdown – Spotify-style: top tracks + similar artists
// =====================================================================

interface SearchResults {
  tracks: DeezerTrack[];
  topArtist: DeezerArtist | null;
  similarArtists: Array<{ artist: DeezerArtist; topTrack: DeezerTrack | null }>;
}

function TrackSearch({
  onAdd,
  existing,
}: {
  onAdd: (t: DeezerTrack) => void;
  existing: string[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const [tracks, artists] = await Promise.all([
          searchTracks(query, 6),
          searchArtists(query, 1),
        ]);
        const topArtist = artists[0] ?? null;
        let similar: Array<{ artist: DeezerArtist; topTrack: DeezerTrack | null }> = [];
        if (topArtist) {
          const related = await getRelatedArtists(String(topArtist.id), 5);
          similar = await Promise.all(
            related.map(async (a) => {
              const top = await getArtistTopTracks(String(a.id), 1);
              return { artist: a, topTrack: top[0] ?? null };
            }),
          );
        }
        setResults({ tracks, topArtist, similarArtists: similar });
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [query]);

  // Click outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search tracks, artists, albums…"
          className="pl-11 h-12 rounded-xl bg-secondary/60 border-border/40"
        />
      </div>

      {open && (loading || results) && (
        <div className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border border-border/50 bg-popover shadow-xl backdrop-blur max-h-[480px] overflow-y-auto">
          {loading && !results && (
            <div className="p-4 text-sm text-muted-foreground">Searching…</div>
          )}

          {results && results.tracks.length > 0 && (
            <div className="p-2">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Top results
              </p>
              {results.tracks.map((t) => (
                <SearchRow
                  key={`t-${t.id}`}
                  cover={t.album?.cover_xl ?? null}
                  title={t.title}
                  subtitle={`${t.artist?.name ?? ''} · ${t.album?.title ?? ''}`}
                  disabled={existing.includes(String(t.id))}
                  onAdd={() => onAdd(t)}
                />
              ))}
            </div>
          )}

          {results && results.similarArtists.length > 0 && (
            <div className="p-2 border-t border-border/40">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Similar to {results.topArtist?.name}
              </p>
              {results.similarArtists.map(({ artist, topTrack }) =>
                topTrack ? (
                  <SearchRow
                    key={`a-${artist.id}`}
                    cover={pickArtistImage(artist) ?? topTrack.album?.cover_xl ?? null}
                    title={topTrack.title}
                    subtitle={`${artist.name} · top track`}
                    rounded
                    disabled={existing.includes(String(topTrack.id))}
                    onAdd={() => onAdd(topTrack)}
                  />
                ) : null,
              )}
            </div>
          )}

          {results && results.tracks.length === 0 && results.similarArtists.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No results.</div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchRow({
  cover,
  title,
  subtitle,
  rounded,
  disabled,
  onAdd,
}: {
  cover: string | null;
  title: string;
  subtitle: string;
  rounded?: boolean;
  disabled?: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/60">
      <div
        className={`w-10 h-10 ${
          rounded ? 'rounded-full' : 'rounded-md'
        } overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center`}
      >
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={disabled}
        className="p-2 rounded-full hover:bg-primary/20 text-primary disabled:text-muted-foreground disabled:hover:bg-transparent"
        aria-label="Add"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
