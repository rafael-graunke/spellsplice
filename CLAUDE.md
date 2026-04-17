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

**App.tsx** holds all canonical state (`isPlaying`, `currentTime`, `video: VideoState | null`, `selectedEvent: TrackEvent | null`) and passes it down via props. No external state management — plain React state + props drilling.

Three-panel layout (react-resizable-panels), vertical 70/30 split:
- **VideoPreview** (top-left, 75%) — renders video frames to a `<canvas>` via `drawImage` on a rAF loop. A hidden `<video>` element in the React tree handles actual decoding and audio. Syncs seek position and play/pause from props. Renders player state overlays (life totals, hand size) and active windowed event banners directly on the canvas each frame. Uses `derivedCacheRef` with a `validUntil` timestamp to skip redundant state derivation between frames.
- **Inspector** (top-right, 25%) — placeholder. Will be where users edit player config (name, decklist) and event properties (cards affected, life amount, etc.).
- **Timeline** (bottom, 30%) — orchestrates playback. Owns zoom state (`pxPerSec`). Drives `currentTime` forward via rAF while playing. Contains sub-components and hooks described below.

## Key Types (`src/components/types/`)

- `VideoState` — `{ file, url, duration, videoEl }`
- `Player` — `{ id, name, lifeTotal, handSize, cards[] }`
- `Track` — `{ id, playerId, events: TrackEvent[] }`
- `TrackEvent` — `{ id, time, duration, color, type: EventType, resizable, meta? }`
- `EventType` — enum of 8 types: `ADD_TO_HAND`, `REMOVE_FROM_HAND`, `LOSE_LIFE`, `GAIN_LIFE`, `REVEAL_FROM_HAND`, `STACK_TOP`, `SHUFFLE`, `DISPLAY_CARD`

### Event categories

Events fall into two categories based on the `resizable` flag:

- **Persistent events** (non-resizable, e.g. LOSE_LIFE, ADD_TO_HAND) — waypoints that fire at a single point in time and permanently modify player state going forward. Rendered as icons on the track.
- **Windowed events** (resizable, e.g. DISPLAY_CARD) — span a duration and show a transient overlay while active. Rendered as bars on the track. More windowed types may be added in the future.

`EventColorMap` in `event.ts` maps each `EventType` to Tailwind color classes (text, bg, fill, stroke).

## Players

On init, two players are created (20 life, empty hand). The editor supports up to 4 players. Player names and decklist names will be editable through the Inspector (not yet implemented).

## Timeline System (`src/components/Timeline/`)

**Timeline.tsx** — main orchestrator. Renders the controls bar, the track label sidebar, and the scrollable track area. Uses three hooks:
- `useZoom` — zoom in px/sec (range 5–50), converted to/from 0–100% for UI. Wheel events zoom centered on the mouse position.
- `useSeekDrag` — clicking/dragging the inner track area seeks the playhead.
- `useEventMoveDrag` — drag events between tracks, with a ghost preview rendered during the drag.

**TimelineControls.tsx** — three sections: event creation (Cmd+K command dialog), playback controls (play/pause via spacebar, skip to start/end), zoom slider + input.

**TimelineTrack.tsx** — renders one player's track row with a grid background. Maps events to `TimelineEvent` components. Handles deselection on background click.

**TimelineEvent.tsx** — individual event. Resizable events show a bar with left/right drag handles. Non-resizable events show an icon via `TimelineEventIcon`. Supports drag-to-move (cross-track), context menu delete, and click-to-select.

**TimelineEventIcon.tsx** — maps `EventType` to an SVG icon component with correct colors. Shows a white ring when selected.

**TimelineCursor.tsx** — red playhead (diamond + vertical line). Draggable for manual seek; pauses playback on drag start.

**TimelineRuler.tsx** — time scale with tick marks and labels. Tick density adapts to zoom level. Click or drag to seek. Drag with middle/right button to pan horizontally.

**TimelineTrackControl.tsx** — left sidebar showing player names aligned with track rows.

**constants.ts** — `RULER_HEIGHT` (40px), `TRACK_HEIGHT` (48px), `MIN_ZOOM` (5 px/sec), `MAX_ZOOM` (50 px/sec).

## State Derivation (`src/lib/`)

**deriveState.ts**
- `derivePlayerState(players, tracks, time)` — applies all persistent events up to `time` in chronological order to compute current player state.
- `getActiveWindowedEvents(tracks, time)` — returns events currently within their duration window (for canvas banner rendering).
- `getNextChangeTime(tracks, time)` — returns the timestamp of the next state change, used by VideoPreview's cache to know when to re-derive.

**stateHandlers.ts** — per-event-type mutations called by `derivePlayerState`: `applyGainLife`, `applyLoseLife`, `applyAddToHand`, `applyRemoveFromHand`. `REVEAL_FROM_HAND`, `STACK_TOP`, and `SHUFFLE` handlers are not yet implemented.

## Rendering (`src/renders/`)

**renderPlayerState.ts** — canvas 2D rendering of player info boxes (name, life total, hand size) in the bottom corners of the video frame. Called per-frame from VideoPreview.

## UI Stack

shadcn/ui + Radix UI + Tailwind CSS v4. Components live in `src/components/ui/`. Path alias `@/*` maps to `src/*`. SVG icons auto-imported from `src/assets/icons/` via vite-plugin-svgr.

## Conventions

- 4-space indentation, single quotes, trailing commas — see `.prettierrc`
- Canvas is used for video display only — the hidden `<video ref>` in VideoPreview handles decoding/audio
- Timeline zoom is in pixels-per-second, controlled by mouse wheel on the timeline
- Heavy use of `useRef` for performance-critical values (zoom, drag positions) to avoid unnecessary re-renders
