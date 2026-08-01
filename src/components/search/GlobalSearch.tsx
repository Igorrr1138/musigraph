import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Clock, User, Disc3, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  searchArtistsMB,
  searchReleaseGroupsMB,
  coverArtArchiveReleaseGroupUrl,
  type MbArtistSearchResult,
  type MbReleaseGroupSearchResult,
} from '@/lib/musicbrainz';
import { useRecentSearches, type RecentSearchItem } from '@/hooks/useRecentSearches';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  placeholder?: string;
  className?: string;
}

/**
 * Deezer-style search field: focus with an empty query shows the persisted
 * "Recent searches" panel, typing swaps it for live MusicBrainz autocomplete.
 */
export function GlobalSearch({
  placeholder = 'Search artists, albums, tracks...',
  className,
}: GlobalSearchProps) {
  const navigate = useNavigate();
  const { items: recent, add, remove, clear } = useRecentSearches();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState<MbArtistSearchResult[]>([]);
  const [albums, setAlbums] = useState<MbReleaseGroupSearchResult[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const showLive = trimmed.length > 0;

  /* Close on outside click + Escape */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Debounced live autocomplete */
  useEffect(() => {
    if (!showLive) {
      setArtists([]);
      setAlbums([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      Promise.all([searchArtistsMB(trimmed, 4), searchReleaseGroupsMB(trimmed, 4)])
        .then(([a, al]) => {
          if (cancelled) return;
          setArtists(a);
          setAlbums(al);
        })
        .catch(() => {
          if (!cancelled) {
            setArtists([]);
            setAlbums([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, showLive]);

  const runQuery = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      add({ id: `query:${q.toLowerCase()}`, type: 'query', label: q });
      setQuery(q);
      setOpen(false);
      inputRef.current?.blur();
      navigate(`/search?q=${encodeURIComponent(q)}`);
    },
    [add, navigate],
  );

  const goEntity = useCallback(
    (item: RecentSearchItem) => {
      add(item);
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
      if (item.href) navigate(item.href);
    },
    [add, navigate],
  );

  const hasLiveResults = artists.length > 0 || albums.length > 0;

  const panel = useMemo(() => {
    if (showLive) {
      return (
        <div className="py-2">
          {loading && !hasLiveResults && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && !hasLiveResults && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No results found</p>
          )}
          {artists.length > 0 && (
            <>
              <p className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Artists
              </p>
              {artists.map((a) => (
                <Row
                  key={a.mbid}
                  icon={<User className="w-4 h-4 text-muted-foreground" />}
                  label={a.name}
                  subtitle={a.disambiguation || a.country || 'Artist'}
                  onClick={() =>
                    goEntity({
                      id: `artist:${a.mbid}`,
                      type: 'artist',
                      label: a.name,
                      subtitle: a.disambiguation || 'Artist',
                      href: `/artist/${a.mbid}`,
                    })
                  }
                />
              ))}
            </>
          )}
          {albums.length > 0 && (
            <>
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Albums
              </p>
              {albums.map((al) => (
                <Row
                  key={al.mbid}
                  imageUrl={coverArtArchiveReleaseGroupUrl(al.mbid, 250)}
                  icon={<Disc3 className="w-4 h-4 text-muted-foreground" />}
                  label={al.title}
                  subtitle={[al.artistName, al.year].filter(Boolean).join(' · ') || 'Album'}
                  onClick={() =>
                    goEntity({
                      id: `album:${al.mbid}`,
                      type: 'album',
                      label: al.title,
                      subtitle: al.artistName ?? undefined,
                      imageUrl: coverArtArchiveReleaseGroupUrl(al.mbid, 250),
                      href: `/album/${al.mbid}`,
                    })
                  }
                />
              ))}
            </>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runQuery(trimmed)}
            className="mt-2 w-full px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground border-t border-border/40 transition-colors"
          >
            See all results for “{trimmed}”
          </button>
        </div>
      );
    }

    return (
      <div className="py-2">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Recent searches
          </span>
          {recent.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No recent searches</p>
        ) : (
          <ul>
            {recent.map((item) => (
              <li key={item.id}>
                <Row
                  imageUrl={item.imageUrl ?? undefined}
                  icon={
                    item.type === 'artist' ? (
                      <User className="w-4 h-4 text-muted-foreground" />
                    ) : item.type === 'album' ? (
                      <Disc3 className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )
                  }
                  label={item.label}
                  subtitle={item.subtitle}
                  onClick={() => (item.href ? goEntity(item) : runQuery(item.label))}
                  onRemove={() => remove(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }, [showLive, loading, hasLiveResults, artists, albums, recent, clear, remove, goEntity, runQuery, trimmed]);

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runQuery(query);
        }}
      >
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            aria-label="Search music"
            className="w-full h-10 pl-10 pr-10 rounded-full bg-secondary/60 border border-border/40 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-secondary transition-colors"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background/60 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-border/50 bg-popover/85 backdrop-blur-xl shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto"
          >
            {panel}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  icon,
  imageUrl,
  label,
  subtitle,
  onClick,
  onRemove,
}: {
  icon: React.ReactNode;
  imageUrl?: string;
  label: string;
  subtitle?: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="flex items-center gap-3 min-w-0 flex-1 text-left"
      >
        <span className="w-9 h-9 rounded-lg bg-secondary/80 overflow-hidden flex items-center justify-center shrink-0">
          {imageUrl && imgOk ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              onError={() => setImgOk(false)}
              className="w-full h-full object-cover"
            />
          ) : (
            icon
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm truncate">{label}</span>
          {subtitle && (
            <span className="block text-xs text-muted-foreground truncate">{subtitle}</span>
          )}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label} from recent searches`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-background/60 transition-opacity shrink-0"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
