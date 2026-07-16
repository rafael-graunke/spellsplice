import type { OracleCard } from './oracleCards';
import defaultScoreboardSvg from '@/assets/scoreboards/default-scoreboard.svg?raw';

export const LIVE_MODE_KEY = 'spellsplice-live-mode';
export const LIVE_PROJECT_KEY = 'spellsplice-live-project';
export const LIVE_SCOREBOARD_KEY = 'spellsplice-live-scoreboard';
// Pre-rename key ('template' era). Read once on load so existing saved
// scoreboards migrate forward; cleared after the first successful migration.
const LEGACY_LIVE_TEMPLATE_KEY = 'spellsplice-live-template';

// Matches renderCardStrips.ts's STRIP_W default. Duplicated (not imported) to
// keep this lib module decoupled from the canvas-rendering layer.
export const DEFAULT_CARD_STRIP_WIDTH = 430;

// How long a played card stays on screen before auto-clearing.
export const DEFAULT_CARD_DISPLAY_DURATION_MS = 5000;

export interface LiveModeConfig {
    websocketUrl: string;
    cardStripWidth?: number;
    cardDisplayDuration?: number;
}

export interface LiveHandCard {
    id: string;
    card: OracleCard;
}

export interface LiveDisplayCard extends LiveHandCard {
    flipped: boolean;
}

export interface LiveOverlayState {
    left: LiveHandCard[];
    right: LiveHandCard[];
}

export function createDefaultLiveState(): LiveOverlayState {
    return { left: [], right: [] };
}

export type ScoreboardMode = 'shared' | 'per-player';
export type ScoreboardAnchor =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
export type ScoreboardField = 'name' | 'deckName' | 'life' | 'wins';

export interface ScoreboardMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

// Binds one SVG element (by id) to a tracked player field, resolved at
// render time via getElementById - robust against SVG exporters that
// fragment text into per-character tspans, unlike text-based substitution.
export interface ScoreboardFieldMapping {
    id: string;
    field: ScoreboardField;
    side: 'left' | 'right';
}

export interface SingleScoreboardConfig {
    svg: string | null;
    anchor: ScoreboardAnchor;
    scale: number;
    margins: ScoreboardMargins;
    fieldMappings: ScoreboardFieldMapping[];
}

// mode: 'shared' renders `shared` once; 'per-player' renders `left` and
// `right` independently. Kept as one object so the overlay always receives
// a single consistent snapshot instead of merging partial updates.
export interface LiveScoreboardState {
    mode: ScoreboardMode;
    shared: SingleScoreboardConfig;
    left: SingleScoreboardConfig;
    right: SingleScoreboardConfig;
}

export interface LivePlayerInfo {
    name: string;
    deckName: string;
    life: number;
    wins: number;
}

const DEFAULT_FIELD_IDS: { id: string; field: ScoreboardField }[] = [
    { id: 'name', field: 'name' },
    { id: 'deck', field: 'deckName' },
    { id: 'life', field: 'life' },
    { id: 'wins', field: 'wins' },
];

// Shared scoreboards address both players from one SVG, so default mapping ids
// are side-prefixed (e.g. "left.life"); per-player scoreboards only ever bind
// their own player, so the prefix is dropped (e.g. "life").
export function defaultFieldMappings(
    kind: 'shared' | 'left' | 'right'
): ScoreboardFieldMapping[] {
    if (kind === 'shared') {
        return (['left', 'right'] as const).flatMap((side) =>
            DEFAULT_FIELD_IDS.map(({ id, field }) => ({
                id: `${side}.${id}`,
                field,
                side,
            }))
        );
    }
    return DEFAULT_FIELD_IDS.map(({ id, field }) => ({
        id,
        field,
        side: kind,
    }));
}

export function defaultScoreboardConfig(
    kind: 'shared' | 'left' | 'right'
): SingleScoreboardConfig {
    return {
        svg: null,
        anchor: 'top-center',
        scale: 100,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        fieldMappings: defaultFieldMappings(kind),
    };
}

// Blank slate - used for File > New / overlay reset, so those always clear
// back to no scoreboard rather than reintroducing the bundled sample.
export function defaultLiveScoreboardState(): LiveScoreboardState {
    return {
        mode: 'shared',
        shared: defaultScoreboardConfig('shared'),
        left: defaultScoreboardConfig('left'),
        right: defaultScoreboardConfig('right'),
    };
}

// Reads the current key, falling back to the pre-rename 'template' key so a
// user's saved scoreboard survives the rename. Migrated entries are rewritten
// under the new key and the legacy one is removed.
function readStoredScoreboard(): string | null {
    const current = localStorage.getItem(LIVE_SCOREBOARD_KEY);
    if (current !== null) return current;
    const legacy = localStorage.getItem(LEGACY_LIVE_TEMPLATE_KEY);
    if (legacy !== null) {
        localStorage.setItem(LIVE_SCOREBOARD_KEY, legacy);
        localStorage.removeItem(LEGACY_LIVE_TEMPLATE_KEY);
    }
    return legacy;
}

export function loadLiveScoreboardState(): LiveScoreboardState {
    const defaults = defaultLiveScoreboardState();
    let parsed: Partial<LiveScoreboardState> = {};
    try {
        const raw = readStoredScoreboard();
        if (raw) parsed = JSON.parse(raw) as Partial<LiveScoreboardState>;
    } catch {
        parsed = {};
    }
    const shared = { ...defaults.shared, ...parsed.shared };
    return {
        mode: parsed.mode ?? defaults.mode,
        // No custom upload on record (key missing, or explicitly null) -
        // fall back to the bundled sample so every session shows something
        // instead of blank. Only matches 'shared' mode's field-id scheme,
        // so per-player configs are left as-is (blank until uploaded).
        shared: { ...shared, svg: shared.svg ?? defaultScoreboardSvg },
        left: { ...defaults.left, ...parsed.left },
        right: { ...defaults.right, ...parsed.right },
    };
}

export function saveLiveScoreboardState(state: LiveScoreboardState) {
    localStorage.setItem(LIVE_SCOREBOARD_KEY, JSON.stringify(state));
}

export type LiveMessage =
    | { type: 'live-state'; state: LiveOverlayState }
    | {
          type: 'annotation-state';
          annotationId: string;
          title: string;
          state: LiveOverlayState;
      }
    | {
          type: 'card-display-state';
          left: LiveDisplayCard | null;
          right: LiveDisplayCard | null;
      }
    | { type: 'config-state'; cardStripWidth: number }
    | { type: 'scoreboard-state'; scoreboard: LiveScoreboardState }
    | { type: 'player-info-state'; left: LivePlayerInfo; right: LivePlayerInfo }
    | { type: 'request-state' };

export function loadLiveModeConfig(): LiveModeConfig | null {
    try {
        const raw = localStorage.getItem(LIVE_MODE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as LiveModeConfig;
    } catch {
        return null;
    }
}

export function saveLiveModeConfig(config: LiveModeConfig) {
    localStorage.setItem(LIVE_MODE_KEY, JSON.stringify(config));
}

// OBS's Browser Source runs in an isolated profile with its own localStorage,
// so /overlay can't rely on loadLiveModeConfig() there - a `?ws=` query param
// lets the controller hand it the URL directly.
export function resolveOverlayWebsocketUrl(search: string): string | null {
    const fromQuery = new URLSearchParams(search).get('ws');
    if (fromQuery) return fromQuery;
    return loadLiveModeConfig()?.websocketUrl ?? null;
}

// Same isolated-localStorage problem as the websocket URL above - a `?stripW=`
// query param carries the setting into OBS's Browser Source.
export function resolveOverlayCardStripWidth(search: string): number {
    const fromQuery = Number(new URLSearchParams(search).get('stripW'));
    if (fromQuery > 0) return fromQuery;
    return loadLiveModeConfig()?.cardStripWidth ?? DEFAULT_CARD_STRIP_WIDTH;
}

export function buildOverlayUrl(
    websocketUrl: string,
    cardStripWidth?: number
): string {
    const url = new URL('/overlay', window.location.origin);
    url.searchParams.set('ws', websocketUrl);
    if (cardStripWidth) url.searchParams.set('stripW', String(cardStripWidth));
    return url.toString();
}
