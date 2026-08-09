# Swiss editorial shell: sidebar, header, playback bar, Phosphor icons

Rebuild the app frame to match the Figma "Album page" frame, apply it to every page, and swap the icon set. Visual language: Swiss/editorial — monochrome + one coral accent (#e8775a), 1px dividers, no gradients/glass/shadows, no rounded containers, uppercase ProFontWindows labels, Space Grotesk paragraphs.

## 1. Two-theme token system

- Rewrite the token layer in `src/index.css` as a real light/dark pair instead of the page-scoped `theme-editorial` class:
  - Light (default, matches Figma): background #ffffff, raised #f5f5f5 / #f7f7f7, hero band #e6e6e6, text #111111, secondary #525252, border #d1d5db, strong border #111111, accent #e8775a.
  - Dark: inverted equivalents — #0d0d0d background, #171717 raised, #f5f5f5 text, #8a8a8a secondary, #2a2a2a border, same coral accent.
- Remove gradient/glow/glass utilities from use in the shell and replace them with flat borders. `--radius` drops to 0 for shell surfaces.
- Add a theme toggle (stored in localStorage, `class="dark"` on `<html>`), placed in the sidebar footer next to Settings.

## 2. App shell (applies to all pages)

New `src/components/layout/AppShell.tsx` wrapping every route via a layout route in `App.tsx`:

```text
+----------+--------------------------------------+
| Sidebar  |  Header (sticky top)                 |
| 264px    +--------------------------------------+
| sticky   |  <page content>                      |
| full-h   |                                      |
+----------+--------------------------------------+
|  Playback bar (fixed bottom, all pages)         |
+-------------------------------------------------+
```

**Sidebar** (`DashboardSidebar` replaced by a global `AppSidebar`): 264px, sticky full-height, 1px right border, 64px top padding. Items with 16px icons + 13px uppercase labels, each row separated by a 1px bottom border: Home, My stats, Rated music, Playlists, Preferences. Active row = solid #1a1a1a fill with inverse text. Bottom block: Settings row (top border) and a full-width coral "Upgrade to pro" button with a 1px black border, linking to `/pricing`. On mobile it becomes a drawer opened by a hamburger in the header.

**Header**: sticky top, 1px bottom border, 24px horizontal padding, grid-aligned with the sidebar. Left: "SoundVault" wordmark at 33px uppercase. Center: flat search field (#f7f7f7, 1px #d1d5db border, no radius) using the existing `GlobalSearch` behaviour restyled. Right: 32px circular user avatar + uppercase nickname, keeping the current dropdown/sign-in logic.

**Playback bar**: fixed to the bottom on every route (currently already global, but restyled). Three-column grid: left = 48px cover, uppercase track title, "artist • album" links, add-to-playlist; center = shuffle / prev / play / next / repeat with a 2px flat progress track (coral fill) and 11px timestamps; right = queue, star rating with numeric value, voice-control toggle, volume, details — each with a 10px uppercase caption underneath, exactly as in the frame. All existing behaviour (vertical rating/volume popovers, voice control, rating sync) is preserved, only the visual layer changes.

## 3. Album page corrections against the design

Diff the current `src/pages/AlbumPage.tsx` against the frame and fix:
- Hero band uses #e6e6e6 with 24px padding and a 48px gap; cover is a fixed 275px square, not fluid.
- 6-column grid: cover col 1, hero info cols 3-4, average-score block col 5 right-aligned (11px label, 40px score, "Rated tracks: n/n"), coral 168x191 accent block col 6.
- Meta rows (Artist / Year / Tracks) use black 1px top borders, 11px secondary label vs 13px value.
- Track table header on #f5f5f5 with top+bottom borders; rows use dashed #d1d5db bottom borders and the 6-column grid (#/song, album, rating bar + 2-digit value, time + info, details).
- Footer score bar: solid #111 background, white 12px uppercase label, 24px score value.
- Remove the leftover page-scoped `theme-editorial` wrapper once global tokens land.

## 4. Phosphor icons everywhere

- Add `@phosphor-icons/react`, remove `lucide-react`.
- Replace icon imports across all 58 files that use lucide, mapping equivalents (House, ChartLine, StarHalf, Playlist, FadersHorizontal, Gear, MagnifyingGlass, User, MicrophoneSlash, SpeakerSimpleHigh, Info, SkipBack/Forward, Play/Pause, Shuffle, Repeat, etc.) — the sidebar/header/player names come straight from the Figma layer names.
- Use `weight="regular"` monoline as the default, `size` in px, `currentColor` for color so icons follow theme tokens.

## Technical notes

- Routing changes in `src/App.tsx`: wrap routes in a shell layout; `/auth`, `/reset-password`, `/onboarding` and the OAuth consent page stay outside the shell.
- `DashboardPage` drops its own sidebar and uses the global one; dashboard tab routing is unchanged.
- No data-layer, MusicBrainz, or rating-logic changes — presentation only.
- Figma localhost asset URLs are not referenced; icons come from Phosphor and artwork from the existing Cover Art Archive pipeline.
