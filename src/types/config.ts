import type {
    LiveScoreboardState,
    LiveHandStackConfig,
    LiveCardDisplayConfig,
    LiveAnnotationConfig,
    LiveLayerId,
} from '@/lib/liveMode';
import {
    spellsplicePreset,
    defaultLiveHandStackConfig,
    defaultLiveCardDisplayConfig,
    defaultLiveAnnotationConfig,
    DEFAULT_CARD_DISPLAY_DURATION_MS,
} from '@/lib/liveMode';

export interface AnnotationSlot {
    id: string;
    title: string;
}

// Overlay paint layers, including the base video (which Live Mode lacks). Video
// is a visibility toggle only (the base texture); overlay elements reorder by
// paint order. Ordered bottom -> top.
export type TimelineLayerId = LiveLayerId | 'video';

export interface TimelineLayer {
    id: TimelineLayerId;
    visible: boolean;
}

export const DEFAULT_LAYERS: TimelineLayer[] = [
    { id: 'video', visible: true },
    { id: 'scoreboard', visible: true },
    { id: 'hand', visible: true },
    { id: 'annotations', visible: true },
    { id: 'cardDisplay', visible: true },
];

export interface Resolution {
    width: number;
    height: number;
}

export const DEFAULT_RESOLUTION: Resolution = { width: 1920, height: 1080 };

export interface ProjectConfig {
    title: string;
    author: string;
    overlayStartHidden: boolean;
    /** Output/preview canvas size. Fixed 1920×1080 today; custom sizes later. */
    resolution: Resolution;
    annotationSlots: AnnotationSlot[];
    // Overlay appearance (shape-compatible with Live Mode for shared presets).
    scoreboard: LiveScoreboardState;
    handStack: LiveHandStackConfig;
    cardDisplay: LiveCardDisplayConfig;
    cardDisplayDuration: number; // ms; also seeds new DISPLAY_CARD event duration
    annotationConfig: LiveAnnotationConfig; // per-side placement (distinct from annotationSlots)
    layers: TimelineLayer[];
}

// Default annotation slot that Cmd+K-created events target and that legacy
// deck-stack events migrate into.
export const DEFAULT_ANNOTATION_SLOT_ID = 'top-deck';

export const DEFAULT_ANNOTATION_SLOTS: AnnotationSlot[] = [
    { id: 'graveyard', title: 'Graveyard' },
    { id: 'top-deck', title: 'Top Deck' },
    { id: 'pithing-needle', title: 'Pithing Needle' },
    { id: 'disruptor-flute', title: 'Disruptor Flute' },
    { id: 'meddling-mage', title: 'Meddling Mage' },
];

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
    title: '',
    author: '',
    overlayStartHidden: false,
    resolution: DEFAULT_RESOLUTION,
    annotationSlots: DEFAULT_ANNOTATION_SLOTS,
    // Seeded with the bundled sample scoreboard SVG so a new project shows a
    // scoreboard out of the box (the old renderPlayerState boxes are gone).
    scoreboard: spellsplicePreset().scoreboard,
    handStack: defaultLiveHandStackConfig(),
    cardDisplay: defaultLiveCardDisplayConfig(),
    cardDisplayDuration: DEFAULT_CARD_DISPLAY_DURATION_MS,
    annotationConfig: defaultLiveAnnotationConfig(),
    layers: DEFAULT_LAYERS,
};
