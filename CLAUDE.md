# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build
npx prettier --write .  # Format all files
```

There are no tests.

## What This Is

Spellsplice is a Magic: The Gathering video overlay editor. Users load a video file and build a synchronized timeline of in-game events (life changes, draws, discards, etc.) that can be overlaid on the video during playback.

## Architecture

**App.tsx** holds all canonical state and passes it down via props. No external state management — plain React state + props drilling. Key state:
- `players: Player[]` — managed by `usePlayerTracks`; each player owns their track and events
- `selectedPlayerId: string | null` — which player's track the timeline is showing
- `selectedEvents: TrackEvent[]` — currently selected events (shown in Inspector)
- `isPlaying`, `currentTime`, `video: VideoState | null`

Three-panel layout (react-resizable-panels), vertical 70/30 split:
- **VideoPreview** (top-left, 75%) — renders video frames to a `<canvas>` via `drawImage` on a rAF loop. A hidden `<video>` element handles decoding/audio. Renders player state overlays and active windowed event banners directly on the canvas. Uses `derivedCacheRef` with a `validUntil` timestamp to skip redundant state derivation between frames.
- **Inspector** (top-right, 25%) — edits the selected event's `meta` fields. Per-type form components; card fields use Scryfall autocomplete via react-query with 500ms debounce.
- **Timeline** (bottom, 30%) — playback orchestration, event editing, and zoom. Shows one layer row per `selectedPlayer.track.layers` for the active player.

## Key Types (`src/components/types/`)

- `VideoState` — `{ file, url, duration, videoEl }`
- `Player` — `{ id, name, lifeTotal, handSize, cards[], track: Track }`
- `Track` — `{ id, layers: number, events: TrackEvent[] }` — owned by a Player
- `TrackEvent` — `{ id, time, layer: number, color, type: EventType, resizable, duration?, meta? }`
- `EventType` — 8 values: `ADD_TO_HAND`, `REMOVE_FROM_HAND`, `LOSE_LIFE`, `GAIN_LIFE`, `REVEAL_FROM_HAND`, `STACK_TOP`, `SHUFFLE`, `DISPLAY_CARD`

### Event categories

- **Persistent events** (`resizable: false`, e.g. LOSE_LIFE, ADD_TO_HAND) — fire at a single point in time and permanently modify player state going forward. Rendered as icons on the track.
- **Windowed events** (`resizable: true`, e.g. DISPLAY_CARD) — span a duration and show a transient overlay while active. Rendered as bars.

`EventColorMap` in `event.ts` maps each `EventType` to Tailwind color classes (text, bg, fill, stroke).

### meta field by event type

- `GAIN_LIFE` / `LOSE_LIFE` — `{ amount: number }`
- `ADD_TO_HAND` / `REMOVE_FROM_HAND` / `REVEAL_FROM_HAND` / `DISPLAY_CARD` — `{ cards: string[] }`
- `STACK_TOP` — `{ cards: string[] }` (single card)
- `SHUFFLE` — no meta

## Player & Track Model

Each `Player` owns exactly one `Track`. A track has `layers: number` rows (default 4), all belonging to the same player. `TrackEvent.layer` (0-indexed) places the event on a specific row within that track.

**Drag up/down** changes `event.layer` — it does not move events between players. Cross-player drag is not supported.

`usePlayerTracks` (`src/components/Timeline/hooks/usePlayerTracks.ts`) manages all player+track state. All event mutation handlers take `playerId` as their first argument.

## Timeline System (`src/components/Timeline/`)

**Timeline.tsx** — main orchestrator. Renders layer rows for the selected player only. Uses four hooks:
- `useZoom` — zoom in px/sec (range 5–50), converted to/from 0–100% for UI. Wheel events zoom centered on mouse.
- `useSeekDrag` — clicking/dragging the inner track area seeks the playhead.
- `useEventMoveDrag` — drag events; vertical drag changes `layer`, horizontal changes `time`. Emits `handleMoveEvent(playerId, eventId, newTime, newLayer)`.
- `useMarqueeDrag` — rubber-band selection across layers of the selected player.

**TimelineControls.tsx** — event creation (Cmd+K command dialog), playback controls (spacebar play/pause, skip), zoom slider.

**TimelineTrack.tsx** — one layer row. Maps events to `TimelineEvent` components. Background click triggers deselect.

**TimelineEvent.tsx** — individual event. Resizable events have left/right drag handles. Non-resizable events show an icon. Supports move-drag, context menu delete, click-to-select.

**TimelineTrackControl.tsx** — left sidebar; clickable list of players. Selecting a player switches the timeline view to their track layers.

**constants.ts** — `RULER_HEIGHT` (40px), `TRACK_HEIGHT` (48px), `MIN_ZOOM` (5 px/sec), `MAX_ZOOM` (50 px/sec).

## State Derivation (`src/lib/`)

**deriveState.ts**
- `derivePlayerState(player, events, time)` — applies all persistent events up to `time` in order to compute current player state.
- `getActiveWindowedEvents(events, time)` — events within their duration window (for canvas banners).
- `getNextChangeTime(tracks, time)` — next timestamp where derived state changes; used by VideoPreview's cache.

**stateHandlers.ts** — per-type mutations: `applyGainLife`, `applyLoseLife`, `applyAddToHand`, `applyRemoveFromHand`. `REVEAL_FROM_HAND`, `STACK_TOP`, `SHUFFLE` handlers are stubs.

## Inspector (`src/components/Inspector/`)

Per-type field components — not auto-derived from the meta shape. Card fields (`ADD_TO_HAND`, `REMOVE_FROM_HAND`, `REVEAL_FROM_HAND`, `DISPLAY_CARD`, `STACK_TOP`) use Scryfall autocomplete (`https://api.scryfall.com/cards/autocomplete?q=`) with react-query for caching and a 500ms debounce before firing. Life fields (`GAIN_LIFE`, `LOSE_LIFE`) are a plain number input. Changes call `handleUpdateMeta(playerId, eventId, meta)` from `usePlayerTracks`.

## Rendering (`src/renders/`)

**renderPlayerState.ts** — canvas 2D rendering of player info boxes (name, life total, hand size) at bottom corners of the video frame. Called per-frame from VideoPreview.

## UI Stack

shadcn/ui + Radix UI + Tailwind CSS v4. Components live in `src/components/ui/`. Path alias `@/*` maps to `src/*`. SVG icons auto-imported from `src/assets/icons/` via vite-plugin-svgr.

## Roadmap

| Version | Theme | Status |
|---------|-------|--------|
| **v0** | Foundation | 🟡 Current |
| **v1** | Export Ready | ⬜ Planned |
| **v2** | Streaming & Creator Tools | ⬜ Future |

**v1 targets** (must-haves before first release):
- Decklist import (MTGO format) per player — bulk-fetches Scryfall data once, caches images locally; autocomplete draws from deck cache first
- Cards-in-hand display — stacked card title crops always visible on overlay per player, rendered from local cache
- Project export/import — save and load the full timeline (players, events, deck data) to a JSON file
- Video export via wasm-ffmpeg (overlay-only or baked into video, runs in-browser)
- Inspector: player name + deck name editing (reflected on overlay)
- Complete state handlers for REVEAL_FROM_HAND, STACK_TOP, SHUFFLE (currently stubs)

**v2 targets**:
- Add / remove players from within the app
- Live overlay mode — `/control` + `/overlay` routes; controller manages an event stack, overlay renders chroma-keyed canvas synced via BroadcastChannel; popup window for clean OBS Window Capture
- Full overlay UI editor (drag/resize/style any element) + layout export & sharing
- Built-in macro library (common spell sequences like Brainstorm) + user-defined macros
- **Non-linear video editing** — Sources panel holds imported video files; clips are dragged onto a dedicated video track on the timeline (same drag mechanics as events); playback engine seeks the hidden `<video>` to `clip.sourceOffset + (currentTime - clip.startTime)` per frame; overlay events stay in output-timeline time so no time remapping needed; seeking latency mitigated with a small pool of preloading video elements

## Scryfall API Rate Limits

- `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` — 2 req/sec (500ms between requests)
- All other API methods — 10 req/sec (100ms between requests)
- Direct file origins (`*.scryfall.io`) — no rate limit
- HTTP 429 = access limited for 30 seconds. Continued overloading may result in temporary or permanent ban.
- All requests must include `User-Agent: Spellsplice/1.0` and `Accept: application/json` headers. This app runs in-browser so the browser's User-Agent is kept intact — do not override it. Use `fetch(url, { headers: { Accept: 'application/json' } })` for all Scryfall API calls.
- Do not assume anything beyond what is stated here.

## Conventions

- 4-space indentation, single quotes, trailing commas — see `.prettierrc`
- Canvas is used for video display only — the hidden `<video ref>` in VideoPreview handles decoding/audio
- Heavy use of `useRef` for performance-critical values (zoom, drag positions) to avoid unnecessary re-renders
- `useEffect` dependency arrays in drag hooks use primitive values (`selectedPlayer?.id`, `selectedPlayer?.track.layers`) rather than the object reference to avoid stale closures
