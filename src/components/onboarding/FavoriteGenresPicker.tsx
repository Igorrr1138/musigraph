import { useMemo, useRef, useState, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ALL_WHITELISTED_GENRES, genreFromTag, type WhitelistedGenre } from '@/lib/genreWhitelist';
import { GENRE_DATABASE, type GenreCategory } from '@/lib/genreMap';

const MAX_GENRES = 5;

const STARTER_KEYS = ['rock', 'pop', 'hip-hop', 'electronic', 'jazz', 'classical'];

const STARTER_LABEL: Record<string, string> = {
  'hip-hop': 'Hip-Hop & Rap',
};

function displayLabel(key: string): string {
  return STARTER_LABEL[key] ?? genreFromTag(key)?.label ?? key;
}

export interface FavoriteGenresPickerProps {
  initial: string[];
  onSave: (genres: string[]) => Promise<void> | void;
  onSkip?: () => Promise<void> | void;
  saveLabel?: string;
  /** Floats the action buttons over the viewport (onboarding). Otherwise inline. */
  floatingActions?: boolean;
}

export function FavoriteGenresPicker({
  initial,
  onSave,
  onSkip,
  saveLabel = 'Save and proceed',
  floatingActions = false,
}: FavoriteGenresPickerProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>(() => [...initial]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Most recently selected genre drives Related genres
  const lastSelectedKey = selected[selected.length - 1];
  const lastCategory: GenreCategory | null = useMemo(() => {
    if (!lastSelectedKey) return null;
    return genreFromTag(lastSelectedKey)?.category ?? null;
  }, [lastSelectedKey]);

  const relatedGenres: WhitelistedGenre[] = useMemo(() => {
    if (!lastCategory || lastCategory === 'Various') return [];
    const tags = GENRE_DATABASE[lastCategory as Exclude<GenreCategory, 'Various'>] ?? [];
    const out: WhitelistedGenre[] = [];
    const seen = new Set(selected);
    for (const t of tags) {
      const g = genreFromTag(t);
      if (!g) continue;
      if (seen.has(g.key)) continue;
      if (g.key === lastCategory.toLowerCase()) continue;
      out.push(g);
      if (out.length >= 6) break;
    }
    return out;
  }, [lastCategory, selected]);

  const suggestions: WhitelistedGenre[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: WhitelistedGenre[] = [];
    const contains: WhitelistedGenre[] = [];
    for (const g of ALL_WHITELISTED_GENRES) {
      if (g.label.toLowerCase().startsWith(q)) starts.push(g);
      else if (g.label.toLowerCase().includes(q)) contains.push(g);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query]);

  const showStarterTiles = selected.length === 0;

  const add = (key: string) => {
    if (selected.includes(key)) return;
    if (selected.length >= MAX_GENRES) {
      toast({
        title: 'Limit reached',
        description: `You can pick up to ${MAX_GENRES} favorite genres.`,
      });
      return;
    }
    setSelected(prev => [...prev, key]);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const remove = (key: string) => {
    setSelected(prev => prev.filter(k => k !== key));
  };

  const toggle = (key: string) => {
    if (selected.includes(key)) remove(key);
    else add(key);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    setSkipping(true);
    try {
      await onSkip();
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className="w-full">
      {/* Title */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-boldonse mb-3">Favorite genres</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Choose up to {MAX_GENRES} genres. You can always change them in your preferences.
        </p>
      </div>

      {/* Search */}
      <div ref={wrapRef} className="relative max-w-xl mx-auto mb-10">
        <div className="relative">
          <Input
            ref={inputRef}
            aria-label="Search genres"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => query && setOpen(true)}
            placeholder="Search genres…"
            className="pl-4 pr-11 h-12 rounded-full bg-secondary/60 border-border/60"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        </div>

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full mt-2 z-20 rounded-2xl border border-border/60 bg-popover shadow-xl overflow-hidden"
          >
            {suggestions.map(g => {
              const isSelected = selected.includes(g.key);
              return (
                <li key={g.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => add(g.key)}
                    disabled={isSelected}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between',
                      isSelected
                        ? 'text-muted-foreground cursor-not-allowed'
                        : 'hover:bg-secondary text-foreground',
                    )}
                  >
                    <span>{g.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tiles */}
      <div className="mb-10">
        {showStarterTiles ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {STARTER_KEYS.map(key => (
              <GenreTile
                key={key}
                label={displayLabel(key)}
                selected={false}
                onClick={() => add(key)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-4 max-w-5xl mx-auto">
            {selected.map(key => (
              <GenreTile
                key={key}
                label={displayLabel(key)}
                selected
                onClick={() => remove(key)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Related genres */}
      {relatedGenres.length > 0 && (
        <div className="text-center mb-16">
          <h2 className="text-xl md:text-2xl font-boldonse mb-4">Related genres</h2>
          <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
            {relatedGenres.map(g => (
              <button
                key={g.slug}
                type="button"
                onClick={() => add(g.key)}
                className="px-4 py-2 text-sm rounded-full border border-border/70 hover:border-primary hover:text-primary transition-colors"
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {floatingActions ? (
        <>
          {onSkip && (
            <div className="fixed left-6 bottom-6 z-30">
              <Button
                type="button"
                variant="secondary"
                disabled={skipping || saving}
                onClick={handleSkip}
              >
                {skipping ? 'Skipping…' : 'Skip for now'}
              </Button>
            </div>
          )}
          <div className="fixed right-6 bottom-6 z-30">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || skipping || selected.length === 0}
              className="gap-2"
            >
              {saving ? 'Saving…' : saveLabel}
              <span aria-hidden>→</span>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-border/40">
          {onSkip && (
            <Button
              type="button"
              variant="ghost"
              disabled={skipping || saving}
              onClick={handleSkip}
            >
              {skipping ? 'Skipping…' : 'Skip'}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || skipping}
            className="gap-2"
          >
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

interface GenreTileProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function GenreTile({ label, selected, onClick }: GenreTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group relative aspect-square w-full max-w-[180px] rounded-2xl border transition-all',
        'flex items-center justify-center p-4 text-center',
        selected
          ? 'border-primary bg-primary/10 text-foreground shadow-lg'
          : 'border-border/60 bg-card/40 hover:border-primary/60 hover:bg-card/70',
      )}
    >
      <span className="font-boldonse text-sm md:text-base tracking-wide">{label}</span>
      {selected && (
        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="w-3.5 h-3.5" />
        </span>
      )}
    </button>
  );
}
