import type { OracleCard } from './oracleCards';

export const LIVE_MODE_KEY = 'spellsplice-live-mode';

export interface LiveModeConfig {
    websocketUrl: string;
}

export interface LiveHandCard {
    id: string;
    card: OracleCard;
}

export interface LiveOverlayState {
    left: LiveHandCard[];
    right: LiveHandCard[];
}

export function createDefaultLiveState(): LiveOverlayState {
    return { left: [], right: [] };
}

export type LiveMessage =
    | { type: 'live-state'; state: LiveOverlayState }
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

export function buildOverlayUrl(websocketUrl: string): string {
    const url = new URL('/overlay', window.location.origin);
    url.searchParams.set('ws', websocketUrl);
    return url.toString();
}
