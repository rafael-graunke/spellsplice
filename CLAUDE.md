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

## What This Is

Spellsplice is a Magic: The Gathering video overlay editor. Users import video/audio sources, arrange clips on a non-linear timeline, and build a synchronized track of in-game events (life changes, draws, discards, etc.) that are overlaid on the exported video.

## Project Structure (bulletproof-react)

The repo follows the [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md) layout. **Follow it for all new code.**

```
src/
  App.tsx  main.tsx        # app shell (composes features)
  features/<feature>/      # domain features — most code lives here
    components/ hooks/ sections/ types.ts ...   # only the subfolders a feature needs
  components/ui/           # shadcn primitives — do NOT hand-edit (re-run the CLI to update)
  components/              # cross-feature shared app components (ErrorBoundary, theme-provider)
  hooks/                   # cross-feature reusable hooks only
  lib/                     # shared logic + configured third-party wrappers (lib/utils.ts = cn())
  renders/                 # shared canvas overlay renderers (timeline + live + export)
  types/                   # shared domain model (card, clip, event, player, source, config, video)
```

Current features: `live-mode`, `timeline`, `inspector`, `sources`, `settings`, `export`, `overlay`, `welcome`, `app-bar`.

Rules:
- **Unidirectional deps: `shared → features → app`.** A feature must NOT import from another feature. If two features need the same thing, promote it to `src/{lib,hooks,renders,types,components}` and compose at the app level. (Known pre-existing violations to unwind: `settings → live-mode`, `timeline → export`, `welcome → live-mode`.)
- **No `index.ts` barrels** in feature code — import files directly (protects Vite HMR/tree-shaking, avoids cycles). Existing `lib/export/index.ts` and `assets/icons/index.ts` are real modules, not feature barrels.
- **kebab-case folders**, **PascalCase component files**, colocated `types.ts` per feature; only genuinely shared types live in `src/types/`.
- **Start colocated, promote on second use**: a single-use hook/type/util stays next to its consumer; move to the feature's `hooks/`/`utils/`, then to `src/`, only when a second consumer appears. Prefer extracting logic into hooks over splitting components arbitrarily.
- Path alias `@/*` → `src/*`; import shared code via the alias.

## Architecture

**App.tsx** holds all canonical state and passes it down via props. No external state management — plain React state + props drilling. Key state:
- `players: Player[]` — managed by `usePlayerTracks`; each player owns their track and events
- `selectedPlayerId: string | null` — which player's track the timeline is showing
- `selectedEvents: TrackEvent[]` — currently selected events (shown in Inspector)
- `isPlaying`, `currentTime`, `video: VideoState | null`
- `fileToLoad: File | null` — signals VideoPreview to load a video file (used after project import)
- `isDirty: boolean` — unsaved changes flag; cleared on save/import/new
- `exportDialogOpen: boolean` — controls video export dialog visibility
- `mode: 'welcome' | 'timeline' | 'live'` — which of the three top-level screens is showing; persisted to `localStorage['spellsplice-mode']` so a refresh reopens the same screen. Welcome, Timeline, and Live Mode are treated as separate apps that share no state: Timeline's project data lives under `spellsplice-project`, Live Mode's hand/library/decklist state lives under `spellsplice-live-project` (see `src/lib/liveMode.ts`), and neither reads the other's config.
- Players autosave to `localStorage` under `spellsplice-project` on every change; restored on load. Only cleared by an explicit File > New, not on unload.

Layout: top AppBar + left Sources panel + main area (react-resizable-panels), vertical split:
- **AppBar** — always rendered, but its File menu is mode-aware (`FileDropdown`'s `mode` prop): disabled on Welcome, New/Open/Save/Export…/Settings/Relink Media on Timeline, New/Settings (websocket URL config, reusing `LiveModeDialog`) on Live Mode. File > New always clears the current mode's stored state and returns to Welcome. Keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+Alt+N, Ctrl+,) are gated the same way. Shows unsaved-changes confirmation dialog (Timeline only). Right side holds `ChannelMenu` (badge + version, popover to switch channels) - see Deploy Channels & Releases.
- **Sources panel** (left) — holds imported `MediaSource` files. Drag & drop or file-picker to add video/audio. Shows thumbnail + clip-use count per source. Red dot badge when any source is offline. Link icon opens `RelinkDialog` to reattach offline sources.
- **VideoPreview** (top-left, 75%) — renders video frames to a `<canvas>` via `drawImage` on a rAF loop. A hidden `<video>` element handles decoding/audio. Renders player state overlays and active windowed event banners directly on the canvas. Uses `derivedCacheRef` with a `validUntil` timestamp to skip redundant state derivation between frames.
- **Inspector** (top-right, 25%) — edits the selected event's `meta` fields. Per-type form components.
- **Timeline** (bottom, 30%) — non-linear editor. Track groups per player (event rows) + shared video/audio tracks for clips. Waveform and frame thumbnails rendered on clips. Full undo/redo via `useHistory`.

## Key Types (`src/types/`, timeline types in `src/features/timeline/types.ts`)

- `VideoState` — `{ file, url, duration, videoEl }`
- `Card` — `{ name: string, edition?: string, revealed?: boolean }`
- `Player` — `{ id, name, lifeTotal, handSize, cards: Card[], track: Track, deckName?: string, decklist?: Decklist }`
- `Decklist` — `{ maindeck: Array<{card: Card, quantity: number}>, sideboard?: Array<{card: Card, quantity: number}> }`
- `Track` — `{ id, layers: number, events: TrackEvent[] }` — owned by a Player
- `TrackEvent` — `{ id, time, layer: number, type: EventType, resizable, duration?, meta? }` — no `color` field; color derived from `EventColorMap`
- `EventType` — 12 values: `ADD_TO_HAND`, `REMOVE_FROM_HAND`, `LOSE_LIFE`, `GAIN_LIFE`, `REVEAL_FROM_HAND`, `STACK_DECK`, `UNSTACK_DECK`, `DISPLAY_CARD`, `WIN`, `HIDE_UI`, `SHOW_UI`, `RESET`
- `MediaSource` — `{ id, name, type: 'video'|'audio', duration, file?, thumbnailUrl?, loading? }` — source file in Sources panel
- `Clip` — `{ id, type: ClipType, time, duration, sourceId, sourceOffset, trackId? }` — placed on timeline video/audio tracks. `time` = output-timeline position; `sourceOffset` = start within source file.
- `ClipType` — `VIDEO | AUDIO`
- `TimelineTrackGroup` — `{ id, label, type: TrackType, tracks: TimelineTrack[] }` — one group per player (Event type) + shared video/audio groups
- `TimelineTrack` — `{ id, type, events, clips?, player?, isBlocked, isHidden?, isMuted?, eventLayer? }` — single row. `eventLayer` stable index for filtering player events.
- `TrackType` — `EVENT | VIDEO | AUDIO`
- `ProjectConfig` — `{ title, author, defaultLifeTotal, defaultLayerCount, overlayStartHidden }` — project-level settings stored in state

### Event categories

- **Persistent events** (`resizable: false`, e.g. LOSE_LIFE, ADD_TO_HAND) — fire at a single point in time and permanently modify player state going forward. Rendered as icons on the track.
- **Windowed events** (`resizable: true`, e.g. DISPLAY_CARD) — span a duration and show a transient overlay while active. Rendered as bars.

`EventColorMap` in `event.ts` maps each `EventType` to Tailwind color classes (text, bg, fill, stroke).

### meta field by event type

- `GAIN_LIFE` / `LOSE_LIFE` — `{ amount: number }`
- `ADD_TO_HAND` / `STACK_DECK` — `{ cards: Card[] }` — free-text card autocomplete
- `REMOVE_FROM_HAND` / `REVEAL_FROM_HAND` — `{ cards: Card[] }` — picked from derived hand state at event time
- `DISPLAY_CARD` — `{ cards: Card[] }` (single card, free-text autocomplete)
- `UNSTACK_DECK` / `WIN` / `HIDE_UI` / `SHOW_UI` / `RESET` — no meta

## Player & Track Model

Each `Player` owns exactly one `Track`. A track has `layers: number` rows (default 4), all belonging to the same player. `TrackEvent.layer` (0-indexed) places the event on a specific row within that track.

**Drag up/down** changes `event.layer` — it does not move events between players. Cross-player drag is not supported.

`usePlayerTracks` (`src/features/timeline/hooks/usePlayerTracks.ts`) manages all player+track state. All event mutation handlers take `playerId` as their first argument. `handleUpdatePlayer(playerId, { name?, deckName?, decklist? })` updates player metadata.

## Timeline System (`src/features/timeline/`)

Replaced the old single-player timeline. All timeline editing now goes through this system.

**Timeline.tsx** — main orchestrator. Renders `TimelineTrackGroup[]` — one group per player (event rows) plus shared Video/Audio groups. Uses `react-resizable-panels` to give the target (focused) player group full width. Key hooks:
- `useTimelineZoom` — zoom in px/sec (range 5–50), converted to/from 0–100%.
- `useTimelineScroll` — horizontal scroll state.
- `useTimelineViewport` — computes visible time window.
- `usePlayhead` — playhead position + seek on click.
- `useTimelineSelection` — selected event/clip IDs.
- `useTimelineKeyboard` — keyboard shortcuts (delete, undo/redo).
- `useElementDrag` — unified drag for events and clips; vertical drag changes layer/track, horizontal changes time/clip.time.
- `useMarqueeDrag` — rubber-band multi-select.
- `useTimelineAutoScroll` — auto-scrolls during drag near edges.

**Controls.tsx** — playback controls (spacebar play/pause, skip), zoom slider. Cmd+K opens event creation dialog.

**Track.tsx** — `Track` (single row) and `TrackGroup` (player group with expand/collapse). Track header shows mute/hide/block controls.

**TimelineClip.tsx** — clip bar with waveform canvas (audio) and frame thumbnail strip (video).

**TimelineEvent.tsx** / **EventResizable.tsx** / **EventIcon.tsx** — event rendering; resizable events have drag handles; non-resizable show icon.

**Ruler.tsx** — time ruler with tick marks.

**Cursor.tsx** — playhead cursor overlay (imperative handle for perf).

**constants.ts** (`src/features/timeline/constants.ts`) — `RULER_HEIGHT` (40px), `TRACK_HEIGHT` (48px), `TRACK_GROUP_LABEL_WIDTH`, `TRACK_INFO_WIDTH`, `MIN_ZOOM` (5 px/sec), `MAX_ZOOM` (50 px/sec).

## State Derivation (`src/lib/`)

**deriveState.ts**
- `derivePlayerState(player, events, time)` — applies all persistent events up to `time` in order to compute current player state.
- `getActiveWindowedEvents(events, time)` — events within their duration window (for canvas banners).
- `getNextChangeTime(tracks, time)` — next timestamp where derived state changes; used by VideoPreview's cache.

**stateHandlers.ts** — per-type mutations: `applyGainLife`, `applyLoseLife`, `applyAddToHand`, `applyRemoveFromHand`, `applyStackDeck`, `applyUnstackDeck`, `applyWin`, `applyReset`. `REVEAL_FROM_HAND` is handled inline in `deriveState.ts` (marks cards as `revealed: true`).

## Sources Panel (`src/features/sources/`)

**index.tsx** (`Sources`) — drag-and-drop + file-picker for video/audio files. Generates thumbnail via `generateThumbnail` and duration via `getFileDuration`. Shows clip-use counts (counts references across all `clipsByTrack`). Red dot when any source has no `file` (offline). Link button opens `RelinkDialog`.

**RelinkDialog.tsx** — lists all sources; offline sources have a "Choose file" button to reattach. Called on project open when saved sources have no matching file in the ZIP.

## Settings Dialog (`src/features/settings/`)

**SettingsDialog.tsx** — multi-section settings dialog. Sections: Project Metadata (`title`, `author`), Players (name/deck editing per player), Player Defaults (`defaultLifeTotal`, `defaultLayerCount`), Overlay Appearance (`overlayStartHidden`). Driven by `ProjectConfig` state in `App.tsx`.

## Inspector (`src/features/inspector/`)

Per-type field components dispatched by `EventFields.tsx`:
- `LifeFields` — plain number input for GAIN_LIFE / LOSE_LIFE.
- `CardFields` — Scryfall autocomplete (`useCardSearch`) for ADD_TO_HAND, STACK_DECK, DISPLAY_CARD. Searches player deck/hand first, falls back to Scryfall API.
- `HandPickerFields` — for REMOVE_FROM_HAND and REVEAL_FROM_HAND. Derives the player's hand at `event.time` (excluding the event itself), presents checkboxes. Supports multi-copy cards with ±buttons.

Changes call `handleUpdateMeta(playerId, eventId, meta)` from `usePlayerTracks`.

## Rendering (`src/renders/`)

**Timeline and Live Mode share ONE overlay renderer set.** The four `renderLive*` renderers are pure
canvas functions driven by the same config (`liveMode.ts` types). Timeline is derived-state, so
`src/lib/overlayData.ts` synthesizes their inputs from the event replay; Live Mode feeds them from its
socket state. Do not fork a timeline-specific renderer — extend the shared one with an optional,
undefined-defaulted param (as `edition`/`revealed`/`eyeIcon` were added) so both modes stay identical.

- **renderCardStrips.ts** — shared card title-bar crop strips. Exports `drawCardStrip`, `STRIP_W`,
  `getStripH`. Caches the curve-masked strip per `name|edition|stripW` (masking is the expensive part).
- **renderLiveHand.ts** — hand stack. Anchor/offset/growth/insert/maxHeight from `LiveHandStackConfig`;
  enter/exit anims keyed by stable `card.id`; overflow `+N` pill; exports `getHandStackTopY`.
- **renderLiveAnnotation.ts** — per-slot annotation boxes with `follow` (pin above hand), container
  enter/exit vs per-card modes.
- **renderLiveCardDisplay.ts** — featured DISPLAY_CARD per side; fade/slide animation; DFC back-face.
- **renderLiveScoreboard.ts** — SVG-template scoreboard. `getLiveScoreboardImage` caches the decoded
  image by substituted-SVG string; `preloadScoreboardImage` awaits a decode for export.

**overlayData.ts** — the derived-state → live-renderer-input adapter (`toHand`, `toAnnotations`,
`toDisplayCards`, `toPlayerInfo`, `collectCardImageRequests`). Animations use `now = time * 1000` /
`start = eventTime * 1000` so scrub and export are deterministic.

`Compositor.updateOverlay` (`src/features/export/compose.ts`) runs the layer-order dispatch loop; the
whole-overlay HIDE_UI/SHOW_UI fade is the `uOverlayAlpha` shader uniform, not per-renderer.

### Overlay render performance — invariants (do NOT regress)

`updateOverlay` runs **every frame** during any animation (`validUntil = time + 0.001` in
`VideoPreview.tsx` / `pipeline.ts`). The overlay was made smooth by these rules; breaking one brings
the jank back:

- **No per-frame allocation / no per-frame re-decode in the draw path.** Cache expensive raster
  (masked strips in `renderCardStrips.ts`) and parse (scoreboard SVG) keyed on content; invalidate
  only when the content changes, never per frame.
- **Feed ref-equality caches a STABLE reference.** `getLiveScoreboardImage`'s fast path is keyed on
  reference equality of its inputs; `Compositor.stableInfo` exists solely to reuse the same
  `LivePlayerInfo` object while its fields are unchanged. Never pass a freshly-allocated object into
  such a cache every frame (that was the original scoreboard lag — a full SVG reparse per frame).
- **Derive animation from event timestamps, never `performance.now()`** — required for deterministic
  scrub + export.
- **Export must block on async assets; never bake a placeholder or a stale frame.** The preview may
  draw a placeholder and repaint when art arrives, but a video is permanent. `pipeline.ts` gates on
  `preloadCardImages` (fails naming the missing cards) and on `preloadScoreboardImage` (waits for the
  decode matching the current state). Any new async-loaded overlay asset needs the same export gate.
- A dev-only frame-cost warning fires from `renderFrame` (`VideoPreview.tsx`) when a frame exceeds a
  budget — watch the console when touching the render path.

## Card Cache (`src/lib/cardCache.ts`)

Module-level in-memory cache for Scryfall card data and decoded `HTMLImageElement`s. Persists to `localStorage` under `spellsplice-card-cache`.

- `ensureImage(name, edition?)` — returns `HTMLImageElement | 'loading' | 'error'`. Triggers a background `ensureCardData` fetch if not cached.
- `ensureBorderCrop(name, edition?)` — returns `{ img, frame }` for the border-crop image and frame year string.
- `verifyCard(name, edition?)` — async, returns `boolean`. Used when importing decklists.
- `restoreCardDataCache(data)` — hydrates cache from serialized data (called on project import and startup).

Fetches go through `scryfallQueue.ts`'s `slowFetch` (500ms throttle). Stores `normal` and `border_crop` image URIs per card+set.

## Utilities (`src/lib/`)

**generateThumbnail.ts** — `generateThumbnail(file): Promise<string>` captures a frame from a video file as a data URL. `getFileDuration(file): Promise<number>` reads media duration via a hidden element.

**platform.ts** — `isMac` (UA detection), `modKey` (`'⌘'` or `'Ctrl'`). Use for keyboard shortcut labels.

## Scryfall Queue (`src/lib/scryfallQueue.ts`)

`slowFetch(url)` — throttled `fetch` wrapper. Serializes all requests with 500ms spacing (promise chain). Used for all Scryfall API calls except the autocomplete endpoint (which is called via raw `fetch` in `useCardSearch`).

## Decklist Parsing (`src/lib/parseDecklist.ts`)

`parseDecklist(text): Decklist` — parses MTGO export format: `<qty> <name> [(<set>)]` per line. A bare `sideboard` line switches subsequent cards to the sideboard section.

## Project File Format (`src/lib/projectExport.ts`)

`.sps` files are ZIP archives (JSZip) containing:
- `project.json` — `{ version: '1', createdAt, players: Player[], config?, clipsByTrack?, trackOverrides?, sources?: SourceMeta[] }`
- `card-data-cache.json` — serialized `cardDataCache`

Media source files are **not bundled** — sources are stored as metadata only (`id, name, duration, type`). On import, all sources come back offline; `RelinkDialog` prompts the user to reattach files.

`exportProject(players, config, clipsByTrack, trackOverrides, sources)` — builds ZIP, triggers browser download.
`importProject(file)` — extracts manifest, restores card cache, returns `offlineSources`.

## Video Export Pipeline (`src/features/export/`)

In-browser baked video export using WebCodecs + WebGL. Requires Chrome/Edge (uses `VideoEncoder`, `VideoDecoder`, `showSaveFilePicker`).

- **`pipeline.ts`** (`exportVideo`) — main orchestrator. Picks codec, opens save dialog, demuxes source video/audio, transcodes audio to Opus if exporting WebM, encodes frames via `Compositor` + `Encoder`, muxes output.
- **`codec.ts`** — codec detection: prefers AVC/H.264→MP4, falls back to VP9→WebM. Opens `showSaveFilePicker` save dialog.
- **`compose.ts`** (`Compositor`) — WebGL compositor on `OffscreenCanvas`. Video frame → `TEXTURE0`, overlay (rendered via canvas 2D) → `TEXTURE1`. GLSL shader letterboxes video and alpha-blends overlay. `updateOverlay()` calls `renderPlayerState` + `renderHandStack` + active card banners.
- **`demux.ts`** — streams `EncodedVideoChunk` / `EncodedAudioChunk` from source file.
- **`encode.ts`** (`Encoder`) — wraps `VideoEncoder`; keyframe every 2 seconds.
- **`mux.ts`** — wraps mp4-muxer.
- **`transcode.ts`** — transcodes any audio to Opus (for WebM output).

Output is always 1920×1080, letterboxed. Frame rate: 30 or 60 fps (user selects in `ExportDialog`).

`ExportDialog.tsx` (`src/features/export/ExportDialog.tsx`) — dialog UI: fps picker, progress bar with ETA, cancel, error retry. Not available on Firefox (shows tooltip).

## Hooks (`src/hooks/`)

**useCardSearch(query, player?)** — card name autocomplete. Returns results from player's hand + decklist first (no network); falls back to Scryfall `/cards/autocomplete` with 500ms debounce if no local matches.

**useCardPrintings(name)** — fetches all printings for a card name via Scryfall `/cards/search?unique=prints`. Deduplicates by set code.

**useHistory(initialState)** (`src/lib/useHistory.ts`) — immer-based undo/redo. `record(recipe)` mutates via `produceWithPatches` and pushes to history stack (max 100). `mutate(recipe)` mutates without recording. `recordFromBaseline(before)` snapshots for resize commits. Exposes `undo()`, `redo()`, `undoCount`, `redoCount`.

**useWaveformPeaks(source)** (`src/hooks/useWaveformPeaks.ts`) — extracts audio peaks from a `MediaSource` file via Web Audio API (`PEAKS_PER_SECOND = 100`). Returns `{ peaks: Float32Array, duration }`.

**useVideoThumbnails(clips, sources)** (`src/hooks/useVideoThumbnails.ts`) — generates frame thumbnail URLs for video clips. Returns `ClipInfo` map keyed by clip ID.

## UI Stack

shadcn/ui + Radix UI + Tailwind CSS v4. Components live in `src/components/ui/`. Path alias `@/*` maps to `src/*`. SVG icons auto-imported from `src/assets/icons/` via vite-plugin-svgr.

## Deploy Channels & Releases

Hosted on Cloudflare Workers static assets (`wrangler.jsonc`, assets-only Worker, SPA fallback). Three channels:

| Channel | URL | Deploy |
|---------|-----|--------|
| `dev` | localhost | `npm run dev` (local only) |
| `beta` | beta.spellsplice.com | every push to main, continuous |
| `stable` | app.spellsplice.com | manual promotion only |

**Build-time constants** (`vite.config.ts`, injected via `define`):
- `__APP_CHANNEL__` (`'stable' | 'beta' | 'dev'`) — from `process.env.APP_CHANNEL`, defaulting to `stable` on build and `dev` on serve. `release.yml` sets `APP_CHANNEL=beta`.
- `__APP_VERSION__` — `stable` uses the bare `package.json` version (e.g. `1.3.0`); every other channel uses `git describe --tags` (e.g. `1.3.0-6-g3fc32cb`): unique per commit, ordered, traceable. The tag's leading `v` is stripped so the string is bare semver. `git describe` needs tags in the checkout (CI uses `fetch-depth: 0`).

**ChannelMenu** (`src/features/app-bar/ChannelMenu.tsx`) — right-side AppBar badge showing current channel + version; click opens a popover listing all three channels with switch links (beta/stable are links, dev is local-only, current is marked). Badge colours are semantic (green = stable, amber = beta, blue = dev). `index.tsx` tints the whole bar to match on beta/dev; stable gets no tint (the default, unremarkable state).

**Release model** — releases are cut only at promotion, not per commit:
- **`release.yml` (Deploy Beta)** — on push to main. Build + `wrangler deploy --env=beta`. No version bump, no changelog, no tag, no GitHub release. Beta = latest main, all commit types.
- **`promote.yml` (Promote to Production)** — manual `workflow_dispatch`. Runs `semantic-release`, which batches every commit since the last tag into a single version bump + `CHANGELOG.md` entry + tag + GitHub release, then builds and `wrangler deploy --env=""` (stable). semantic-release pushes a `chore(release): x.y.z [skip ci]` commit; the `[skip ci]` stops it re-triggering the beta deploy. Promoting does not redeploy beta, so beta's version label stays stale until the next push to main.

Because `semantic-release` runs only at promotion, commit type still matters for versioning: `feat`/`fix` drive the next bump; `ci`/`build`/`chore`/`docs` do not. A commit that changes the release pipeline itself should be `ci`/`build`, never `fix` (which would wrongly bump).

## Roadmap

| Version | Theme | Status |
|---------|-------|--------|
| **v0** | Foundation | ✅ Done |
| **v1** | Export Ready | ✅ Done |
| **v2** | Streaming & Creator Tools | 🟡 Current |
| **v3** | Desktop App | ⬜ Future |

**v1 targets**:
- ✅ Decklist import (MTGO format) per player — `parseDecklist` + `handleUpdatePlayer`
- ✅ Cards-in-hand display — `renderHandStack` renders title-bar crops on overlay per player
- ✅ Project export/import — `.sps` ZIP via JSZip
- ✅ Video export — in-browser via WebCodecs + WebGL compositor (Chrome/Edge only)
- ✅ Inspector: player name + deck name editing
- ✅ Settings dialog — Project Metadata, Players, Player Defaults, Overlay Appearance sections
- ✅ Deck stack overlay — `renderDeckStack` with entrance animation
- ✅ New event types — `WIN`, `HIDE_UI`, `SHOW_UI`, `RESET`
- ✅ Source relink — `RelinkDialog` + offline detection when opening projects
- ✅ Complete state handlers — `REVEAL_FROM_HAND` handled inline in `deriveState.ts`; `applyUnstackDeck` + `applyWin` + `applyReset` implemented in `stateHandlers.ts`

**v2 targets**:
- Add / remove players from within the app
- **Non-linear video editing** (in progress — basic clips + drag implemented; missing: trimming, multi-source sync, playback engine per-clip seeking, full export integration)
- Live overlay mode: the `/overlay` route renders a transparent 1920x1080 canvas (no chroma key). The Live Mode controller UI (in the main app) syncs to it over a WebSocket via a small local relay (`spellsplice-relay.py`), configured in `LiveModeDialog` > Connection. Added to OBS as a transparent Browser Source pointing at `/overlay?ws=<relay>`. See `useLiveModeSocket.ts` and `OverlayPage.tsx`. (No `/control` route, no BroadcastChannel.)
- Full overlay UI editor (drag/resize/style any element) + layout export & sharing
- Built-in macro library (common spell sequences like Brainstorm) + user-defined macros
- **Annotation system** — replaces `STACK_DECK`/`UNSTACK_DECK` with generic `ANNOTATE`/`CLEAR_ANNOTATION` events; multiple simultaneous annotations per player keyed by slot ID; project-level slot registry with system slots (top-of-deck, pithing-needle, disruptor-flute, meddling-mage) + user-defined slots; slot titles are user-editable and resolve at render time; macros target slot IDs directly; see `docs/annotation-system.md`

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
