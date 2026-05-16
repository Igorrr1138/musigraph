import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ALL_WHITELISTED_GENRES } from '@/lib/genreWhitelist';

/**
 * Genre autocomplete search. Filters our whitelist client-side -- there's
 * no remote search since the taxonomy is fixed and small (~80 entries).
 * Picking a result navigates to /genre/:slug.
 */
function GenreSearchBarImpl() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_WHITELISTED_GENRES.filter(g => g.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  function go(slug: string) {
    setQuery('');
    setOpen(false);
    navigate(`/genre/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && matches[0]) {
      e.preventDefault();
      go(matches[0].slug);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="Search a genre… e.g. Free Jazz"
          className="w-full pl-11 pr-4 py-2.5 rounded-full bg-card/60 border border-border/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
          aria-label="Search genres"
        />
      </div>
      {open && matches.length > 0 && (
        <ul
          className="absolute z-20 mt-2 w-full rounded-xl bg-popover border border-border/60 shadow-lg overflow-hidden"
          role="listbox"
        >
          {matches.map(g => (
            <li key={g.slug}>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault();
                  go(g.slug);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent/40 flex items-center justify-between"
              >
                <span>{g.label}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {g.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const GenreSearchBar = memo(GenreSearchBarImpl);
