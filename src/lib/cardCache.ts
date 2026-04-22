export const imageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();

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
