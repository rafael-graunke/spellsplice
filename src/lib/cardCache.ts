export const imageCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();

export function ensureImage(cardName: string): HTMLImageElement | 'loading' | 'error' {
    const cached = imageCache.get(cardName);
    if (cached !== undefined) return cached;

    imageCache.set(cardName, 'loading');
    fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`)
        .then((r) => r.json())
        .then((data) => {
            const url = data.image_uris?.normal;
            if (!url) {
                imageCache.set(cardName, 'error');
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => imageCache.set(cardName, img);
            img.onerror = () => imageCache.set(cardName, 'error');
            img.src = url;
        })
        .catch(() => imageCache.set(cardName, 'error'));

    return 'loading';
}
