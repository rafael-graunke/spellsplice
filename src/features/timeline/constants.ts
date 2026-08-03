export const RULER_HEIGHT = 32;
export const TRACK_HEIGHT = 40;
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
