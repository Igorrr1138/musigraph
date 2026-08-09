import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from '@/components/icons';
import { useGenreCovers } from '@/hooks/useGenreCovers';
import type { GenreEntry, ResolvedEntry } from '@/lib/genreDiscovery';

export interface GenreArtistGridProps {
  entries: ReadonlyArray<GenreEntry>;
  isLoading: boolean;
}

function ArtistTile({ entry, resolved }: { entry: GenreEntry; resolved?: ResolvedEntry }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pending = !resolved;
  const cover = !failed ? resolved?.imageUrl ?? null : null;
  const href = resolved?.mbid ? `/artist/${resolved.mbid}` : null;

  const body = (
    <div className="relative overflow-hidden rounded-2xl bg-card border border-border/50 transition-all duration-300 hover:border-primary/50">
      <div className="aspect-square relative overflow-hidden bg-secondary">
        {pending ? (
          <div className="absolute inset-0 animate-pulse bg-card/60" />
        ) : cover ? (
          <img
            src={cover}
            alt={entry.name}
            loading="lazy"
            onError={() => setFailed(true)}
            onLoad={() => setLoaded(true)}
            ref={el => { if (el?.complete && el.naturalWidth > 0) setLoaded(true); }}
            className={`w-full h-full object-cover transition-opacity duration-300 group-hover:scale-110 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary to-card">
            <User className="w-12 h-12 text-muted-foreground/60" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {entry.tag}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
          {entry.name}
        </h3>
      </div>
    </div>
  );

  return href ? (
    <Link to={href} className="block group">
      {body}
    </Link>
  ) : (
    <div className="block group cursor-default">{body}</div>
  );
}

function GenreArtistGridImpl({ entries, isLoading }: GenreArtistGridProps) {
  const resolved = useGenreCovers(entries);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        aria-busy="true"
        aria-label="Loading artists"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-2xl bg-card/40 border border-border/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No artists match those filters yet. Try widening the decade or clearing the country filter.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {entries.map(entry => (
        <ArtistTile key={entry.key} entry={entry} resolved={resolved[entry.key]} />
      ))}
    </div>
  );
}

export const GenreArtistGrid = memo(GenreArtistGridImpl);
