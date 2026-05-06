import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { GenreFilters } from '@/components/discovery/GenreFilters';
import { GenreArtistGrid } from '@/components/discovery/GenreArtistGrid';
import { genreFromSlug } from '@/lib/genreWhitelist';
import {
  getArtistsByGenre,
  type DiscoveryArtist,
  type SortMode,
} from '@/lib/genreDiscovery';
import { useSeoMeta, genrePageSeo } from '@/lib/seo';

/**
 * Genre Discovery page.
 *
 * Layout (per spec):
 *   - Header (global nav)
 *   - Filters toolbar (Country / Decade / Sort)
 *   - <h1>{active sub-genre}</h1>   <-- ONLY h1, directly above the grid
 *   - Artist grid
 *
 * URL contract:
 *   /genre              -> H1 "All Artists", empty grid
 *   /genre/:slug        -> H1 = title-cased label from genreWhitelist
 *   /genre/:slug?country=us&decade=1990&sort=newest
 *
 * The H1 is bound to the resolved genre's display label (not the raw slug)
 * so SEO + screen readers see "Alternative Rock" instead of
 * "alternative-rock". When the slug is unknown we fall back to the parent
 * category name when we can guess it; otherwise the literal "All Artists".
 */

const FALLBACK_TITLE = 'All Artists';

// Conservative starter list of countries the cache populates against.
// Derived from the most common MusicBrainz country codes; expand as the
// cache fills out. Keeping it client-side avoids a separate facet query.
const KNOWN_COUNTRIES: ReadonlyArray<string> = [
  'US', 'GB', 'CA', 'AU', 'DE', 'FR', 'SE', 'NO', 'JP', 'BR',
];

const GenrePage = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();

  const genre = useMemo(() => genreFromSlug(slug ?? null), [slug]);
  const heading = genre?.label ?? FALLBACK_TITLE;

  // Dynamic SEO -- title "[Genre] Albums & Ratings | Rankify" + description.
  useSeoMeta(genrePageSeo(genre?.label ?? null));

  // Memoise the filters object so the effect below only re-runs when a
  // search param actually changes. This is what keeps the H1 + filter
  // toolbar from being unmounted on every keystroke -- only the grid does.
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

  const [artists, setArtists] = useState<DiscoveryArtist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    if (!slug) {
      // No genre selected -- show empty state with "All Artists" heading.
      setArtists([]);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void getArtistsByGenre(slug, filters)
      .then(rows => {
        if (!cancelled) setArtists(rows);
      })
      .catch(err => {
        console.error('[GenrePage] discovery fetch failed:', err);
        if (!cancelled) setArtists([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, filters]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-6xl pt-32 pb-20 px-4">
        {/* Filters live ABOVE the heading -- the H1 must be the immediate
            sibling above the grid (no other titles between H1 and grid). */}
        <GenreFilters countries={KNOWN_COUNTRIES} />

        {/* The active sub-genre is the only H1 on the page. Typography
            comes from the design system (Boldonse + tracking-wide via the
            shared `font-boldonse` Tailwind utility). */}
        <h1 className="text-4xl md:text-5xl font-boldonse uppercase tracking-wide mb-8">
          {heading}
        </h1>

        <GenreArtistGrid artists={artists} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default GenrePage;
