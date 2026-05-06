import { memo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Decade buckets for the discovery filter, 1950s through 2020s. The value
 * is the first year of the decade so it round-trips cleanly to a number
 * downstream in genreDiscovery.ts.
 */
const DECADES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'all', label: 'All decades' },
  { value: '1950', label: '1950s' },
  { value: '1960', label: '1960s' },
  { value: '1970', label: '1970s' },
  { value: '1980', label: '1980s' },
  { value: '1990', label: '1990s' },
  { value: '2000', label: '2000s' },
  { value: '2010', label: '2010s' },
  { value: '2020', label: '2020s' },
];

const SORTS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export interface GenreFiltersProps {
  /** Country options offered to the user, in display form (e.g. "US"). */
  countries: ReadonlyArray<string>;
}

function GenreFiltersImpl({ countries }: GenreFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const country = searchParams.get('country') ?? 'all';
  const decade = searchParams.get('decade') ?? 'all';
  const sort = searchParams.get('sort') ?? 'top';

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      // `replace: true` keeps filter changes out of the back-button history
      // so users don't have to mash Back to escape an over-filtered view.
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div
      className="flex flex-wrap items-center gap-3 mb-8"
      role="toolbar"
      aria-label="Genre discovery filters"
    >
      <Select value={country} onValueChange={v => update('country', v)}>
        <SelectTrigger className="w-[160px] uppercase tracking-wider text-xs">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All countries</SelectItem>
          {countries.map(c => (
            <SelectItem key={c} value={c.toLowerCase()}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={decade} onValueChange={v => update('decade', v)}>
        <SelectTrigger className="w-[160px] uppercase tracking-wider text-xs">
          <SelectValue placeholder="Decade" />
        </SelectTrigger>
        <SelectContent>
          {DECADES.map(d => (
            <SelectItem key={d.value} value={d.value}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={v => update('sort', v)}>
        <SelectTrigger className="w-[160px] uppercase tracking-wider text-xs">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map(s => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const GenreFilters = memo(GenreFiltersImpl);
