export const imageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();
export const borderCropCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();
export const frameCache = new Map<string, string>();

async function serializeCache(cache: Map<string, HTMLImageElement | 'loading' | 'error'>): Promise<Map<string, Blob>> {
    const result = new Map<string, Blob>();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    for (const [key, value] of cache) {
        if (!(value instanceof HTMLImageElement)) continue;
        canvas.width = value.naturalWidth;
        canvas.height = value.naturalHeight;
        ctx.drawImage(value, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.9)
        );
        if (blob) result.set(key, blob);
    }
    return result;
}

function restoreCache(cache: Map<string, HTMLImageElement | 'loading' | 'error'>, entries: Map<string, Blob>): void {
    for (const [key, blob] of entries) {
        cache.set(key, 'loading');
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { cache.set(key, img); URL.revokeObjectURL(url); };
        img.onerror = () => { cache.set(key, 'error'); URL.revokeObjectURL(url); };
        img.src = url;
    }
}

export async function serializeImageCache(): Promise<Map<string, Blob>> {
    return serializeCache(imageCache);
}

export function restoreImageCache(entries: Map<string, Blob>): void {
    restoreCache(imageCache, entries);
}

export async function serializeBorderCropCache(): Promise<Map<string, Blob>> {
    return serializeCache(borderCropCache);
}

export function restoreBorderCropCache(entries: Map<string, Blob>): void {
    restoreCache(borderCropCache, entries);
}

export function serializeFrameCache(): Record<string, string> {
    return Object.fromEntries(frameCache);
}

export function restoreFrameCache(data: Record<string, string>): void {
    for (const [key, value] of Object.entries(data)) {
        frameCache.set(key, value);
    }
}

export function ensureImage(cardName: string, edition?: string): HTMLImageElement | 'loading' | 'error' {
    const key = edition ? `${cardName}|${edition}` : cardName;
    const cached = imageCache.get(key);
    if (cached !== undefined) return cached;

    imageCache.set(key, 'loading');
    const endpoint = edition
        ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(edition)}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;

    fetch(endpoint)
        .then((r) => r.json())
        .then((data) => {
            const face = data.card_faces?.[0] ?? data;
            const url = face.image_uris?.normal;
            if (!url) {
                imageCache.set(key, 'error');
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => imageCache.set(key, img);
            img.onerror = () => imageCache.set(key, 'error');
            img.src = url;
        })
        .catch(() => imageCache.set(key, 'error'));

    return 'loading';
}

export function ensureBorderCrop(
    cardName: string,
    edition?: string
): { img: HTMLImageElement | 'loading' | 'error'; frame: string | null } {
    const key = edition ? `${cardName}|${edition}` : cardName;
    const cachedImg = borderCropCache.get(key);
    const cachedFrame = frameCache.get(key) ?? null;
    if (cachedImg !== undefined) return { img: cachedImg, frame: cachedFrame };

    borderCropCache.set(key, 'loading');
    const endpoint = edition
        ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(edition)}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;

    fetch(endpoint)
        .then((r) => r.json())
        .then((data) => {
            if (data.frame) frameCache.set(key, data.frame);
            const face = data.card_faces?.[0] ?? data;
            const url = face.image_uris?.border_crop;
            if (!url) { borderCropCache.set(key, 'error'); return; }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => borderCropCache.set(key, img);
            img.onerror = () => borderCropCache.set(key, 'error');
            img.src = url;
        })
        .catch(() => borderCropCache.set(key, 'error'));

    return { img: 'loading', frame: null };
}
