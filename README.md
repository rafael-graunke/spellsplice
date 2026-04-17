<div align="center">

  <img src="assets/logo.png" alt="logo" width="auto" height="auto" />
  <h1>Spellsplice</h1>

  <p>
    Unofficial Magic: The Gathering video overlay editor.
  </p>

</div>

<br />

# Table of Contents

- [About](#about)
- [Features](#features)
- [Screenshots](#screenshots)
- [Install](#install)
- [Local Development](#local-development)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Commands](#commands)
- [Roadmap](#roadmap)

---

## About

Spellsplice is an unofficial tool for creating synchronized overlays on Magic: The Gathering match recordings.

Load a video file, then use the timeline editor to mark in-game events — life changes, draws, discards, and more — at the exact moments they occur. The editor renders the current game state (life totals, hand sizes) as a canvas overlay in real time as the video plays, keeping everything in sync automatically.

---

## Features

- **Video playback** with frame-accurate canvas rendering
- **Interactive timeline** with zoom, scrubbing, and a draggable playhead
- **8 event types**: Lose Life, Gain Life, Add to Hand, Remove from Hand, Reveal from Hand, Stack Top, Shuffle, Display Card
- **Drag-and-drop events** — reposition or move events between player tracks
- **Resizable duration events** — some events (like Display Card) span a time range and show as an overlay banner while active
- **Up to 4 players**, each with their own track
- **Live canvas overlay** showing each player's life total and hand size, updated frame-by-frame as events fire
- **Command palette** (Cmd+K) for quickly adding new events

---

## Screenshots

<div align="center">
  <img src="https://placehold.co/600x400?text=Screenshot" alt="screenshot" />
</div>

---

## Install

_No release builds available yet._

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v24 (see `.nvmrc`)
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/spellsplice.git
cd spellsplice

# If using nvm
nvm use

# Install dependencies
npm install
```

### Commands

```bash
npm run dev      # Start the Vite dev server
npm run build    # Type-check and build for production
npm run preview  # Preview the production build locally
npm run lint     # Run ESLint

npx prettier --write .  # Format all files
```

---

## Roadmap

- [ ] Inspector panel — edit player names, decklists, and per-event properties (cards affected, life amounts, etc.)
- [ ] State handlers for Reveal from Hand, Stack Top, and Shuffle events
- [ ] Export / render output video with overlay baked in