import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  getSubGenresForCategory,
  parentCategorySlug,
  formatTagLabel,
  type GenreCategory,
} from '@/lib/genreMap';
import { genreFromTag } from '@/lib/genreWhitelist';
import { cn } from '@/lib/utils';

export interface SubGenrePillsProps {
  parent: Exclude<GenreCategory, 'Various'>;
  /** Currently active sub-genre slug, or null when the "All {parent}" pill is active. */
  activeSlug: string | null;
}

/**
 * Sub-genre pill bar shown directly below the parent tile row. The first
 * pill is always "All {Parent}" and routes back to /genre/{parentSlug}.
 */
function SubGenrePillsImpl({ parent, activeSlug }: SubGenrePillsProps) {
  const parentSlug = parentCategorySlug(parent);
  const subs = getSubGenresForCategory(parent)
    .map(tag => genreFromTag(tag))
    .filter((g): g is NonNullable<ReturnType<typeof genreFromTag>> => Boolean(g))
    // Hide the parent itself if it appears in its own list.
    .filter(g => g.slug !== parentSlug);

  const allActive = !activeSlug || activeSlug === parentSlug;

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={`${parent} sub-genres`}>
      <Link
        to={`/genre/${parentSlug}`}
        role="tab"
        aria-selected={allActive}
        className={cn(
          'px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider transition-colors border',
          allActive
            ? 'bg-foreground text-background border-foreground'
            : 'bg-transparent text-muted-foreground border-border/50 hover:border-foreground/50 hover:text-foreground',
        )}
      >
        All {parent}
      </Link>
      {subs.map(g => {
        const isActive = activeSlug === g.slug;
        return (
          <Link
            key={g.slug}
            to={`/genre/${g.slug}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'px-4 py-1.5 rounded-full text-xs font-medium transition-colors border',
              isActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border/50 hover:border-foreground/50 hover:text-foreground',
            )}
          >
            {formatTagLabel(g.label)}
          </Link>
        );
      })}
    </div>
  );
}

export const SubGenrePills = memo(SubGenrePillsImpl);
