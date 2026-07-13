import { slowFetch } from './scryfallQueue';

type SetData = { image_uris: Record<string, string>; frame?: string; layout?: string };

const CARD_CACHE_KEY = 'spellsplice-card-cache';

export const cardDataCache: Record<string, Record<string, SetData>> = {};
const cardImageCache: Record<
    string,
    Record<string, Record<string, HTMLImageElement | 'loading' | 'error'>>
> = {};
const inFlight = new Set<string>();

const imageLoadListeners = new Set<() => void>();
export function subscribeImageLoad(cb: () => void): () => void {
    imageLoadListeners.add(cb);
    return () => imageLoadListeners.delete(cb);
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return fetch(url, { mode: 'cors', cache: 'reload' })
        .then((r) => r.blob())
        .then(
            (blob) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const blobUrl = URL.createObjectURL(blob);
                    const img = new Image();
                    img.onload = () => {
                        // Not revoked: img.src is reused directly by <img> tags
                        // (e.g. CardDisplay), so the blob URL must stay alive
                        // for the lifetime of the module-level cache.
                        resolve(img);
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(blobUrl);
                        reject(new Error('image load failed'));
                    };
                    img.src = blobUrl;
                }),
        );
}

function loadImagesForSet(name: string, setCode: string, uris: Record<string, string>): void {
    if (!cardImageCache[name]) cardImageCache[name] = {};
    if (!cardImageCache[name][setCode]) cardImageCache[name][setCode] = {};
    for (const [key, url] of Object.entries(uris)) {
        if (cardImageCache[name][setCode][key] !== undefined) continue;
        cardImageCache[name][setCode][key] = 'loading';
        loadImageFromUrl(url)
            .then((img) => {
                cardImageCache[name][setCode][key] = img;
                imageLoadListeners.forEach((cb) => cb());
            })
            .catch(() => {
                delete cardImageCache[name][setCode][key];
            });
    }
}

// Parse "set#collectorNumber" editions into fetch URL.
function editionEndpoint(cardName: string, edition?: string): string {
    const hashIdx = edition?.indexOf('#') ?? -1;
    if (hashIdx > -1) {
        const set = edition!.slice(0, hashIdx);
        const num = edition!.slice(hashIdx + 1);
        return `https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(num)}`;
    }
    if (edition) {
        return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(edition)}`;
    }
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;
}

function ensureCardData(cardName: string, edition?: string): void {
    const inFlightKey = `${cardName}|${edition ?? '*'}`;
    if (inFlight.has(inFlightKey)) return;
    inFlight.add(inFlightKey);

    slowFetch(editionEndpoint(cardName, edition))
        .then((r) => r.json())
        .then((data) => {
            const face = data.card_faces?.[0];
            const allUris: Record<string, string> = face?.image_uris ?? data.image_uris ?? {};
            const uris: Record<string, string> = {};
            if (allUris.normal) uris.normal = allUris.normal;
            if (allUris.border_crop) uris.border_crop = allUris.border_crop;
            const setData: SetData = {
                image_uris: uris,
                ...(data.frame && { frame: data.frame }),
                ...(data.layout && { layout: data.layout }),
            };

            const storeKey = edition ?? (data.set as string);
            if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
            cardDataCache[cardName][storeKey] = setData;
            if (!edition) cardDataCache[cardName]['*'] = setData;

            loadImagesForSet(cardName, storeKey, uris);
            if (!edition) loadImagesForSet(cardName, '*', uris);

            try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
        })
        .catch(() => { inFlight.delete(inFlightKey); });
}

export function storePrinting(
    cardName: string,
    editionKey: string,
    imageUris: { normal?: string; border_crop?: string },
    frame?: string,
    layout?: string,
): void {
    const uris: Record<string, string> = {};
    if (imageUris.normal) uris.normal = imageUris.normal;
    if (imageUris.border_crop) uris.border_crop = imageUris.border_crop;
    if (!Object.keys(uris).length) return;

    if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
    cardDataCache[cardName][editionKey] = {
        image_uris: uris,
        ...(frame && { frame }),
        ...(layout && { layout }),
    };
    loadImagesForSet(cardName, editionKey, uris);
    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
}

export function ensureImage(
    cardName: string,
    edition?: string,
): HTMLImageElement | 'loading' | 'error' {
    const setCode = edition ?? '*';
    const img = cardImageCache[cardName]?.[setCode]?.['normal'];
    if (img !== undefined) return img;
    ensureCardData(cardName, edition);
    return 'loading';
}

export function ensureBorderCrop(
    cardName: string,
    edition?: string,
): { img: HTMLImageElement | 'loading' | 'error'; frame: string | null } {
    const setCode = edition ?? '*';
    const img = cardImageCache[cardName]?.[setCode]?.['border_crop'];
    const setData = cardDataCache[cardName]?.[setCode];
    const frame = setData?.frame ?? null;
    if (img !== undefined) {
        // Backfill entries cached before `layout` was tracked (e.g. a stale
        // localStorage copy in an OBS Browser Source that never re-fetched).
        if (setData && setData.layout === undefined) ensureCardData(cardName, edition);
        return { img, frame };
    }
    ensureCardData(cardName, edition);
    return { img: 'loading', frame: null };
}

export function getCardLayout(cardName: string, edition?: string): string | null {
    const setCode = edition ?? '*';
    return cardDataCache[cardName]?.[setCode]?.layout ?? null;
}

export async function verifyCard(cardName: string, edition?: string): Promise<boolean> {
    const key = edition ?? '*';
    if (cardDataCache[cardName]?.[key]) return true;

    const response = await slowFetch(editionEndpoint(cardName, edition));
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const face = data.card_faces?.[0];
    const allUris: Record<string, string> = face?.image_uris ?? data.image_uris ?? {};
    const uris: Record<string, string> = {};
    if (allUris.normal) uris.normal = allUris.normal;
    if (allUris.border_crop) uris.border_crop = allUris.border_crop;
    const setData: SetData = {
        image_uris: uris,
        ...(data.frame && { frame: data.frame }),
        ...(data.layout && { layout: data.layout }),
    };

    if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
    cardDataCache[cardName][key] = setData;
    if (!edition) cardDataCache[cardName]['*'] = setData;

    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
    return true;
}

export function serializeCardDataCache(): Record<string, Record<string, SetData>> {
    return cardDataCache;
}

export function restoreCardDataCache(data: Record<string, Record<string, SetData>>): void {
    for (const [name, sets] of Object.entries(data)) {
        cardDataCache[name] = sets;
        for (const [setCode, setData] of Object.entries(sets)) {
            loadImagesForSet(name, setCode, setData.image_uris);
        }
    }
    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
}

try {
    const raw = localStorage.getItem(CARD_CACHE_KEY);
    if (raw) restoreCardDataCache(JSON.parse(raw));
} catch {}
