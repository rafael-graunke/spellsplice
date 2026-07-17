import type {
    LivePlayerInfo,
    ScoreboardAnchor,
    ScoreboardFieldMapping,
    ScoreboardMargins,
} from '@/lib/liveMode';
import { substituteScoreboard } from '@/lib/liveScoreboard';

interface CacheEntry {
    cachedKey: string | null;
    cachedImg: HTMLImageElement | null;
    pendingKey: string | null;
    // Last inputs to substituteScoreboard, held by reference. They only change
    // on socket messages (scoreboard-state / player-info-state), never per
    // frame, so ref-equality lets animation frames skip the (expensive)
    // DOMParser reparse of the whole SVG entirely.
    lastSvg: string | null;
    lastMappings: ScoreboardFieldMapping[] | null;
    lastLeft: LivePlayerInfo | null;
    lastRight: LivePlayerInfo | null;
}

// Keyed by scoreboard slot ('shared' | 'left' | 'right') so per-player mode
// can decode/cache two independent scoreboards without clobbering each other.
const cache = new Map<string, CacheEntry>();

export function getLiveScoreboardImage(
    slot: string,
    svg: string,
    mappings: ScoreboardFieldMapping[],
    left: LivePlayerInfo,
    right: LivePlayerInfo,
    onReady: () => void
): HTMLImageElement | null {
    let entry = cache.get(slot);
    if (!entry) {
        entry = {
            cachedKey: null,
            cachedImg: null,
            pendingKey: null,
            lastSvg: null,
            lastMappings: null,
            lastLeft: null,
            lastRight: null,
        };
        cache.set(slot, entry);
    }

    // Fast path: inputs unchanged since last call (the common case on animation
    // frames) - reuse the decoded image without reparsing the SVG.
    if (
        entry.lastSvg === svg &&
        entry.lastMappings === mappings &&
        entry.lastLeft === left &&
        entry.lastRight === right
    )
        return entry.cachedImg;

    entry.lastSvg = svg;
    entry.lastMappings = mappings;
    entry.lastLeft = left;
    entry.lastRight = right;

    const substituted = substituteScoreboard(svg, mappings, left, right);
    if (entry.cachedKey === substituted || entry.pendingKey === substituted)
        return entry.cachedImg;

    entry.pendingKey = substituted;
    const img = new Image();
    img.onload = () => {
        if (entry.pendingKey !== substituted) return;
        entry.cachedKey = substituted;
        entry.cachedImg = img;
        entry.pendingKey = null;
        onReady();
    };
    img.onerror = () => {
        if (entry.pendingKey === substituted) entry.pendingKey = null;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(substituted)}`;
    return entry.cachedImg;
}

export function renderLiveScoreboard(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    anchor: ScoreboardAnchor,
    scale: number,
    margins: ScoreboardMargins,
    canvasWidth: number,
    canvasHeight: number
): void {
    const width = img.naturalWidth * (scale / 100);
    const aspect = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
    const height = width * aspect;

    const x = anchor.endsWith('left')
        ? margins.left
        : anchor.endsWith('right')
          ? canvasWidth - width - margins.right
          : (canvasWidth - width) / 2;
    const y = anchor.startsWith('top')
        ? margins.top
        : canvasHeight - height - margins.bottom;

    ctx.drawImage(img, x, y, width, height);
}
