import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { GenreFilters } from '@/components/discovery/GenreFilters';
import { GenreArtistGrid } from '@/components/discovery/GenreArtistGrid';
import { GenreAlbumGrid } from '@/components/discovery/GenreAlbumGrid';
import { ParentGenreTabs } from '@/components/discovery/ParentGenreTabs';
import { SubGenrePills } from '@/components/discovery/SubGenrePills';
import { GenreSearchBar } from '@/components/discovery/GenreSearchBar';
import { ContentTypeToggle, type DiscoveryContentType } from '@/components/discovery/ContentTypeToggle';
import { genreFromSlug } from '@/lib/genreWhitelist';
import { parentCategorySlug, parentCategoryFromSlug, PARENT_CATEGORIES } from '@/lib/genreMap';
import {
  getArtistsByGenre,
  getAlbumsByGenre,
  type DiscoveryArtist,
  type DiscoveryAlbum,
  type SortMode,
} from '@/lib/genreDiscovery';
import { useSeoMeta, genrePageSeo } from '@/lib/seo';

/**
 * Genre Discovery page -- Bandcamp-style.
 *
 * URL contract:
 *   /genre                          -> default to Rock parent
 *   /genre/:slug                    -> :slug may be a parent (rock, metal, ...)
 *                                      or a sub-genre (groove-metal, etc.)
 *   ?type=artists|albums            -> grid mode (default artists)
 *   ?country=us&decade=1990&sort=newest  -> applied to artists grid
 */

const FALLBACK_PARENT = 'Rock' as const;

const KNOWN_COUNTRIES: ReadonlyArray<string> = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'SE', 'NO', 'JP', 'BR',
];

const GenrePage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Resolve the active genre + parent category. If slug is a sub-genre, the
  // parent comes from its `category`; if it's a parent slug, the resolved
  // genre IS the parent; if absent we default to Rock so the page is never
  // an empty shell.
  const { activeGenre, parentCategory, activeIsParent } = useMemo(() => {
    const g = genreFromSlug(slug ?? null);
    const parentFromSlug = parentCategoryFromSlug(slug ?? null);
    if (parentFromSlug) {
      return { activeGenre: g, parentCategory: parentFromSlug, activeIsParent: true };
    }
    if (g) {
      const parent = PARENT_CATEGORIES.find(p => p === g.category) ?? FALLBACK_PARENT;
      return { activeGenre: g, parentCategory: parent, activeIsParent: false };
    }
    return { activeGenre: null, parentCategory: FALLBACK_PARENT, activeIsParent: true };
  }, [slug]);

  const effectiveSlug = slug ?? parentCategorySlug(FALLBACK_PARENT);
  const heading = activeGenre?.label ?? parentCategory;

  useSeoMeta(genrePageSeo(activeGenre?.label ?? parentCategory));

  // ---- Content type tab (Top Artists / Top Albums) ----
  const contentType: DiscoveryContentType =
    searchParams.get('type') === 'albums' ? 'albums' : 'artists';

  const setContentType = (next: DiscoveryContentType) => {
    const p = new URLSearchParams(searchParams);
    if (next === 'artists') p.delete('type');
    else p.set('type', next);
    setSearchParams(p, { replace: true });
  };

  // ---- Filters (for artists grid) ----
  const filters = useMemo(
    () => ({
      country: searchParams.get('country') ?? null,
      decade: (() => {
        const raw = searchParams.get('decade');
        if (!raw) return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      sort: (searchParams.get('sort') as SortMode | null) ?? 'top',
      limit: 24,
    }),
    [searchParams],
  );

  const hasActiveFilters =
    searchParams.has('country') || searchParams.has('decade') || searchParams.has('sort');

  const resetFilters = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('country');
    p.delete('decade');
    p.delete('sort');
    setSearchParams(p, { replace: true });
  };

  // ---- Data fetching ----
  const PAGE_SIZE = 24;
  const [artists, setArtists] = useState<DiscoveryArtist[]>([]);
  const [albums, setAlbums] = useState<DiscoveryAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Any change of genre / tab / filters restarts pagination from page 1.
  useEffect(() => {
    setPage(1);
    setHasMore(true);
  }, [effectiveSlug, contentType, filters]);

  useEffect(() => {
    let cancelled = false;
    if (page === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    const run = async () => {
      try {
        if (contentType === 'albums') {
          const res = await getAlbumsByGenre(effectiveSlug, { limit: PAGE_SIZE, page });
          if (cancelled) return;
          setAlbums(prev => {
            if (page === 1) return res;
            const seen = new Set(prev.map(a => String(a.id)));
            return [...prev, ...res.filter(a => !seen.has(String(a.id)))];
          });
          setHasMore(res.length >= PAGE_SIZE / 2);
        } else {
          const res = await getArtistsByGenre(effectiveSlug, { ...filters, page });
          if (cancelled) return;
          setArtists(prev => {
            if (page === 1) return res;
            const seen = new Set(prev.map(a => String(a.id)));
            return [...prev, ...res.filter(a => !seen.has(String(a.id)))];
          });
          setHasMore(res.length >= PAGE_SIZE / 2);
        }
      } catch (err) {
        console.error('[GenrePage] discovery fetch failed:', err);
        if (!cancelled) {
          if (page === 1) {
            if (contentType === 'albums') setAlbums([]);
            else setArtists([]);
          }
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, contentType, filters, page]);

  const parentSlug = parentCategorySlug(parentCategory);
  const activeParentSlug = parentSlug;
  const activeSubSlug = activeIsParent ? null : activeGenre?.slug ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-6xl pt-28 pb-20 px-4">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6 flex gap-2 items-center" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground">Search by genre</span>
        </nav>

        {/* Search + Parent tiles + Sub-genre pills, grouped in a soft panel */}
        <section className="mb-10 p-5 md:p-6 rounded-3xl bg-card/30 border border-border/40 space-y-5">
          <GenreSearchBar />
          <ParentGenreTabs activeParentSlug={activeParentSlug} />
          <SubGenrePills parent={parentCategory} activeSlug={activeSubSlug} />
        </section>

        {/* Heading row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <h1 className="text-4xl md:text-5xl font-boldonse uppercase tracking-wide">
            {heading}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <ContentTypeToggle value={contentType} onChange={setContentType} />
            {contentType === 'artists' && (
              <>
                <GenreFilters countries={KNOWN_COUNTRIES} />
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs uppercase tracking-wider px-3 py-2 rounded-md border border-border/50 hover:border-foreground/50 hover:text-foreground text-muted-foreground transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        {contentType === 'artists' ? (
          <GenreArtistGrid artists={artists} isLoading={isLoading} />
        ) : (
          <GenreAlbumGrid albums={albums} isLoading={isLoading} />
        )}

        {/* Pagination */}
        {!isLoading && hasMore && (contentType === 'artists' ? artists.length : albums.length) > 0 && (
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={() => setPage(p => p + 1)}
              disabled={isLoadingMore}
              className="text-xs uppercase tracking-wider px-6 py-3 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default GenrePage;
