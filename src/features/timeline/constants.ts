export const RULER_HEIGHT = 32;
/** Default track height; per-track overrides live in TrackOverrideRow.height. */
export const TRACK_HEIGHT = 40;
/**
 * Events render at a fixed size and vertically centred (EventIcon is size-9),
 * so they start clipping below this.
 */
export const MIN_TRACK_HEIGHT = 28;
export const MAX_TRACK_HEIGHT = 200;
export const TRACK_HEIGHT_PRESETS = { Small: 28, Medium: 40, Large: 64 } as const;
/** Height of a collapsed group's summary bar. */
export const COLLAPSED_GROUP_HEIGHT = 20;
export const MIN_ZOOM = 5; // px/sec
export const MAX_ZOOM = 50; // px/sec
export const MIN_LANES = 4;
export const TRACK_INFO_WIDTH = 160;
export const TRACK_GROUP_LABEL_WIDTH = 30;

// Preview frame step; no project frame rate yet (export picks its own fps).
export const PREVIEW_FPS = 30;

// JKL shuttle ladder, forward only: no browser supports negative playbackRate,
// and reverse would need a GOP-cache decoder. 16 is the playbackRate ceiling.
export const SHUTTLE_RATES = [1, 2, 4, 8, 16] as const;
