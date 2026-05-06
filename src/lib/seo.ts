import { useEffect } from 'react';

export interface SeoMeta {
  title: string;
  description: string;
}

/**
 * Imperatively manages document.title and the description meta tag for the
 * current view. Captures the previous values on mount and restores them on
 * unmount so navigation between pages doesn't leak stale meta.
 *
 * Intentionally does NOT pull in react-helmet-async or another library for
 * this single use case -- keeps the bundle lean.
 */
export function useSeoMeta({ title, description }: SeoMeta): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const previousTitle = document.title;
    let descTag = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    let createdDescTag = false;
    if (!descTag) {
      descTag = document.createElement('meta');
      descTag.setAttribute('name', 'description');
      document.head.appendChild(descTag);
      createdDescTag = true;
    }
    const previousDesc = descTag.getAttribute('content') ?? '';

    document.title = title;
    descTag.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (createdDescTag && descTag && descTag.parentNode) {
        descTag.parentNode.removeChild(descTag);
      } else if (descTag) {
        descTag.setAttribute('content', previousDesc);
      }
    };
  }, [title, description]);
}

/**
 * Build the spec'd SEO meta for a Genre Discovery page.
 *   Title:        "[Genre] Albums & Ratings | Rankify"
 *   Description:  "Explore and rank the best [Genre] albums. Analytical
 *                  charts, community ratings, and full discographies."
 *
 * Falls back to "All Artists" when no genre is selected.
 */
export function genrePageSeo(genreLabel: string | null | undefined): SeoMeta {
  const label = (genreLabel && genreLabel.trim()) || 'All Artists';
  return {
    title: `${label} Albums & Ratings | Rankify`,
    description: `Explore and rank the best ${label} albums. Analytical charts, community ratings, and full discographies.`,
  };
}
