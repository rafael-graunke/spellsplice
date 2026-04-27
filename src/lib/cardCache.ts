import { slowFetch } from './scryfallQueue';

type SetData = { image_uris: Record<string, string>; frame?: string };

const CARD_CACHE_KEY = 'spellsplice-card-cache';

export const cardDataCache: Record<string, Record<string, SetData>> = {};
const cardImageCache: Record<
    string,
    Record<string, Record<string, HTMLImageElement | 'loading' | 'error'>>
> = {};
const inFlight = new Set<string>();

function loadImagesForSet(name: string, setCode: string, uris: Record<string, string>): void {
    if (!cardImageCache[name]) cardImageCache[name] = {};
    if (!cardImageCache[name][setCode]) cardImageCache[name][setCode] = {};
    for (const [key, url] of Object.entries(uris)) {
        if (cardImageCache[name][setCode][key] !== undefined) continue;
        cardImageCache[name][setCode][key] = 'loading';
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            cardImageCache[name][setCode][key] = img;
        };
        img.onerror = () => {
            cardImageCache[name][setCode][key] = 'error';
        };
        img.src = url;
    }
}

function ensureCardData(cardName: string, edition?: string): void {
    const inFlightKey = `${cardName}|${edition ?? '*'}`;
    if (inFlight.has(inFlightKey)) return;
    inFlight.add(inFlightKey);

    const endpoint = edition
        ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(edition)}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;

    slowFetch(endpoint)
        .then((r) => r.json())
        .then((data) => {
            const setCode: string = data.set;
            const face = data.card_faces?.[0] ?? data;
            const allUris: Record<string, string> = face.image_uris ?? {};
            const uris: Record<string, string> = {};
            if (allUris.normal) uris.normal = allUris.normal;
            if (allUris.border_crop) uris.border_crop = allUris.border_crop;
            const setData: SetData = {
                image_uris: uris,
                ...(data.frame && { frame: data.frame }),
            };

            if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
            cardDataCache[cardName][setCode] = setData;
            if (!edition) cardDataCache[cardName]['*'] = setData;

            loadImagesForSet(cardName, setCode, uris);
            if (!edition) loadImagesForSet(cardName, '*', uris);

            try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
        })
        .catch(() => {
            // inFlight key stays — prevents retry storms on repeated errors
        });
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
    const frame = cardDataCache[cardName]?.[setCode]?.frame ?? null;
    if (img !== undefined) return { img, frame };
    ensureCardData(cardName, edition);
    return { img: 'loading', frame: null };
}

export async function verifyCard(cardName: string, edition?: string): Promise<boolean> {
    const key = edition ?? '*';
    if (cardDataCache[cardName]?.[key]) return true;

    const endpoint = edition
        ? `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&set=${encodeURIComponent(edition)}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`;

    const response = await slowFetch(endpoint);
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const setCode: string = data.set;
    const face = data.card_faces?.[0] ?? data;
    const allUris: Record<string, string> = face.image_uris ?? {};
    const uris: Record<string, string> = {};
    if (allUris.normal) uris.normal = allUris.normal;
    if (allUris.border_crop) uris.border_crop = allUris.border_crop;
    const setData: SetData = { image_uris: uris, ...(data.frame && { frame: data.frame }) };

    if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
    cardDataCache[cardName][setCode] = setData;
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
