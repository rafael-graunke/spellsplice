export const LIVE_MODE_KEY = 'spellsplice-live-mode';

export interface LiveModeConfig {
    websocketUrl: string;
}

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
