import type { LivePlayerInfo, TemplateAnchor, TemplateFieldMapping, TemplateMargins } from '@/lib/liveMode';
import { substituteTemplate } from '@/lib/liveTemplate';

interface CacheEntry {
    cachedKey: string | null;
    cachedImg: HTMLImageElement | null;
    pendingKey: string | null;
}

// Keyed by template slot ('shared' | 'left' | 'right') so per-player mode
// can decode/cache two independent templates without clobbering each other.
const cache = new Map<string, CacheEntry>();

export function getLiveTemplateImage(
    slot: string,
    svg: string,
    mappings: TemplateFieldMapping[],
    left: LivePlayerInfo,
    right: LivePlayerInfo,
    onReady: () => void,
): HTMLImageElement | null {
    let entry = cache.get(slot);
    if (!entry) {
        entry = { cachedKey: null, cachedImg: null, pendingKey: null };
        cache.set(slot, entry);
    }

    const substituted = substituteTemplate(svg, mappings, left, right);
    if (entry.cachedKey === substituted || entry.pendingKey === substituted) return entry.cachedImg;

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

export function renderLiveTemplate(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    anchor: TemplateAnchor,
    scale: number,
    margins: TemplateMargins,
    canvasWidth: number,
    canvasHeight: number,
): void {
    const width = img.naturalWidth * (scale / 100);
    const aspect = img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1;
    const height = width * aspect;

    const x = anchor.endsWith('left')
        ? margins.left
        : anchor.endsWith('right')
          ? canvasWidth - width - margins.right
          : (canvasWidth - width) / 2;
    const y = anchor.startsWith('top') ? margins.top : canvasHeight - height - margins.bottom;

    ctx.drawImage(img, x, y, width, height);
}
