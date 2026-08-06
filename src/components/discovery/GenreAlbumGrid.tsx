import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Disc3 } from 'lucide-react';
import { useGenreCovers } from '@/hooks/useGenreCovers';
import type { GenreEntry, ResolvedEntry } from '@/lib/genreDiscovery';

export interface GenreAlbumGridProps {
  entries: ReadonlyArray<GenreEntry>;
  isLoading: boolean;
}

function AlbumTile({ entry, resolved }: { entry: GenreEntry; resolved?: ResolvedEntry }) {
  const [failed, setFailed] = useState(false);
  const pending = !resolved;
  const cover = !failed ? resolved?.imageUrl ?? null : null;

  const href = resolved?.mbid
    ? `/album/${resolved.mbid}${entry.artistName ? `?artistName=${encodeURIComponent(entry.artistName)}` : ''}`
    : null;

  const body = (
    <div className="album-card">
      <div className="aspect-square relative overflow-hidden rounded-xl bg-secondary">
        {pending ? (
          <div className="absolute inset-0 animate-pulse bg-card/60" />
        ) : cover ? (
          <img
            src={cover}
            alt={entry.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover opacity-0 transition-opacity duration-300 group-hover:scale-110"
            onLoad={e => e.currentTarget.classList.remove('opacity-0')}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-secondary to-card">
            <Disc3 className="w-12 h-12 text-muted-foreground/60" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {entry.tag}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
          {entry.name}
        </h3>
        {entry.artistName && (
          <p className="text-sm text-muted-foreground line-clamp-1">{entry.artistName}</p>
        )}
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

function GenreAlbumGridImpl({ entries, isLoading }: GenreAlbumGridProps) {
  const resolved = useGenreCovers(entries);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        aria-busy="true"
        aria-label="Loading albums"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-card/40 border border-border/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No albums match those filters yet. Try a broader genre or clear the filters.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {entries.map(entry => (
        <AlbumTile key={entry.key} entry={entry} resolved={resolved[entry.key]} />
      ))}
    </div>
  );
}

export const GenreAlbumGrid = memo(GenreAlbumGridImpl);
