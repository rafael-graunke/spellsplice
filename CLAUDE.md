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
- `fileToLoad: File | null` — signals VideoPreview to load a video file (used after project import)
- `isDirty: boolean` — unsaved changes flag; cleared on save/import/new
- `exportDialogOpen: boolean` — controls video export dialog visibility
- Players autosave to `localStorage` under `spellsplice-autosave` on every change; restored on load.

Four-panel layout: top AppBar + three-panel (react-resizable-panels), vertical 70/30 split:
- **AppBar** — File menu (New/Open/Save/Export…). Keyboard shortcuts: Ctrl+S (save), Ctrl+O (open), Ctrl+Alt+N (new). Shows unsaved-changes confirmation dialog.
- **VideoPreview** (top-left, 75%) — renders video frames to a `<canvas>` via `drawImage` on a rAF loop. A hidden `<video>` element handles decoding/audio. Renders player state overlays and active windowed event banners directly on the canvas. Uses `derivedCacheRef` with a `validUntil` timestamp to skip redundant state derivation between frames.
- **Inspector** (top-right, 25%) — edits the selected event's `meta` fields. Per-type form components.
- **Timeline** (bottom, 30%) — playback orchestration, event editing, and zoom. Shows one layer row per `selectedPlayer.track.layers` for the active player.

## Key Types (`src/components/types/`)

- `VideoState` — `{ file, url, duration, videoEl }`
- `Card` — `{ name: string, edition?: string, revealed?: boolean }`
- `Player` — `{ id, name, lifeTotal, handSize, cards: Card[], track: Track, deckName?: string, decklist?: Decklist }`
- `Decklist` — `{ maindeck: Array<{card: Card, quantity: number}>, sideboard?: Array<{card: Card, quantity: number}> }`
- `Track` — `{ id, layers: number, events: TrackEvent[] }` — owned by a Player
- `TrackEvent` — `{ id, time, layer: number, type: EventType, resizable, duration?, meta? }` — no `color` field; color derived from `EventColorMap`
- `EventType` — 8 values: `ADD_TO_HAND`, `REMOVE_FROM_HAND`, `LOSE_LIFE`, `GAIN_LIFE`, `REVEAL_FROM_HAND`, `STACK_DECK`, `UNSTACK_DECK`, `DISPLAY_CARD`

### Event categories

- **Persistent events** (`resizable: false`, e.g. LOSE_LIFE, ADD_TO_HAND) — fire at a single point in time and permanently modify player state going forward. Rendered as icons on the track.
- **Windowed events** (`resizable: true`, e.g. DISPLAY_CARD) — span a duration and show a transient overlay while active. Rendered as bars.

`EventColorMap` in `event.ts` maps each `EventType` to Tailwind color classes (text, bg, fill, stroke).

### meta field by event type

- `GAIN_LIFE` / `LOSE_LIFE` — `{ amount: number }`
- `ADD_TO_HAND` / `STACK_DECK` — `{ cards: Card[] }` — free-text card autocomplete
- `REMOVE_FROM_HAND` / `REVEAL_FROM_HAND` — `{ cards: Card[] }` — picked from derived hand state at event time
- `DISPLAY_CARD` — `{ cards: Card[] }` (single card, free-text autocomplete)
- `UNSTACK_DECK` — no meta

## Player & Track Model

Each `Player` owns exactly one `Track`. A track has `layers: number` rows (default 4), all belonging to the same player. `TrackEvent.layer` (0-indexed) places the event on a specific row within that track.

**Drag up/down** changes `event.layer` — it does not move events between players. Cross-player drag is not supported.

`usePlayerTracks` (`src/components/Timeline/hooks/usePlayerTracks.ts`) manages all player+track state. All event mutation handlers take `playerId` as their first argument. `handleUpdatePlayer(playerId, { name?, deckName?, decklist? })` updates player metadata.

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

**stateHandlers.ts** — per-type mutations: `applyGainLife`, `applyLoseLife`, `applyAddToHand`, `applyRemoveFromHand`. `REVEAL_FROM_HAND`, `STACK_DECK`, `UNSTACK_DECK` handlers are stubs.

## Inspector (`src/components/Inspector/`)

Per-type field components dispatched by `EventFields.tsx`:
- `LifeFields` — plain number input for GAIN_LIFE / LOSE_LIFE.
- `CardFields` — Scryfall autocomplete (`useCardSearch`) for ADD_TO_HAND, STACK_DECK, DISPLAY_CARD. Searches player deck/hand first, falls back to Scryfall API.
- `HandPickerFields` — for REMOVE_FROM_HAND and REVEAL_FROM_HAND. Derives the player's hand at `event.time` (excluding the event itself), presents checkboxes. Supports multi-copy cards with ±buttons.

Changes call `handleUpdateMeta(playerId, eventId, meta)` from `usePlayerTracks`.

## Rendering (`src/renders/`)

**renderPlayerState.ts** — canvas 2D rendering of player info boxes (name, life total, hand size) at bottom corners of the video frame.

**renderHandStack.ts** — canvas 2D rendering of hand-stack overlays. Renders a title-bar crop strip per card in hand, stacked vertically. Frame-aware cropping: `EDITION_CROPS` for specific set codes (alpha/beta/etc.), `FRAME_CROPS` for frame year. Eye icon (semi-transparent) marks revealed cards. Left player: left edge; right player: right edge.

## Card Cache (`src/lib/cardCache.ts`)

Module-level in-memory cache for Scryfall card data and decoded `HTMLImageElement`s. Persists to `localStorage` under `spellsplice-card-cache`.

- `ensureImage(name, edition?)` — returns `HTMLImageElement | 'loading' | 'error'`. Triggers a background `ensureCardData` fetch if not cached.
- `ensureBorderCrop(name, edition?)` — returns `{ img, frame }` for the border-crop image and frame year string.
- `verifyCard(name, edition?)` — async, returns `boolean`. Used when importing decklists.
- `restoreCardDataCache(data)` — hydrates cache from serialized data (called on project import and startup).

Fetches go through `scryfallQueue.ts`'s `slowFetch` (500ms throttle). Stores `normal` and `border_crop` image URIs per card+set.

## Scryfall Queue (`src/lib/scryfallQueue.ts`)

`slowFetch(url)` — throttled `fetch` wrapper. Serializes all requests with 500ms spacing (promise chain). Used for all Scryfall API calls except the autocomplete endpoint (which is called via raw `fetch` in `useCardSearch`).

## Decklist Parsing (`src/lib/parseDecklist.ts`)

`parseDecklist(text): Decklist` — parses MTGO export format: `<qty> <name> [(<set>)]` per line. A bare `sideboard` line switches subsequent cards to the sideboard section.

## Project File Format (`src/lib/projectExport.ts`)

`.spellsplice` files are ZIP archives (JSZip) containing:
- `project.json` — `{ version: '1', createdAt, players: Player[], video?: { filename, duration } }`
- `video/<filename>` — the source video file (if loaded)
- `card-data-cache.json` — serialized `cardDataCache`

`exportProject(players, video)` — builds ZIP, triggers browser download.
`importProject(file)` — extracts manifest + video file, restores card cache.

## Video Export Pipeline (`src/lib/export/`)

In-browser baked video export using WebCodecs + WebGL. Requires Chrome/Edge (uses `VideoEncoder`, `VideoDecoder`, `showSaveFilePicker`).

- **`pipeline.ts`** (`exportVideo`) — main orchestrator. Picks codec, opens save dialog, demuxes source video/audio, transcodes audio to Opus if exporting WebM, encodes frames via `Compositor` + `Encoder`, muxes output.
- **`codec.ts`** — codec detection: prefers AVC/H.264→MP4, falls back to VP9→WebM. Opens `showSaveFilePicker` save dialog.
- **`compose.ts`** (`Compositor`) — WebGL compositor on `OffscreenCanvas`. Video frame → `TEXTURE0`, overlay (rendered via canvas 2D) → `TEXTURE1`. GLSL shader letterboxes video and alpha-blends overlay. `updateOverlay()` calls `renderPlayerState` + `renderHandStack` + active card banners.
- **`demux.ts`** — streams `EncodedVideoChunk` / `EncodedAudioChunk` from source file.
- **`encode.ts`** (`Encoder`) — wraps `VideoEncoder`; keyframe every 2 seconds.
- **`mux.ts`** — wraps mp4-muxer.
- **`transcode.ts`** — transcodes any audio to Opus (for WebM output).

Output is always 1920×1080, letterboxed. Frame rate: 30 or 60 fps (user selects in `ExportDialog`).

`ExportDialog.tsx` (`src/components/ExportDialog.tsx`) — dialog UI: fps picker, progress bar with ETA, cancel, error retry. Not available on Firefox (shows tooltip).

## Hooks (`src/hooks/`)

**useCardSearch(query, player?)** — card name autocomplete. Returns results from player's hand + decklist first (no network); falls back to Scryfall `/cards/autocomplete` with 500ms debounce if no local matches.

**useCardPrintings(name)** — fetches all printings for a card name via Scryfall `/cards/search?unique=prints`. Deduplicates by set code.

## UI Stack

shadcn/ui + Radix UI + Tailwind CSS v4. Components live in `src/components/ui/`. Path alias `@/*` maps to `src/*`. SVG icons auto-imported from `src/assets/icons/` via vite-plugin-svgr.

## Roadmap

| Version | Theme | Status |
|---------|-------|--------|
| **v0** | Foundation | ✅ Done |
| **v1** | Export Ready | 🟡 Current |
| **v2** | Streaming & Creator Tools | ⬜ Future |
| **v3** | Desktop App | ⬜ Future |

**v1 targets**:
- ✅ Decklist import (MTGO format) per player — `parseDecklist` + `handleUpdatePlayer`
- ✅ Cards-in-hand display — `renderHandStack` renders title-bar crops on overlay per player
- ✅ Project export/import — `.spellsplice` ZIP via JSZip
- ✅ Video export — in-browser via WebCodecs + WebGL compositor (Chrome/Edge only)
- ✅ Inspector: player name + deck name editing
- ⬜ Complete state handlers for REVEAL_FROM_HAND, STACK_DECK, UNSTACK_DECK (currently stubs)

**v2 targets**:
- Add / remove players from within the app
- Live overlay mode — `/control` + `/overlay` routes; controller manages an event stack, overlay renders chroma-keyed canvas synced via BroadcastChannel; popup window for clean OBS Window Capture
- Full overlay UI editor (drag/resize/style any element) + layout export & sharing
- Built-in macro library (common spell sequences like Brainstorm) + user-defined macros
- **Annotation system** — replaces `STACK_DECK`/`UNSTACK_DECK` with generic `ANNOTATE`/`CLEAR_ANNOTATION` events; multiple simultaneous annotations per player keyed by slot ID; project-level slot registry with system slots (top-of-deck, pithing-needle, disruptor-flute, meddling-mage) + user-defined slots; slot titles are user-editable and resolve at render time; macros target slot IDs directly; see `docs/annotation-system.md`
- **Non-linear video editing** — Sources panel holds imported video files; clips are dragged onto a dedicated video track on the timeline (same drag mechanics as events); playback engine seeks the hidden `<video>` to `clip.sourceOffset + (currentTime - clip.startTime)` per frame; overlay events stay in output-timeline time so no time remapping needed; seeking latency mitigated with a small pool of preloading video elements

**v3 targets**:
- Tauri wrapper (Rust backend + system webview; ~5–10 MB runtime vs ~150 MB Electron)
- FFmpeg video export — replace WebCodecs pipeline via Rust backend; order-of-magnitude faster, cross-platform
- Scryfall bulk data — download full card database (~2.3 GB) on first run; SQLite + FTS5 via `rusqlite` for sub-millisecond lookups; eliminates API rate limit workarounds

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
