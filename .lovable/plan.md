## Redesign PlaybackBar layout to match wireframe

Update `src/components/player/PlaybackBar.tsx` only — keep current colors/tokens, just restructure layout.

### New layout (3 zones)

```text
[cover] Song            (+)   [shuf] [prev] (PLAY) [next] [rep]    [▓▓▓░░ 7]  [🎤 Off]  [🔊 ▓▓░]
        Artist name                01:13 ▬▬▬▬▬▬▬▬▬ 03:09           Voice control
```

**Left zone**
- Square rounded cover thumbnail (placeholder icon when none) + Song title (bold) / Artist name (muted) stacked.
- Circular outlined `+` button → wires to existing `AddToPlaylistButton` for the current track.

**Center zone**
- Top row: Shuffle, Prev, Play/Pause (filled dark circular button), Next, Repeat — all inline, evenly spaced.
- Bottom row: `currentTime  ▬▬▬▬ progress ▬▬▬▬  duration` (slider moved from top edge to below the controls, with times flanking it).
- Remove the existing full-width thin progress bar at the very top.

**Right zone**
- Rating indicator: horizontal filled bar (0–10) showing the current track's user rating + numeric value to the right. Read from `track_ratings` via Supabase for the current track (`user_id` + `album_deezer_id` + `track_position`); non-interactive display only.
- Voice control toggle: mic icon with "Off"/"On" label underneath. Toggles existing `VoiceAssistant` listening state (lift control into PlaybackBar or add a global store). When off, show muted mic with slash.
- Volume: speaker icon + thin volume slider (existing behavior preserved).

### Behavioral preservation
- All existing handlers (play/pause, next/prev, seek, volume, shuffle, repeat cycle) unchanged.
- No color changes — continue using `bg-card/70`, `text-primary`, `text-muted-foreground`, etc.
- Responsive: on small screens, hide rating bar label and voice-control label, keep icons.

### Files
- `src/components/player/PlaybackBar.tsx` — restructure JSX + add rating fetch hook + voice toggle wiring.
- Possibly small addition: expose a `listening` toggle from `VoiceAssistant` (or inline a minimal mic toggle button) so the playback bar can control it.

No DB, routing, or business-logic changes.
