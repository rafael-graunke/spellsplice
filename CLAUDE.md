# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

There are no tests.

## What This Is

Spellsplice is a Magic: The Gathering video overlay editor. Users load a video file and build a synchronized timeline of in-game events (life changes, draws, discards, etc.) that can be overlaid on the video.

## Architecture

**App.tsx** holds all canonical state (`isPlaying`, `currentTime`, `video: VideoState | null`) and passes it down via props. No external state management — plain React state + props drilling.

Three-panel layout (react-resizable-panels):
- **VideoPreview** (top-left) — renders video frames to a `<canvas>` via `drawImage` on a rAF loop. A hidden `<video>` element in the React tree handles actual decoding and audio. Syncs seek position and play/pause from props.
- **Inspector** (top-right) — placeholder, not yet implemented.
- **Timeline** (bottom) — orchestrates playback. Owns zoom state (`pxPerSec`). Drives `currentTime` forward via rAF while playing. Contains sub-components: `TimelineControls`, `TimelineTrackControl`, `TimelineRuler`, `TimelineCursor`.

**Key types** are in `src/components/types/`:
- `VideoState` — `{ file, url, duration, videoEl }`
- `Player` — `{ id, name, lifeTotal, handSize, librarySize }`

**UI stack:** shadcn/ui + Radix UI + Tailwind CSS. Components live in `src/components/ui/`. Path alias `@/*` maps to `src/*`.

## Conventions

- 4-space indentation, single quotes, trailing commas (see `.prettierrc`)
- Canvas is used for video display only — the hidden `<video ref>` in VideoPreview handles decoding/audio
- Timeline zoom is in pixels-per-second (range 5–200), controlled by mouse wheel on the timeline
