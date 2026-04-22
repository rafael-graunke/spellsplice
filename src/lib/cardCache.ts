export const imageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();

export async function serializeImageCache(): Promise<Map<string, Blob>> {
    const result = new Map<string, Blob>();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    for (const [key, value] of imageCache) {
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

export function restoreImageCache(entries: Map<string, Blob>): void {
    for (const [key, blob] of entries) {
        imageCache.set(key, 'loading');
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { imageCache.set(key, img); URL.revokeObjectURL(url); };
        img.onerror = () => { imageCache.set(key, 'error'); URL.revokeObjectURL(url); };
        img.src = url;
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
            const url = data.image_uris?.normal;
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
