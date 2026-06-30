# Homepage Redesign Plan

Rebuild `src/pages/Index.tsx` to match the wireframe: an animated rotating headline, a two-column body (left = personalized discovery, right = user stats), keeping the existing Header, PlaybackBar, and Footer behavior.

## 1. Hero — Rotating Headline

Replace the static "DISCOVER & RATE" with a single animated H1 that cycles through three words: **Discover → Listen → & Rate**, ~2.5s each, infinite loop, fade + slide-up transition (no rotation).

- Markup keeps SEO-safe text: visible H1 is `Discover & Rate`, with the rotating word visually swapped via an absolutely-positioned span. The full phrase is rendered as `<span class="sr-only">Discover, Listen, & Rate</span>` so crawlers see the complete heading.
- Animation built with Framer Motion `AnimatePresence` (already in deps) using `initial={{opacity:0, y:12}} / animate / exit={{opacity:0, y:-12}}`, 350ms ease-out.
- Honor `prefers-reduced-motion`: when set, the word stays on "Discover & Rate" with no cycling.
- Subtitle paragraph stays under the headline, same copy as today.

## 2. Body Layout — Two-Column Grid

`lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-8`. Stacks to single column under `lg`.

### Left column

**Last releases** — horizontal row of 5 album cards (existing `AlbumCard` reused, smaller variant).
- Signed in: latest albums (by `release_date`) from the user's rated artists. Pull distinct `artist_deezer_id` from `album_ratings` for `auth.uid()`, then fetch each artist's discography via existing `getArtistAlbums` in `src/lib/discography.ts`, flatten, sort by date desc, take 5.
- Signed out (or no ratings yet): fall back to Deezer editorial chart (`https://api.deezer.com/editorial/0/releases` via existing JSONP helper).

**Recommended** — horizontal row of 5 artist cards (existing `ArtistCard`).
- Signed in: Last.fm `artist.getsimilar` seeded from the user's top 3 highest-rated artists, deduped against already-rated artists, resolved through `searchArtists` for Deezer images.
- Signed out: fallback to Last.fm `chart.gettopartists`.

### Right column (sticky aside, `lg:sticky lg:top-24`)

A single rounded card containing two stacked sections plus the footer playlist block:

**Recently rated** — last 3 entries.
- Signed in: `album_ratings` where `user_id = auth.uid()` order by `updated_at` desc limit 3, join `albums_cache` for cover/title and `artists_cache` for artist name.
- Signed out: most recent 3 community ratings from `album_ratings` (any user) — no PII, just album metadata.

**My playlists** — up to 2 of the user's playlists from the `playlists` table + a "+ Add New Playlist" CTA (links to `/dashboard/playlists`).
- Signed out: show 2 featured/community playlists (newest public ones if any; otherwise a "Sign in to build playlists" CTA replacing the list).

## 3. Data plumbing

New helpers in a single file `src/lib/homeFeed.ts`:
- `getLastReleases(userId | null)` → `DeezerAlbum[]`
- `getRecommendedArtists(userId | null)` → `DeezerArtist[]`
- `getRecentlyRated(userId | null)` → `{album, artist, rating, ratedCount}[]`
- `getHomePlaylists(userId | null)` → `{id, name, trackCount, coverUrl}[]`

Each is wrapped in a `useQuery` in `Index.tsx` so loading states render skeletons (reuse `Skeleton` from shadcn). No new tables, no schema changes.

## 4. Styling

All tokens via existing `index.css` palette (no hardcoded colors). Cards use existing `bg-card/50 border-border/30` treatment to stay consistent with the dark/warm aesthetic. The wireframe's light look is structural reference only — colors stay on-brand.

## 5. SEO

- H1 remains a single semantic `<h1>` with full phrase via `sr-only` complement.
- Existing meta tags in `index.html` already cover the page.
- All animated content is real DOM text (not images), so it's fully indexable.

## 6. Out of scope

- The "Go Premium" band and footer in the wireframe (already separate concerns) — not touched in this pass.
- Header search bar styling — unchanged.

## Files touched

- `src/pages/Index.tsx` — full rewrite of hero + body
- `src/lib/homeFeed.ts` — new helpers
- No new dependencies (framer-motion, react-query, Last.fm, Deezer already wired)
