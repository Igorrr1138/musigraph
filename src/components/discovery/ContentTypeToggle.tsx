import { memo } from 'react';
import { cn } from '@/lib/utils';

export type DiscoveryContentType = 'artists' | 'albums';

export interface ContentTypeToggleProps {
  value: DiscoveryContentType;
  onChange: (next: DiscoveryContentType) => void;
}

/**
 * Two-state pill toggle for switching the discovery grid between
 * Last.fm `tag.getTopArtists` and `tag.getTopAlbums` results.
 */
function ContentTypeToggleImpl({ value, onChange }: ContentTypeToggleProps) {
  const opts: Array<{ id: DiscoveryContentType; label: string }> = [
    { id: 'artists', label: 'Top Artists' },
    { id: 'albums', label: 'Top Albums' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Content type"
      className="inline-flex p-1 rounded-full bg-card/60 border border-border/50"
    >
      {opts.map(o => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const ContentTypeToggle = memo(ContentTypeToggleImpl);
