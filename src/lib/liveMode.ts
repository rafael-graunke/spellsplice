import type { OracleCard } from './oracleCards';
import type { EventType } from '@/components/types/event';
import defaultScoreboardSvg from '@/assets/scoreboards/default-scoreboard.svg?raw';

export const LIVE_MODE_KEY = 'spellsplice-live-mode';
export const LIVE_PROJECT_KEY = 'spellsplice-live-project';
export const LIVE_SCOREBOARD_KEY = 'spellsplice-live-scoreboard';
export const LIVE_CARD_DISPLAY_KEY = 'spellsplice-live-card-display';
export const LIVE_HAND_STACK_KEY = 'spellsplice-live-hand-stack';
// Pre-rename key ('template' era). Read once on load so existing saved
// scoreboards migrate forward; cleared after the first successful migration.
const LEGACY_LIVE_TEMPLATE_KEY = 'spellsplice-live-template';

// Matches renderCardStrips.ts's STRIP_W default. Duplicated (not imported) to
// keep this lib module decoupled from the canvas-rendering layer.
export const DEFAULT_CARD_STRIP_WIDTH = 340;

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

// A semantic, single-card change emitted alongside the full-state snapshot as
// an animation trigger for /overlay (which cannot tell what changed from a
// snapshot alone). `type` reuses the timeline EventType enum so a future
// live-session log maps 1:1 onto Timeline TrackEvents. Hand cuts emit
// ADD_TO_HAND / REMOVE_FROM_HAND; annotation cuts emit
// ANNOTATE_CARD / UNANNOTATE_CARD with `annotationId` set to the target slot.
// `time` is wall-clock (Date.now()) for that log.
export interface LiveEvent {
    type: EventType;
    side: 'left' | 'right';
    time: number;
    card: LiveHandCard;
    annotationId?: string;
}

export interface LiveOverlayState {
    left: LiveHandCard[];
    right: LiveHandCard[];
}

export function createDefaultLiveState(): LiveOverlayState {
    return { left: [], right: [] };
}

export type ScoreboardMode = 'shared' | 'per-player';
export type ScoreboardField = 'name' | 'deckName' | 'life' | 'wins';

// 9-anchor grid (top/middle/bottom X left/center/right), shared by the card
// display, hand stack, and scoreboard.
export type CardDisplayAnchor =
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'middle-left'
    | 'middle-center'
    | 'middle-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';

// Scoreboard uses the same 9-anchor grid (previously it lacked the middle row).
export type ScoreboardAnchor = CardDisplayAnchor;

export interface ScoreboardMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

// Signed placement nudge from the anchor point, in screen pixels (+x right,
// +y down). Shared by hand stack, card display, and scoreboard: the anchor does
// coarse placement, the offset fine, and negatives move any direction.
export interface Offset {
    x: number;
    y: number;
}

// Per-anchor default offset: an ~8px horizontal / 24px vertical inset toward the
// frame, so a freshly picked anchor lands sensibly inset from its edge/corner.
export const DEFAULT_OFFSET_BY_ANCHOR: Record<CardDisplayAnchor, Offset> = {
    'top-left': { x: 8, y: 24 },
    'top-center': { x: 0, y: 24 },
    'top-right': { x: -8, y: 24 },
    'middle-left': { x: 8, y: 0 },
    'middle-center': { x: 0, y: 0 },
    'middle-right': { x: -8, y: 0 },
    'bottom-left': { x: 8, y: -24 },
    'bottom-center': { x: 0, y: -24 },
    'bottom-right': { x: -8, y: -24 },
};

export function defaultOffsetForAnchor(anchor: CardDisplayAnchor): Offset {
    return { ...DEFAULT_OFFSET_BY_ANCHOR[anchor] };
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
    offset: Offset;
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
        offset: defaultOffsetForAnchor('top-center'),
        fieldMappings: defaultFieldMappings(kind),
    };
}

// The bundled sample scoreboard SVG (source string), for "restore default".
export function defaultScoreboardSvgSource(): string {
    return defaultScoreboardSvg;
}

// Derives the Design-tab status from the config's svg: 'none' (blank),
// 'default' (bundled sample), or 'custom' (a user upload).
export function scoreboardSvgStatus(
    svg: string | null
): 'none' | 'default' | 'custom' {
    if (svg === null) return 'none';
    if (svg === defaultScoreboardSvg) return 'default';
    return 'custom';
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

// Merges a saved scoreboard config over defaults, migrating a legacy `margins`
// field to a signed `offset` (preserving the prior placement). Rebuilt in
// canonical key order so value-equal configs stringify identically.
function mergeScoreboardConfig(
    def: SingleScoreboardConfig,
    saved: Partial<SingleScoreboardConfig> & { margins?: ScoreboardMargins }
): SingleScoreboardConfig {
    const anchor = saved.anchor ?? def.anchor;
    const offset =
        saved.offset ??
        (saved.margins ? marginsToOffset(anchor, saved.margins) : def.offset);
    return {
        svg: saved.svg ?? def.svg,
        anchor,
        scale: saved.scale ?? def.scale,
        offset,
        fieldMappings: saved.fieldMappings ?? def.fieldMappings,
    };
}

export function loadLiveScoreboardState(): LiveScoreboardState {
    const defaults = defaultLiveScoreboardState();
    type SavedConfig = Partial<SingleScoreboardConfig> & {
        margins?: ScoreboardMargins;
    };
    let parsed: Partial<
        Omit<LiveScoreboardState, 'shared' | 'left' | 'right'> & {
            shared: SavedConfig;
            left: SavedConfig;
            right: SavedConfig;
        }
    > = {};
    try {
        const raw = readStoredScoreboard();
        if (raw) parsed = JSON.parse(raw) as typeof parsed;
    } catch {
        parsed = {};
    }
    const shared = mergeScoreboardConfig(defaults.shared, parsed.shared ?? {});
    return {
        mode: parsed.mode ?? defaults.mode,
        // No custom upload on record (key missing, or explicitly null) -
        // fall back to the bundled sample so every session shows something
        // instead of blank. Only matches 'shared' mode's field-id scheme,
        // so per-player configs are left as-is (blank until uploaded).
        shared: { ...shared, svg: shared.svg ?? defaultScoreboardSvg },
        left: mergeScoreboardConfig(defaults.left, parsed.left ?? {}),
        right: mergeScoreboardConfig(defaults.right, parsed.right ?? {}),
    };
}

export function saveLiveScoreboardState(state: LiveScoreboardState) {
    localStorage.setItem(LIVE_SCOREBOARD_KEY, JSON.stringify(state));
}

export type CardDisplayAnimType = 'fade' | 'slide';

// Edge the card slides from on enter (and back out to on exit). Independent of
// the anchor: the card always starts fully off that edge regardless of where it
// ends up, so e.g. top-right anchor + 'left' direction enters from screen-left.
export type SlideDirection = 'left' | 'right' | 'top' | 'bottom';

export interface CardDisplayAnimation {
    type: CardDisplayAnimType;
    duration: number; // ms
    direction: SlideDirection; // only meaningful when type === 'slide'
}

// Per-side placement + animation of the featured display card. Kept in its own
// object (and localStorage key + websocket message) so it follows the same
// snapshot + hydrate flow as the scoreboard, which is what lets an OBS Browser
// Source with its own isolated storage stay in sync.
export interface SingleCardDisplayConfig {
    anchor: CardDisplayAnchor;
    offset: Offset;
    animation: CardDisplayAnimation;
}

export interface LiveCardDisplayConfig {
    left: SingleCardDisplayConfig;
    right: SingleCardDisplayConfig;
}

// Defaults reproduce the previous hardcoded placement (top corners, inset via
// the anchor's default offset) so existing overlays look unchanged until
// reconfigured.
export function defaultCardDisplayConfig(
    side: 'left' | 'right'
): SingleCardDisplayConfig {
    const anchor: CardDisplayAnchor =
        side === 'left' ? 'top-left' : 'top-right';
    return {
        anchor,
        offset: defaultOffsetForAnchor(anchor),
        animation: {
            type: 'fade',
            duration: 250,
            direction: side === 'left' ? 'left' : 'right',
        },
    };
}

export function defaultLiveCardDisplayConfig(): LiveCardDisplayConfig {
    return {
        left: defaultCardDisplayConfig('left'),
        right: defaultCardDisplayConfig('right'),
    };
}

// Merges a saved card-display side over defaults, migrating a legacy `margins`
// field to a signed `offset` (preserving the prior placement). Rebuilt in
// canonical key order so value-equal configs stringify identically.
function mergeCardDisplaySide(
    def: SingleCardDisplayConfig,
    saved: Partial<SingleCardDisplayConfig> & { margins?: ScoreboardMargins }
): SingleCardDisplayConfig {
    const anchor = saved.anchor ?? def.anchor;
    const offset =
        saved.offset ??
        (saved.margins ? marginsToOffset(anchor, saved.margins) : def.offset);
    return {
        anchor,
        offset,
        animation: { ...def.animation, ...saved.animation },
    };
}

export function loadLiveCardDisplayConfig(): LiveCardDisplayConfig {
    const defaults = defaultLiveCardDisplayConfig();
    type SavedSide = Partial<SingleCardDisplayConfig> & {
        margins?: ScoreboardMargins;
    };
    let parsed: Partial<Record<'left' | 'right', SavedSide>> = {};
    try {
        const raw = localStorage.getItem(LIVE_CARD_DISPLAY_KEY);
        if (raw) parsed = JSON.parse(raw) as typeof parsed;
    } catch {
        parsed = {};
    }
    return {
        left: mergeCardDisplaySide(defaults.left, parsed.left ?? {}),
        right: mergeCardDisplaySide(defaults.right, parsed.right ?? {}),
    };
}

export function saveLiveCardDisplayConfig(config: LiveCardDisplayConfig) {
    localStorage.setItem(LIVE_CARD_DISPLAY_KEY, JSON.stringify(config));
}

// How the hand grows relative to its anchored point: 'top-down' extends the
// stack downward from the anchor, 'bottom-up' upward, 'center' both ways
// (block centered on the anchor line).
export type HandStackGrowth = 'top-down' | 'bottom-up' | 'center';

// Back-compat alias; hand stack now shares the common `Offset` type.
export type HandStackOffset = Offset;

// Per-side placement + sizing of a player's hand stack. Reuses the 9-anchor
// grid from the card display. `cardStripWidth` is the rendered strip width for
// this side's hand (and its annotations, which sit above it).
export interface SingleHandStackConfig {
    anchor: CardDisplayAnchor;
    offset: Offset;
    cardStripWidth: number;
    growth: HandStackGrowth;
}

export interface LiveHandStackConfig {
    left: SingleHandStackConfig;
    right: SingleHandStackConfig;
}

// Defaults reproduce the previous hardcoded placement (bottom corners, inset via
// the anchor's default offset, growing upward) so existing overlays look
// unchanged until reconfigured. `stripWidth` seeds from the legacy global card
// strip width so a user's saved width carries over on first load.
export function defaultHandStackConfig(
    side: 'left' | 'right',
    stripWidth: number = DEFAULT_CARD_STRIP_WIDTH
): SingleHandStackConfig {
    const anchor: CardDisplayAnchor =
        side === 'left' ? 'bottom-left' : 'bottom-right';
    return {
        anchor,
        offset: defaultOffsetForAnchor(anchor),
        cardStripWidth: stripWidth,
        growth: 'bottom-up',
    };
}

// Converts a legacy per-edge margins object into a signed offset for the given
// anchor, reproducing the exact placement the margins used to yield (only the
// edges the anchor pins to ever mattered).
function marginsToOffset(
    anchor: CardDisplayAnchor,
    m: ScoreboardMargins
): HandStackOffset {
    const [vertical, horizontal] = anchor.split('-');
    const x =
        horizontal === 'left'
            ? m.left
            : horizontal === 'right'
              ? -m.right
              : m.left - m.right;
    const y =
        vertical === 'top'
            ? m.top
            : vertical === 'bottom'
              ? -m.bottom
              : m.top - m.bottom;
    return { x, y };
}

// Merges a saved side over defaults, migrating a legacy `margins` field to
// `offset` when the saved data predates the offset model. Rebuilt in canonical
// key order so value-equal configs stringify identically (preset matching).
function mergeHandStackSide(
    def: SingleHandStackConfig,
    saved: Partial<SingleHandStackConfig> & { margins?: ScoreboardMargins }
): SingleHandStackConfig {
    const anchor = saved.anchor ?? def.anchor;
    const offset =
        saved.offset ??
        (saved.margins ? marginsToOffset(anchor, saved.margins) : def.offset);
    return {
        anchor,
        offset,
        cardStripWidth: saved.cardStripWidth ?? def.cardStripWidth,
        growth: saved.growth ?? def.growth,
    };
}

export function defaultLiveHandStackConfig(
    stripWidth: number = DEFAULT_CARD_STRIP_WIDTH
): LiveHandStackConfig {
    return {
        left: defaultHandStackConfig('left', stripWidth),
        right: defaultHandStackConfig('right', stripWidth),
    };
}

export function loadLiveHandStackConfig(): LiveHandStackConfig {
    // Seed defaults from the legacy global width so a user who set a card strip
    // width before this per-side config existed keeps that width for the hand.
    const legacyWidth =
        loadLiveModeConfig()?.cardStripWidth ?? DEFAULT_CARD_STRIP_WIDTH;
    const defaults = defaultLiveHandStackConfig(legacyWidth);
    type SavedSide = Partial<SingleHandStackConfig> & {
        margins?: ScoreboardMargins;
    };
    let parsed: Partial<Record<'left' | 'right', SavedSide>> = {};
    try {
        const raw = localStorage.getItem(LIVE_HAND_STACK_KEY);
        if (raw) parsed = JSON.parse(raw) as typeof parsed;
    } catch {
        parsed = {};
    }
    return {
        left: mergeHandStackSide(defaults.left, parsed.left ?? {}),
        right: mergeHandStackSide(defaults.right, parsed.right ?? {}),
    };
}

export function saveLiveHandStackConfig(config: LiveHandStackConfig) {
    localStorage.setItem(LIVE_HAND_STACK_KEY, JSON.stringify(config));
}

// A named, self-contained snapshot of every Overlay Appearance config. Bundles
// the scoreboard (SVGs included, since they live inline in each
// SingleScoreboardConfig.svg), hand stack, and card display so a look can be
// exported to a single JSON file and re-imported/shared. `version` guards
// future shape changes.
export const LIVE_PRESET_VERSION = '1';

export interface LiveOverlayPreset {
    version: string;
    name: string;
    scoreboard: LiveScoreboardState;
    handStack: LiveHandStackConfig;
    cardDisplay: LiveCardDisplayConfig;
    cardDisplayDuration: number;
}

// The built-in "Spellsplice" look: default placements plus the bundled sample
// scoreboard SVG. Matches what a fresh install renders, so selecting it in the
// General tab restores the out-of-box overlay.
export function spellsplicePreset(): LiveOverlayPreset {
    const scoreboard = defaultLiveScoreboardState();
    scoreboard.shared.svg = defaultScoreboardSvg;
    return {
        version: LIVE_PRESET_VERSION,
        name: 'Spellsplice',
        scoreboard,
        handStack: defaultLiveHandStackConfig(),
        cardDisplay: defaultLiveCardDisplayConfig(),
        cardDisplayDuration: DEFAULT_CARD_DISPLAY_DURATION_MS,
    };
}

// Assembles a preset from the currently active configs (as held by the dialog).
export function buildOverlayPreset(
    name: string,
    scoreboard: LiveScoreboardState,
    handStack: LiveHandStackConfig,
    cardDisplay: LiveCardDisplayConfig,
    cardDisplayDuration: number
): LiveOverlayPreset {
    return {
        version: LIVE_PRESET_VERSION,
        name,
        scoreboard,
        handStack,
        cardDisplay,
        cardDisplayDuration,
    };
}

// Sentinel used in public/presets.json's scoreboard svg fields to reference the
// app-bundled sample SVG without inlining its (large) source into the JSON.
// Resolved to the real source at load time.
export const PRESET_BUNDLED_SVG = '@bundled-default';

// Presets served as one file per preset under public/presets/, so a default
// look can be changed (or a preset added/removed) by editing that static
// directory, no rebuild. `index.json` lists the slugs (static HTTP can't list
// a directory) plus which one seeds the picker; each `<slug>.json` is a full,
// self-contained LiveOverlayPreset, identical in shape to an export.
interface PresetsIndex {
    default: string;
    presets: string[];
}

// The resolved manifest handed to the UI: `default` is a preset name (not a
// slug); `presets[].name` is the label shown in the dropdown.
export interface PresetsManifest {
    default: string;
    presets: LiveOverlayPreset[];
}

// Replaces the bundled-SVG sentinel with the real source in every scoreboard
// slot of a fetched preset (fields already holding null or a custom SVG string
// are left untouched).
function resolvePresetSvgs(preset: LiveOverlayPreset): LiveOverlayPreset {
    const fix = (c: SingleScoreboardConfig): SingleScoreboardConfig =>
        c.svg === PRESET_BUNDLED_SVG
            ? { ...c, svg: defaultScoreboardSvg }
            : c;
    return {
        ...preset,
        scoreboard: {
            ...preset.scoreboard,
            shared: fix(preset.scoreboard.shared),
            left: fix(preset.scoreboard.left),
            right: fix(preset.scoreboard.right),
        },
    };
}

// The offline/failure fallback manifest: the single built-in Spellsplice look,
// so the picker always has at least one working preset even if the fetch fails
// (overlay popup, offline, CDN blip).
function fallbackPresetsManifest(): PresetsManifest {
    return { default: 'Spellsplice', presets: [spellsplicePreset()] };
}

// Validates and normalizes one fetched preset (resolving its SVG sentinel), or
// returns null if it's missing required config slices.
function normalizePreset(p: Partial<LiveOverlayPreset>): LiveOverlayPreset | null {
    if (!p?.scoreboard || !p.handStack || !p.cardDisplay) return null;
    return resolvePresetSvgs(p as LiveOverlayPreset);
}

// Fetches a single preset file by slug; null on any failure (404, malformed).
async function fetchPreset(base: string, slug: string): Promise<LiveOverlayPreset | null> {
    try {
        const res = await fetch(`${base}presets/${slug}.json`);
        if (!res.ok) return null;
        return normalizePreset((await res.json()) as Partial<LiveOverlayPreset>);
    } catch {
        return null;
    }
}

// Fetches the preset index, then every listed preset file in parallel. Any
// failure (network, malformed JSON, no valid presets) falls back to the
// built-in Spellsplice preset so the picker always works.
export async function loadOverlayPresets(): Promise<PresetsManifest> {
    const base = import.meta.env.BASE_URL;
    try {
        const res = await fetch(`${base}presets/index.json`);
        if (!res.ok) return fallbackPresetsManifest();
        const index = (await res.json()) as Partial<PresetsIndex>;
        const slugs = index.presets ?? [];
        // Keep slug↔preset paired so a preset that fails to load doesn't shift
        // the default lookup (presets is compacted, slugs is not).
        const loaded = (
            await Promise.all(
                slugs.map(async (slug) => ({
                    slug,
                    preset: await fetchPreset(base, slug),
                }))
            )
        ).filter(
            (e): e is { slug: string; preset: LiveOverlayPreset } =>
                e.preset !== null
        );
        if (loaded.length === 0) return fallbackPresetsManifest();
        // `default` in the index is a slug; map it to that preset's name (the
        // UI selects by name), falling back to the first loaded preset.
        const defaultEntry =
            loaded.find((e) => e.slug === index.default) ?? loaded[0];
        return {
            default: defaultEntry.preset.name,
            presets: loaded.map((e) => e.preset),
        };
    } catch {
        return fallbackPresetsManifest();
    }
}

// Order-insensitive JSON serialization: sorts object keys recursively so two
// value-equal configs stringify identically regardless of key insertion order
// (a fetched preset's keys follow the JSON file's order, not the builders').
function stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const body = Object.keys(obj)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
            .join(',');
        return `{${body}}`;
    }
    return JSON.stringify(value);
}

// True when the given live configs are value-identical to `preset`'s configs,
// ignoring `name`/`version`. Used to label the picker with the matching preset
// (or 'Custom' when none match). Order-insensitive, so presets.json's key order
// need not mirror the builders'.
export function configMatchesPreset(
    preset: LiveOverlayPreset,
    scoreboard: LiveScoreboardState,
    handStack: LiveHandStackConfig,
    cardDisplay: LiveCardDisplayConfig,
    cardDisplayDuration: number
): boolean {
    return (
        stableStringify({
            scoreboard,
            handStack,
            cardDisplay,
            cardDisplayDuration,
        }) ===
        stableStringify({
            scoreboard: preset.scoreboard,
            handStack: preset.handStack,
            cardDisplay: preset.cardDisplay,
            cardDisplayDuration: preset.cardDisplayDuration,
        })
    );
}

// Resolved card image links shipped controller → overlay so the overlay window
// (which has no oracle bulk of its own) can render with no API/network at
// reveal. Shape mirrors cardCache's CardImageData.
export interface PreloadCard {
    name: string;
    image_uris: Record<string, string>;
    frame?: string;
    layout?: string;
}

export type LiveMessage =
    | { type: 'live-state'; state: LiveOverlayState }
    | { type: 'live-event'; event: LiveEvent }
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
    | { type: 'card-display-config'; config: LiveCardDisplayConfig }
    | { type: 'hand-stack-config'; config: LiveHandStackConfig }
    | { type: 'scoreboard-state'; scoreboard: LiveScoreboardState }
    | { type: 'player-info-state'; left: LivePlayerInfo; right: LivePlayerInfo }
    | { type: 'preload-cards'; cards: PreloadCard[] }
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

// Browsers treat localhost / loopback as "potentially trustworthy", so a plain
// ws:// connection to them from an https page is NOT mixed content. Any other
// host (e.g. a 192.168.x LAN IP) is, and the browser downgrades the page's
// security indicator to "Not secure" for the whole document.
function isLoopbackHost(host: string): boolean {
    const h = host.toLowerCase();
    return (
        h === 'localhost' ||
        h.endsWith('.localhost') ||
        h === '127.0.0.1' ||
        h.startsWith('127.') ||
        h === '[::1]' ||
        h === '::1'
    );
}

// True when `wsUrl` is a well-formed ws:// or wss:// URL. Used to show
// validation state in the UI before anyone tries to connect.
export function isValidWsUrl(wsUrl: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(wsUrl);
    } catch {
        return false;
    }
    return (
        (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') &&
        parsed.hostname !== ''
    );
}

// Returns true when connecting to `wsUrl` would trigger a mixed-content
// downgrade given the current page origin: an https page reaching a plaintext
// ws:// endpoint on a non-loopback host. Used to block auto-connect and warn
// in the UI. Malformed URLs return false (nothing we can flag).
export function isMixedContentWs(wsUrl: string): boolean {
    if (typeof window === 'undefined' || window.location.protocol !== 'https:')
        return false;
    let parsed: URL;
    try {
        parsed = new URL(wsUrl);
    } catch {
        return false;
    }
    if (parsed.protocol !== 'ws:') return false;
    return !isLoopbackHost(parsed.hostname);
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
