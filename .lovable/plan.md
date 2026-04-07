## Hybrid Architecture Implementation

### Phase 1: Database Schema
Create new tables via migration:
- **`provider_accounts`** — links users to multiple providers (Spotify, Google, Apple) with tokens
- **`isrc_mapping`** — cross-platform track mapping using ISRC codes
- Add `primary_provider` and `is_pro` columns to `profiles`

### Phase 2: Google OAuth Login
- Use Lovable Cloud's managed Google OAuth (configure_social_auth tool)
- Update AuthPage.tsx with "Sign in with Google" button
- Store Google provider account in `provider_accounts` on login

### Phase 3: Provider Abstraction Layer
- Create `src/lib/playbackProvider.ts` — unified playback interface with priority logic:
  1. Spotify SDK (if Premium) → 2. YouTube IFrame (current fallback)
- Create `src/lib/metadataProvider.ts` — search abstraction:
  1. Spotify API (when key available) → 2. MusicBrainz (current)
- Keep all existing MusicBrainz + YouTube code working as-is

### Phase 4: Data Migration Prep
- Create a migration-ready function that can map existing MusicBrainz IDs to ISRC codes (will execute when Spotify API is connected later)

### What stays unchanged
- Current search (MusicBrainz), playback (YouTube), ratings, voice assistant all remain functional
- New architecture layers on top without breaking existing features
