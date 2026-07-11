## Diagnosis

The remaining "wrong years" are **not a caching problem**. `LASTFM_DATE_CACHE` is in-memory and resets on every page load, so there is nothing stale to clear.

The real issues are two:

### 1. `AlbumCard` never reads `original_year`

`src/components/music/AlbumCard.tsx` line 73–78 renders the year straight from `album.release_date`:

```tsx
{album.release_date && (
  <div ...>
    <Calendar className="w-3 h-3" />
    {album.release_date.split('-')[0]}
  </div>
)}
```

So even when `ArtistPage` enriches the album with the correct `original_year` (e.g. 1984 for "Ride the Lightning"), the card still shows the Deezer catalog year (e.g. 2016). `original_year` is currently only used for `chronoSort` and `activeYears`, which is why the sort order looks right but the printed year on each tile is wrong.

### 2. Enrichment can silently skip when the album payload has no nested `artist`

`ArtistPage.tsx` derives the artist name like this:

```ts
const artistName = data.find((a) => a.artist?.name)?.artist?.name;
if (!artistName) return;
```

For some artists Deezer's `/artist/{id}/albums` items don't include `artist` on every entry (or on any). In that case `enrichAlbumsWithOriginalYear` is skipped entirely and only the fast (non-reissue) path fills `original_year`. Reissue-marked titles like "Absolution XX Anniversary" or "Simulation Theory (Super Deluxe)" then keep the Deezer year forever.

## Changes

### `src/components/music/AlbumCard.tsx`
Prefer `original_year` when present, fall back to `release_date` year:

```tsx
const displayYear =
  album.original_year
    ? String(album.original_year)
    : album.release_date
      ? album.release_date.split('-')[0]
      : null;

{displayYear && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <Calendar className="w-3 h-3" />
    {displayYear}
  </div>
)}
```

### `src/pages/ArtistPage.tsx`
Use the already-loaded `artist` state as the fallback artist name for the enrichment pass, so it runs regardless of whether Deezer nested the artist inside each album:

```ts
getArtistAlbums(id, 100).then(async (data) => {
  if (cancelled) return;
  const fast = annotateOriginalYearFast(data);
  setAlbums(fast);
  setIsLoadingAlbums(false);

  const artistName =
    data.find((a) => a.artist?.name)?.artist?.name ?? artist?.name;
  if (!artistName) return;
  const enriched = await enrichAlbumsWithOriginalYear(fast, artistName);
  if (!cancelled) setAlbums(enriched);
});
```

(Read `artist?.name` via a ref or via the closure — the current `useEffect` already sets `artist` in a parallel `.then`, so we'll capture it via a small `latestArtistNameRef` set alongside `setArtist`, or simply await `getArtist` before kicking off enrichment. Simpler: pass the artist name from the `getArtist` result as a fallback via a shared local variable in the effect.)

Concretely, restructure the effect so both fetches share one `artistNameFromArtist` variable:

```ts
let resolvedArtistName: string | null = null;

getArtist(id).then((data) => {
  if (cancelled) return;
  setArtist(data);
  setIsLoadingArtist(false);
  resolvedArtistName = data?.name ?? null;
  if (data?.name) getArtistTags(id, data.name).then((t) => { if (!cancelled) setTags(t); });
});

getArtistAlbums(id, 100).then(async (data) => {
  if (cancelled) return;
  const fast = annotateOriginalYearFast(data);
  setAlbums(fast);
  setIsLoadingAlbums(false);

  const artistName =
    data.find((a) => a.artist?.name)?.artist?.name ?? resolvedArtistName;
  if (!artistName) return;
  const enriched = await enrichAlbumsWithOriginalYear(fast, artistName);
  if (!cancelled) setAlbums(enriched);
});
```

## Not doing

- **Not clearing `LASTFM_DATE_CACHE`.** It is per-session and already gets refetched on reload; clearing it just makes every artist page slower and wouldn't change any output.
- **Not touching `getArtistAlbums` in `deezer.ts`.** It already applies Last.fm correction to `release_date`; the failure mode is purely on the display / enrichment-trigger side.
- **Not touching `AlbumPage`.** The user's complaint is about the artist page's album grid; AlbumPage can be handled separately if needed.
