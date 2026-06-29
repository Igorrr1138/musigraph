import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Disc3, User, Music2, ListMusic, Calendar, Users, MapPin, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { AddToPlaylistButton } from '@/components/music/AddToPlaylistButton';
import {
  searchArtists,
  searchAlbums,
  searchTracks,
  pickArtistImage,
  pickAlbumCover,
  formatDuration,
  type DeezerArtist,
  type DeezerAlbum,
  type DeezerTrack,
} from '@/lib/deezer';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'artists' | 'albums' | 'songs';

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'all', label: 'All', icon: User },
  { id: 'artists', label: 'Artists', icon: Users },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'songs', label: 'Songs', icon: Music2 },
];

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();

  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<DeezerArtist[]>([]);
  const [albums, setAlbums] = useState<DeezerAlbum[]>([]);
  const [tracks, setTracks] = useState<DeezerTrack[]>([]);

  useEffect(() => {
    if (!query) {
      setArtists([]); setAlbums([]); setTracks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      searchArtists(query, 12),
      searchAlbums(query, 12),
      searchTracks(query, 20),
    ]).then(([a, al, tr]) => {
      if (cancelled) return;
      setArtists(a); setAlbums(al); setTracks(tr);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [query]);

  const topArtist = artists[0] ?? null;
  const total = artists.length + albums.length + tracks.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 pt-28 pb-32 max-w-7xl">
        {/* Heading */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Search result for:
          </p>
          <h1 className="font-boldonse text-5xl md:text-6xl tracking-wide">
            “{query || '—'}”
          </h1>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/40 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto">
            {TABS.map(t => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.18em] border-b-2 -mb-px transition-colors',
                    active
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-8">
          {loading ? 'Searching…' : `About ${total} results for "${query}"`}
        </p>

        {loading && total === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-10">
            {/* LEFT — Top result (sticky) */}
            <aside className="lg:sticky lg:top-24 self-start">
              {topArtist && (tab === 'all' || tab === 'artists') ? (
                <TopResultCard artist={topArtist} albumCount={albums.length} trackCount={tracks.length} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/40 p-6 text-sm text-muted-foreground">
                  No top result.
                </div>
              )}
            </aside>

            {/* RIGHT — Content */}
            <div className="space-y-14 min-w-0">
              {(tab === 'all' || tab === 'songs') && (
                <Section title="Songs" onSeeAll={tracks.length > 6 && tab === 'all' ? () => setTab('songs') : undefined}>
                  <ul className="divide-y divide-border/30">
                    {(tab === 'all' ? tracks.slice(0, 7) : tracks).map((t) => (
                      <SongRow key={t.id} track={t} />
                    ))}
                    {tracks.length === 0 && <EmptyRow label="No songs found." />}
                  </ul>
                </Section>
              )}

              {(tab === 'all' || tab === 'artists') && (
                <Section title="Artists" onSeeAll={artists.length > 3 && tab === 'all' ? () => setTab('artists') : undefined}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(tab === 'all' ? artists.slice(1, 4) : artists).map((a) => (
                      <ArtistResultCard key={a.id} artist={a} />
                    ))}
                    {artists.length === 0 && <EmptyRow label="No artists found." />}
                  </div>
                </Section>
              )}

              {(tab === 'all' || tab === 'albums') && (
                <Section title="Albums" onSeeAll={albums.length > 3 && tab === 'all' ? () => setTab('albums') : undefined}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(tab === 'all' ? albums.slice(0, 3) : albums).map((al) => (
                      <AlbumResultCard key={al.id} album={al} />
                    ))}
                    {albums.length === 0 && <EmptyRow label="No albums found." />}
                  </div>
                </Section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Section({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-end justify-between mb-5">
        <h2 className="font-boldonse text-2xl tracking-wide">{title}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function TopResultCard({
  artist,
  albumCount,
  trackCount,
}: {
  artist: DeezerArtist;
  albumCount: number;
  trackCount: number;
}) {
  const img = pickArtistImage(artist);
  return (
    <div>
      <h2 className="font-boldonse text-2xl mb-5 tracking-wide">Top result</h2>
      <Link
        to={`/artist/${artist.id}`}
        className="block rounded-3xl border border-border/50 bg-card/40 p-5 hover:border-primary/50 transition-colors"
      >
        <div className="aspect-square w-full rounded-2xl overflow-hidden bg-secondary mb-5 relative">
          {img ? (
            <img src={img} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs uppercase tracking-wider">
            Artist
          </span>
        </div>
        <h3 className="font-boldonse text-3xl mb-3 line-clamp-2">{artist.name}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {typeof artist.nb_album === 'number' && artist.nb_album > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Disc3 className="w-3.5 h-3.5" /> {artist.nb_album} Albums
            </span>
          )}
          {typeof artist.nb_fan === 'number' && artist.nb_fan > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> {artist.nb_fan.toLocaleString()} fans
            </span>
          )}
          {trackCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5" /> {trackCount} tracks
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}

function SongRow({ track }: { track: DeezerTrack }) {
  const cover = track.album?.cover_xl ?? null;
  return (
    <li className="flex items-center gap-4 py-3 group">
      <Link
        to={track.album?.id ? `/album/${track.album.id}` : '#'}
        className="w-11 h-11 rounded-lg bg-secondary overflow-hidden flex items-center justify-center shrink-0"
      >
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Music2 className="w-5 h-5 text-muted-foreground" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate group-hover:text-primary transition-colors">{track.title}</p>
        {track.artist?.name && (
          <Link
            to={`/artist/${track.artist.id}`}
            className="text-xs text-muted-foreground hover:text-foreground truncate block"
          >
            {track.artist.name}
          </Link>
        )}
      </div>
      <Link
        to={track.album?.id ? `/album/${track.album.id}` : '#'}
        className="hidden md:block text-sm text-muted-foreground truncate max-w-[200px] hover:text-foreground"
      >
        {track.album?.title}
      </Link>
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
        {formatDuration(track.duration)}
      </span>
      <AddToPlaylistButton
        track={track}
        artistName={track.artist?.name}
        albumTitle={track.album?.title}
        albumDeezerId={track.album?.id ? String(track.album.id) : undefined}
        coverUrl={cover}
      />
    </li>
  );
}

function ArtistResultCard({ artist }: { artist: DeezerArtist }) {
  const img = pickArtistImage(artist);
  return (
    <Link
      to={`/artist/${artist.id}`}
      className="group rounded-2xl border border-border/40 bg-card/30 p-4 hover:border-primary/50 transition-colors"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-secondary mb-3">
        {img ? (
          <img
            src={img}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
      </div>
      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
        {artist.name}
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">Artist</p>
    </Link>
  );
}

function AlbumResultCard({ album }: { album: DeezerAlbum }) {
  const cover = pickAlbumCover(album);
  return (
    <Link
      to={`/album/${album.id}`}
      className="group rounded-2xl border border-border/40 bg-card/30 p-4 hover:border-primary/50 transition-colors"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-secondary mb-3 relative">
        {cover ? (
          <img
            src={cover}
            alt={album.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Disc3 className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm text-[10px] uppercase tracking-wider">
          Album
        </span>
      </div>
      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
        {album.title}
      </h3>
      {album.artist?.name && (
        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{album.artist.name}</p>
      )}
      {album.release_date && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Calendar className="w-3 h-3" />
          {album.release_date.split('-')[0]}
        </div>
      )}
    </Link>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/40 rounded-xl">
      {label}
    </div>
  );
}
