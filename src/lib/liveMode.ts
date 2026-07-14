import type { OracleCard } from './oracleCards';
import defaultTemplateSvg from '@/assets/live-templates/default-template.svg?raw';

export const LIVE_MODE_KEY = 'spellsplice-live-mode';
export const LIVE_PROJECT_KEY = 'spellsplice-live-project';
export const LIVE_TEMPLATE_KEY = 'spellsplice-live-template';

// Matches renderCardStrips.ts's STRIP_W default. Duplicated (not imported) to
// keep this lib module decoupled from the canvas-rendering layer.
export const DEFAULT_CARD_STRIP_WIDTH = 430;

export interface LiveModeConfig {
    websocketUrl: string;
    cardStripWidth?: number;
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

export type TemplateMode = 'shared' | 'per-player';
export type TemplateAnchor =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
export type TemplateField = 'name' | 'deckName' | 'life' | 'wins';

export interface TemplateMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

// Binds one SVG element (by id) to a tracked player field, resolved at
// render time via getElementById - robust against SVG exporters that
// fragment text into per-character tspans, unlike text-based substitution.
export interface TemplateFieldMapping {
    id: string;
    field: TemplateField;
    side: 'left' | 'right';
}

export interface SingleTemplateConfig {
    svg: string | null;
    anchor: TemplateAnchor;
    scale: number;
    margins: TemplateMargins;
    fieldMappings: TemplateFieldMapping[];
}

// mode: 'shared' renders `shared` once; 'per-player' renders `left` and
// `right` independently. Kept as one object so the overlay always receives
// a single consistent snapshot instead of merging partial updates.
export interface LiveTemplateState {
    mode: TemplateMode;
    shared: SingleTemplateConfig;
    left: SingleTemplateConfig;
    right: SingleTemplateConfig;
}

export interface LivePlayerInfo {
    name: string;
    deckName: string;
    life: number;
    wins: number;
}

const DEFAULT_FIELD_IDS: { id: string; field: TemplateField }[] = [
    { id: 'name', field: 'name' },
    { id: 'deck', field: 'deckName' },
    { id: 'life', field: 'life' },
    { id: 'wins', field: 'wins' },
];

// Shared templates address both players from one SVG, so default mapping ids
// are side-prefixed (e.g. "left.life"); per-player templates only ever bind
// their own player, so the prefix is dropped (e.g. "life").
export function defaultFieldMappings(kind: 'shared' | 'left' | 'right'): TemplateFieldMapping[] {
    if (kind === 'shared') {
        return (['left', 'right'] as const).flatMap((side) =>
            DEFAULT_FIELD_IDS.map(({ id, field }) => ({ id: `${side}.${id}`, field, side })),
        );
    }
    return DEFAULT_FIELD_IDS.map(({ id, field }) => ({ id, field, side: kind }));
}

export function defaultTemplateConfig(kind: 'shared' | 'left' | 'right'): SingleTemplateConfig {
    return {
        svg: null,
        anchor: 'top-center',
        scale: 100,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        fieldMappings: defaultFieldMappings(kind),
    };
}

// Blank slate - used for File > New / overlay reset, so those always clear
// back to no template rather than reintroducing the bundled sample.
export function defaultLiveTemplateState(): LiveTemplateState {
    return {
        mode: 'shared',
        shared: defaultTemplateConfig('shared'),
        left: defaultTemplateConfig('left'),
        right: defaultTemplateConfig('right'),
    };
}

export function loadLiveTemplateState(): LiveTemplateState {
    const defaults = defaultLiveTemplateState();
    let parsed: Partial<LiveTemplateState> = {};
    try {
        const raw = localStorage.getItem(LIVE_TEMPLATE_KEY);
        if (raw) parsed = JSON.parse(raw) as Partial<LiveTemplateState>;
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
        shared: { ...shared, svg: shared.svg ?? defaultTemplateSvg },
        left: { ...defaults.left, ...parsed.left },
        right: { ...defaults.right, ...parsed.right },
    };
}

export function saveLiveTemplateState(state: LiveTemplateState) {
    localStorage.setItem(LIVE_TEMPLATE_KEY, JSON.stringify(state));
}

export type LiveMessage =
    | { type: 'live-state'; state: LiveOverlayState }
    | { type: 'annotation-state'; annotationId: string; title: string; state: LiveOverlayState }
    | { type: 'card-display-state'; left: LiveDisplayCard | null; right: LiveDisplayCard | null }
    | { type: 'config-state'; cardStripWidth: number }
    | { type: 'template-state'; template: LiveTemplateState }
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

export function buildOverlayUrl(websocketUrl: string, cardStripWidth?: number): string {
    const url = new URL('/overlay', window.location.origin);
    url.searchParams.set('ws', websocketUrl);
    if (cardStripWidth) url.searchParams.set('stripW', String(cardStripWidth));
    return url.toString();
}
