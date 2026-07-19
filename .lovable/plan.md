## Context

You're seeing wrong years because the pipeline is stitching Deezer editions (reissues, deluxe boxes) onto MusicBrainz release groups. Every "fix" so far has been a patch on top of that stitching. You want the stitching gone.

Before I start deleting large parts of the codebase, I need to confirm the scope, because "remove everything Deezer/Last.fm/Wikidata except covers" touches search, artist pages, album pages, ratings, playback, home feed, and the MCP tools.

## What I plan to remove

- All Deezer *metadata* usage: album titles, years, tracklists, record_type, artist bios, discography lists, search results ranking.
- All Last.fm usage: genre tags, bios, similar artists, related-genre suggestions in onboarding.
- All remaining Wikidata references (comments, dead imports).
- Any helper scripts / tests tied to those sources (`src/lib/lastfm.ts` already gone; `src/lib/bio.ts`, Last.fm genre map inputs, Deezer discography enrichers, `musicPipeline`'s Deezer merge branch, etc.).

## What stays

- **Deezer covers only**: `cover_small/medium/big/xl` for artists and albums, looked up by name/MBID → Deezer ID purely to pull the image URL. No other Deezer field is read.
- MusicBrainz becomes the sole source of truth for: search, artist identity, discography, release years, track lists, record types, genres.
- Ratings, playback (YouTube), auth, UI shells — untouched.

## New data flow

```text
Search box
  └─ MusicBrainz /artist + /release-group + /recording search
       └─ results rendered with Deezer cover (by MBID→Deezer ID lookup, cover only)

Artist page
  └─ MusicBrainz artist detail + release-groups + genres
       └─ each release-group: Deezer cover only, nothing else

Album page
  └─ MusicBrainz release-group + one canonical release + recordings (tracklist)
       └─ Deezer cover only

Ratings
  └─ keyed on MBID (release-group id) + track position; existing rows keyed on
     deezer album id get a one-time backfill by title match, or are left as-is
     with a "legacy" flag — need your call (see Open questions)
```

## Files I will delete or gut

- `src/lib/deezer.ts` → shrink to a single `getDeezerCoverByName(artist, album?)` helper.
- `src/lib/musicPipeline.ts` → rewrite: MB-only, no `mergeMbWithDeezer`, no `deezerOnlyPayload` fallback.
- `src/lib/discography.ts` → drop title-normalization/edition-priority logic (no more Deezer variants to collapse).
- `src/lib/bio.ts` → rewrite to Wikipedia-via-MBID only, drop Last.fm fallback.
- `src/lib/genreMap.ts` → keep normalization, drop Last.fm-specific alias table if unused.
- `src/lib/homeFeed.ts` → replace Deezer charts + Last.fm similar-artists with MB-based recommendations (or a static/curated list — see Open questions).
- `src/pages/SearchPage.tsx` → repoint search to MB.
- `src/pages/ArtistPage.tsx`, `src/pages/AlbumPage.tsx` → drop Deezer metadata reads.
- `src/lib/mcp/tools/search_music.ts` → MB-backed.
- Tests: `src/lib/lastfm.test.ts` (already stale) and any Deezer-shape tests.

## Open questions I need answered before I start

1. **Search UX**: MusicBrainz search is slower and returns fewer "fuzzy" matches than Deezer. Expect ~600-1200 ms per query and stricter spelling. OK?
2. **Home page ("Last releases", "Recommended", "Recently rated")**: MB has no chart/popularity data. Options:
   a. Show only "Recently rated" + "My playlists" (drop the two personalised discovery blocks).
   b. Keep them but source from a static curated list.
   c. Keep Deezer *only* for these two blocks as a pragmatic exception.
3. **Existing ratings** are keyed on Deezer album IDs. Migration options:
   a. Backfill: match each rated album to an MBID by title+artist, rewrite rows. Some will fail.
   b. Dual-key: keep deezer_id column, add mbid column, resolve at read time.
   c. Wipe ratings and start fresh.
4. **Playback**: YouTube search currently uses Deezer track title + duration. MB gives title but no duration on some releases. Keep the Deezer track lookup *only* for the duration hint, or drop duration from the YouTube query?
5. **Scope of "any scripts we built"**: do you also want the Vitest setup and the metadata-enrichment background job (`src/lib/metadata.ts`) removed, or just the source-specific ones?

## Deliverable order once you answer

1. Rewrite `musicPipeline.ts` MB-only, delete Deezer merge path.
2. Shrink `deezer.ts` to cover-only helper.
3. Repoint SearchPage, ArtistPage, AlbumPage, MCP search tool.
4. Rewrite `bio.ts`, home feed per your answer to Q2.
5. Handle ratings per your answer to Q3.
6. Wipe `music_cache` again and delete now-dead files/tests.

Answer the five questions above (even one-word answers are fine) and I'll execute.