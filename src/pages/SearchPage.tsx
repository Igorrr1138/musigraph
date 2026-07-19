import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Disc3, User, Music2, Users, Loader2, Calendar } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import {
  searchArtistsMB,
  searchReleaseGroupsMB,
  searchRecordingsMB,
  type MbArtistSearchResult,
  type MbReleaseGroupSearchResult,
  type MbRecordingSearchResult,
} from '@/lib/musicbrainz';
import { lookupArtistCover, lookupAlbumCover, type CoverRef } from '@/lib/deezerCover';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'artists' | 'albums' | 'songs';

const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'all', label: 'All', icon: User },
  { id: 'artists', label: 'Artists', icon: Users },
  { id: 'albums', label: 'Albums', icon: Disc3 },
  { id: 'songs', label: 'Songs', icon: Music2 },
];

function formatMs(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();

  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<MbArtistSearchResult[]>([]);
  const [albums, setAlbums] = useState<MbReleaseGroupSearchResult[]>([]);
  const [tracks, setTracks] = useState<MbRecordingSearchResult[]>([]);

  useEffect(() => {
    if (!query) {
      setArtists([]); setAlbums([]); setTracks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      searchArtistsMB(query, 12),
      searchReleaseGroupsMB(query, 12),
      searchRecordingsMB(query, 20),
    ]).then(([a, al, tr]) => {
      if (cancelled) return;
      setArtists(a); setAlbums(al); setTracks(tr);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const topArtist = artists[0] ?? null;
  const total = artists.length + albums.length + tracks.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 pt-28 pb-32 max-w-7xl">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Search result for:
          </p>
          <h1 className="font-boldonse text-5xl md:text-6xl tracking-wide">
            &ldquo;{query || '—'}&rdquo;
          </h1>
        </div>

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
        <div className={cn(
          "grid gap-10",
          tab === 'all' || tab === 'artists'
            ? "grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
            : "grid-cols-1"
        )}>
          {(tab === 'all' || tab === 'artists') && (
            <aside className="lg:sticky lg:top-24 self-start">
              {topArtist ? (
                <TopResultCard artist={topArtist} trackCount={tracks.length} albumCount={albums.length} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border/40 p-6 text-sm text-muted-foreground">
                  No top result.
                </div>
              )}
            </aside>
          )}

            <div className="space-y-14 min-w-0">
              {(tab === 'all' || tab === 'songs') && (
                <Section title="Songs" onSeeAll={tracks.length > 6 && tab === 'all' ? () => setTab('songs') : undefined}>
                  <ul className="divide-y divide-border/30">
                    {(tab === 'all' ? tracks.slice(0, 7) : tracks).map((t) => (
                      <SongRow key={t.mbid} track={t} />
                    ))}
                    {tracks.length === 0 && <EmptyRow label="No songs found." />}
                  </ul>
                </Section>
              )}

              {(tab === 'all' || tab === 'artists') && (
                <Section title="Artists" onSeeAll={artists.length > 3 && tab === 'all' ? () => setTab('artists') : undefined}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {(tab === 'all' ? artists.slice(1, 4) : artists).map((a) => (
                      <ArtistResultCard key={a.mbid} artist={a} />
                    ))}
                    {artists.length === 0 && <EmptyRow label="No artists found." />}
                  </div>
                </Section>
              )}

              {(tab === 'all' || tab === 'albums') && (
              <Section title="Albums" onSeeAll={albums.length > 4 && tab === 'all' ? () => setTab('albums') : undefined}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {(tab === 'all' ? albums.slice(0, 4) : albums).map((al) => (
                    <AlbumResultCard key={al.mbid} album={al} />
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

function useArtistCover(name: string) {
  const [ref, setRef] = useState<CoverRef | null>(null);
  useEffect(() => {
    let cancelled = false;
    lookupArtistCover(name).then((r) => { if (!cancelled) setRef(r); });
    return () => { cancelled = true; };
  }, [name]);
  return ref;
}

function useAlbumCover(title: string, artist?: string) {
  const [ref, setRef] = useState<CoverRef | null>(null);
  useEffect(() => {
    let cancelled = false;
    lookupAlbumCover(title, artist).then((r) => { if (!cancelled) setRef(r); });
    return () => { cancelled = true; };
  }, [title, artist]);
  return ref;
}

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
  trackCount,
  albumCount,
}: {
  artist: MbArtistSearchResult;
  trackCount: number;
  albumCount: number;
}) {
  const cover = useArtistCover(artist.name);
  const to = cover ? `/artist/${cover.deezerId}` : '#';
  return (
    <div>
      <h2 className="font-boldonse text-2xl mb-5 tracking-wide">Top result</h2>
      <Link
        to={to}
        className="block rounded-3xl border border-border/50 bg-card/40 p-5 hover:border-primary/50 transition-colors"
      >
        <div className="aspect-square w-full rounded-2xl overflow-hidden bg-secondary mb-5 relative">
          {cover?.coverUrl ? (
            <img src={cover.coverUrl} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
          <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs uppercase tracking-wider">
            Artist
          </span>
        </div>
        <h3 className="font-boldonse text-3xl mb-2 line-clamp-2">{artist.name}</h3>
        {artist.disambiguation && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{artist.disambiguation}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {artist.country && <span>{artist.country}</span>}
          {albumCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Disc3 className="w-3.5 h-3.5" /> {albumCount} albums
            </span>
          )}
          {trackCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5" /> {trackCount} tracks
            </span>
          )}
        </div>
        {artist.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {artist.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}

function SongRow({ track }: { track: MbRecordingSearchResult }) {
  const cover = useAlbumCover(track.releaseTitle ?? track.title, track.artistName);
  const albumHref = cover ? `/album/${cover.deezerId}` : '#';
  return (
    <li className="flex items-center gap-4 py-3 group">
      <Link
        to={albumHref}
        className="w-11 h-11 rounded-lg bg-secondary overflow-hidden flex items-center justify-center shrink-0"
      >
        {cover?.coverUrl ? (
          <img src={cover.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Music2 className="w-5 h-5 text-muted-foreground" />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate group-hover:text-primary transition-colors">{track.title}</p>
        {track.artistName && (
          <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
        )}
      </div>
      {track.releaseTitle && (
        <Link
          to={albumHref}
          className="hidden md:block text-sm text-muted-foreground truncate max-w-[200px] hover:text-foreground"
        >
          {track.releaseTitle}
        </Link>
      )}
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
        {formatMs(track.lengthMs)}
      </span>
    </li>
  );
}

function ArtistResultCard({ artist }: { artist: MbArtistSearchResult }) {
  const cover = useArtistCover(artist.name);
  const to = cover ? `/artist/${cover.deezerId}` : '#';
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border/40 bg-card/30 p-4 hover:border-primary/50 transition-colors"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-secondary mb-3">
        {cover?.coverUrl ? (
          <img
            src={cover.coverUrl}
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
      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
        {artist.disambiguation || (artist.country ? `Artist · ${artist.country}` : 'Artist')}
      </p>
    </Link>
  );
}

function AlbumResultCard({ album }: { album: MbReleaseGroupSearchResult }) {
  const cover = useAlbumCover(album.title, album.artistName);
  const to = cover ? `/album/${cover.deezerId}` : '#';
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border/40 bg-card/30 p-4 hover:border-primary/50 transition-colors"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-secondary mb-3 relative">
        {cover?.coverUrl ? (
          <img
            src={cover.coverUrl}
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
          {album.primaryType ?? 'Album'}
        </span>
      </div>
      <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
        {album.title}
      </h3>
      {album.artistName && (
        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{album.artistName}</p>
      )}
      {album.year && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Calendar className="w-3 h-3" />
          {album.year}
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
