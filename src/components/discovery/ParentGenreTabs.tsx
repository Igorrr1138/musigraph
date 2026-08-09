import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Music2, Mic2, Cpu, Radio, Disc3, Piano, Guitar, Drum, Flame, Headphones, Sparkles, Activity } from '@/components/icons';
import { PARENT_CATEGORIES, parentCategorySlug } from '@/lib/genreMap';
import { cn } from '@/lib/utils';

/**
 * Icon per parent category. Picked to be evocative rather than literal --
 * mainly so the tile has visual rhythm before any imagery loads.
 */
const ICONS = {
  Rock: Guitar,
  Metal: Flame,
  Electronic: Cpu,
  'Hip-Hop': Mic2,
  Pop: Sparkles,
  Jazz: Piano,
  'R&B/Soul': Disc3,
  'Folk/Acoustic': Music2,
  Country: Radio,
  Reggae: Headphones,
  Classical: Activity,
  Experimental: Drum,
} as const;

export interface ParentGenreTabsProps {
  /** Currently active parent slug (e.g. "rock"), or null when nothing picked. */
  activeParentSlug: string | null;
}

function ParentGenreTabsImpl({ activeParentSlug }: ParentGenreTabsProps) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x"
      role="tablist"
      aria-label="Parent genres"
    >
      {PARENT_CATEGORIES.map(cat => {
        const slug = parentCategorySlug(cat);
        const isActive = activeParentSlug === slug;
        const Icon = ICONS[cat];
        return (
          <Link
            key={slug}
            to={`/genre/${slug}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'snap-start flex-shrink-0 w-32 md:w-36 aspect-square rounded-2xl border transition-all',
              'flex flex-col items-center justify-center gap-2 text-center px-3',
              isActive
                ? 'bg-primary/15 border-primary text-primary shadow-[0_0_30px_-10px_hsl(var(--primary)/0.6)]'
                : 'bg-card/40 border-border/40 text-foreground/80 hover:border-primary/40 hover:bg-card/60',
            )}
          >
            <Icon className={cn('w-8 h-8', isActive ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-semibold uppercase tracking-wide leading-tight">
              {cat}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export const ParentGenreTabs = memo(ParentGenreTabsImpl);
