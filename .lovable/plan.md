
# Onboarding — Favorite Genres

Build a full-screen onboarding step users see once after sign-up and after email-confirmation sign-in, plus wire the same genre-picker into the existing (currently stubbed) Preferences dashboard tab. Users can skip; when they do, the homepage shows a subtle nudge to finish setup in Preferences.

## 1. Data model

New migration (single call):

- Add columns to `public.profiles`:
  - `favorite_genres text[] not null default '{}'`
  - `onboarding_completed boolean not null default false`
- Existing profile RLS already covers per-user read/write. No new table.

Genres are stored as canonical lowercase keys from `src/lib/genreWhitelist.ts` (`WhitelistedGenre.key`), so they round-trip cleanly with the existing genre pages.

## 2. Route + gating

- New route `/onboarding` → `src/pages/OnboardingPage.tsx`. Auth-required (redirect to `/auth` if no user).
- `useAuth` gains a lightweight `profile` fetch (single row from `profiles` for `auth.uid()`) exposed via a new `useProfile()` hook in `src/hooks/useProfile.tsx` (React Query). Returns `{ favorite_genres, onboarding_completed, loading, refetch }`.
- Gating logic in `src/pages/Index.tsx` (and after login redirects in `AuthPage`): once `user` is loaded and `profile.onboarding_completed === false`, `navigate('/onboarding', { replace: true })`. This satisfies "after sign-up AND after email-confirmation sign-in" because both paths land on `/` with a fresh session and empty profile flag.
- `AuthPage` post-sign-in redirect: change from `navigate('/')` to a shared helper that checks the flag then routes.

## 3. Reusable genre picker

New component `src/components/onboarding/FavoriteGenresPicker.tsx` — the wireframe's UI, reused by both `/onboarding` and the Preferences dashboard tab.

Behavior modeled from the reference frames:

- Header shows brand mark + "Rankify"-style title (we keep our brand — "Discover & Rate" wordmark) — matches app aesthetic (Boldonse heading, dark warm palette; the reference is a light wireframe but we stay on-brand per project memory).
- H1 "Favorite genres" + subtitle "Choose up to 5 genres. You can always change them in your preferences."
- Search input (`Input` + magnifier icon) with autocomplete dropdown of top parent categories + sub-genres from `ALL_WHITELISTED_GENRES` (fuzzy startsWith + includes).
- Selected genres render as large rounded tiles in a centered row (wrapping to next row after 4 on lg). Click a tile to deselect.
- Below the tiles, a "Related genres" chip row: shows sub-genres of the most-recently-added tile's parent category (pulled from `GENRE_DATABASE[category]`), excluding already-selected ones. Clicking a chip adds it as a tile (respecting the 5-item cap; the chip's cursor + tooltip communicates the limit when full).
- Enforce max 5 with a toast when a 6th is attempted.
- Empty state: shows a default 6-tile row (Rock, Pop, Hip-Hop & Rap, Electronic, Jazz, Classical) as starter choices before any selection.
- Component API:
  ```ts
  interface FavoriteGenresPickerProps {
    initial: string[];
    onSave: (genres: string[]) => Promise<void>;
    onSkip?: () => void;                // hides Skip when omitted (Preferences tab)
    saveLabel?: string;                 // "Save and proceed" | "Save changes"
  }
  ```
- Footer: floating "Skip for now" (bottom-left of viewport, only when `onSkip` provided) and "Save and proceed →" primary button (bottom-right). In the Preferences tab both live inline at the bottom of the section instead of floating.

## 4. `/onboarding` page

`OnboardingPage.tsx`:

- Renders `FavoriteGenresPicker` full-bleed on a min-h-screen container, no `Header` (matches the reference, keeps the moment focused).
- `onSave`: `update profiles set favorite_genres = $1, onboarding_completed = true where user_id = auth.uid()`, then `navigate('/', { replace: true })`.
- `onSkip`: `update profiles set onboarding_completed = true` (no genres saved), then `navigate('/', { replace: true })`. This satisfies "never show again — hint on homepage instead".

## 5. Preferences dashboard tab

Replace the `ComingSoon` placeholder in `DashboardPage.tsx` with a new `PreferencesTab` component (`src/components/dashboard/PreferencesTab.tsx`):

- Section heading "Favorite genres" + short helper text.
- Renders `FavoriteGenresPicker` with `initial={profile.favorite_genres}`, no `onSkip`, `saveLabel="Save changes"`. Persists via the same UPDATE (without touching `onboarding_completed`).
- Toast confirmation on save.

## 6. Homepage hint (skip fallback)

In `src/pages/Index.tsx`, when `profile.onboarding_completed === true` **and** `favorite_genres.length === 0`, render a dismissible banner above the hero:

> "Pick your favorite genres to personalize your feed → [Set up preferences]"

The link points to `/dashboard/preferences`. Dismissal is session-scoped (`sessionStorage`), so it reappears next visit until they save at least one genre. No new DB flag needed.

## 7. SEO / a11y

- `/onboarding` `<title>` = "Set up your favorite genres — Discover & Rate", meta description matches.
- H1 remains "Favorite genres".
- Search input has `aria-label`, dropdown is a proper `role="listbox"` with keyboard nav (ArrowUp/Down, Enter, Esc). Tiles are `<button>` elements with `aria-pressed`.

## 8. Styling

Stays on brand (dark warm palette, Boldonse headings, Space Grotesk body, glassmorphism cards) — the light wireframes are structural reference only, per project memory. All colors via existing tokens in `index.css`.

## 9. Files touched

New:
- `src/pages/OnboardingPage.tsx`
- `src/components/onboarding/FavoriteGenresPicker.tsx`
- `src/components/dashboard/PreferencesTab.tsx`
- `src/hooks/useProfile.tsx`

Edited:
- `src/App.tsx` — add `/onboarding` route
- `src/pages/DashboardPage.tsx` — mount `PreferencesTab` in the preferences slot
- `src/pages/AuthPage.tsx` — post-login redirect goes through the onboarding check
- `src/pages/Index.tsx` — onboarding gate + optional homepage hint banner
- Migration for `profiles.favorite_genres` + `profiles.onboarding_completed`

No new dependencies. No changes to Header, PlaybackBar, or other tabs.

## Out of scope

- Other preference categories (rating criteria weights, playback provider) — this pass only lands the genre step.
- Onboarding analytics/telemetry.
