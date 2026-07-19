# Full Deezer Removal Plan

This is a large refactor: Deezer is currently woven through routing (URLs use Deezer IDs), the ratings schema (`album_deezer_id`, `artist_deezer_id`), cover art, search, artist top tracks, related artists, and playback matching. I want to confirm the scope + one data-migration decision before I start editing.

## What "Deezer entirely removed" means in this codebase

Files to delete:
- `src/lib/deezer.ts`
- `src/lib/deezerCover.ts`

Files to rewrite so they only touch MusicBrainz / Cover Art Archive / Last.fm (genres):
- Pages: `SearchPage`, `ArtistPage`, `AlbumPage`, `ArtistRatingsPage`, `RatingsPage`, `DiscographyMapPage`, `GraphPage`, `DebugDiscographyPage`
- Lib: `musicPipeline.ts`, `musicbrainz.ts`, `homeFeed.ts`, `discography.ts`, `purify.ts`, `genreDiscovery.ts`
- Components: `AlbumCard`, `ArtistCard`, `TrackList`, `SongDetails`, `AddToPlaylistButton`, `PlaybackBar`, `MyStatsTab`, `RatedMusicTab`, `RatedMusicArtistTab`, `PlaylistEditor`
- MCP: `src/lib/mcp/*`, `supabase/functions/mcp/index.ts`
- Hooks: `useArtistImage`

## Replacement mapping

| Current (Deezer) | Replacement |
|---|---|
| Album/artist search (`searchArtists`, `searchAlbums`, `searchTracks`) | MusicBrainz search (already exists in `musicbrainz.ts`: `searchArtistsMB`, `searchReleaseGroupsMB`, `searchRecordingsMB`) |
| Album/artist covers | Cover Art Archive (`https://coverartarchive.org/release-group/{mbid}/front-500`) — no artist images available; artist tiles show initials/placeholder |
| Artist top tracks | Drop the section (MB has no popularity signal) or replace with "Popular releases" (MB release-group list) |
| Related artists | Drop, or use MB artist relations (band-member/similar via URL rels — sparse) |
| Track previews (30s MP3) | Removed — no equivalent in MB |
| YouTube playback title matching (currently uses Deezer titles) | Uses MB recording titles instead |

## Route + storage impact — the decision I need from you

URLs today: `/artist/:deezerId`, `/album/:deezerId`. Ratings rows are keyed on `album_deezer_id` + `artist_deezer_id`. Removing Deezer forces one of:

**Option A — Switch to MBIDs everywhere and migrate ratings.**
- Routes become `/artist/:mbid`, `/album/:mbid`.
- Migration: add `album_mbid` / `artist_mbid` columns, backfill from existing `music_cache` where possible, then rename. Ratings without a matching MBID (albums that had no MB match) will be lost.
- Cleanest end state.

**Option B — Keep Deezer numeric IDs as opaque route identifiers only, but delete every Deezer *call*.**
- Existing ratings + shareable URLs keep working.
- IDs in the DB/URL are still called `deezer_id` but no code hits deezer.com anymore. Purely cosmetic Deezer presence.
- Contradicts "Deezer should not affect anything" if you consider the column names.

**Option C — Same as A but drop the ratings table entirely and start fresh.**
- Simplest code, but every user loses their ratings.

## Features that will visibly change or disappear

- No 30-second track previews anywhere (album page, playlists, search).
- No artist images on artist tiles/cards (CAA covers albums only). Placeholder initials tile instead.
- Playback bar still works via YouTube search, but match quality drops slightly (no `isrc` field from MB in most cases; falls back to title + duration).
- Homepage "Last releases" / "Recommended" that used Deezer charts becomes MB-driven: e.g. recent release-groups by favorite-genre artists. Recommendations get less lively.
- Search returns MB results only — no covers on artist results, album covers via CAA (some albums have no CAA art → placeholder).
- Related artists section on ArtistPage: removed unless you want the sparse MB-relations fallback.

## Technical approach once Option chosen

```text
1. Extend src/lib/musicbrainz.ts with:
   - fetchReleaseGroupDetails(mbid)  // tracklist via /release?release-group=…
   - artistTopReleases(mbid)          // used where "top tracks" used to be
   - coverArtArchive helpers already exist
2. Delete src/lib/deezer.ts, src/lib/deezerCover.ts.
3. Rewrite musicPipeline.ts to be MB-only (drop Deezer merge pass + covers pass).
4. Sweep every file in the list above; replace Deezer types (DeezerAlbum/Artist/Track)
   with MB-native shapes exported from musicbrainz.ts.
5. Update routes + ratings schema per chosen Option.
6. Update MCP tools (search-music, rate-album, list-my-ratings) and edge function
   to speak MBIDs.
7. TRUNCATE music_cache, artists_cache, albums_cache, tracks_cache
   (all keyed on deezer_id — obsolete).
```

## Questions before I start

1. **Which option for routes + ratings? A, B, or C?** This changes ~half the diff.
2. **Artist top tracks + related artists sections — drop entirely, or keep as "Popular releases" / "MB relations"?**
3. **Track previews — confirm okay to remove the play-preview UI everywhere (album page play buttons, search hover previews).**

Once you answer, I'll execute the full sweep in one pass and clear the stale caches.
