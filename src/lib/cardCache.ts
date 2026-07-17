import { slowFetch } from './scryfallQueue';
import { findOracleCard, isMultiFaceLayout } from './oracleCards';

type SetData = { image_uris: Record<string, string>; frame?: string; layout?: string };

const CARD_CACHE_KEY = 'spellsplice-card-cache';

export const cardDataCache: Record<string, Record<string, SetData>> = {};
// Decoded images - the render source of truth. Only cards actually shown ever
// reach this cache; a decoded bitmap is large (~3MB for a full 'normal').
const cardImageCache: Record<
    string,
    Record<string, Record<string, HTMLImageElement | 'loading' | 'error'>>
> = {};
// Warmed but not-yet-decoded bytes. Compressed (~100KB each), so the whole
// library can sit here cheaply until a card is revealed and decoded on demand.
const cardBlobCache: Record<string, Record<string, Record<string, Blob | 'loading'>>> = {};
// Slot keys whose blob is mid-fetch and a decode was requested before it landed;
// drained (decoded) the moment the blob arrives.
const decodeQueue = new Set<string>();
const inFlight = new Set<string>();

const imageLoadListeners = new Set<() => void>();
export function subscribeImageLoad(cb: () => void): () => void {
    imageLoadListeners.add(cb);
    return () => imageLoadListeners.delete(cb);
}

const slotKey = (name: string, setCode: string, key: string) => `${name}|${setCode}|${key}`;

function fetchBlobUrl(url: string): Promise<Blob> {
    // force-cache: Scryfall image URLs are content-addressed/immutable, so a
    // cached blob is always valid. Avoids refetching every card on each load.
    return fetch(url, { mode: 'cors', cache: 'force-cache' }).then((r) => r.blob());
}

function decodeBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            // Not revoked: img.src is reused directly by <img> tags (e.g.
            // CardDisplay), so the blob URL must stay alive for the lifetime of
            // the module-level cache.
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error('image decode failed'));
        };
        img.src = blobUrl;
    });
}

// Decode a warmed blob into the image cache. Idempotent per slot.
function decodeSlot(name: string, setCode: string, key: string, blob: Blob): void {
    if (cardImageCache[name]?.[setCode]?.[key] !== undefined) return;
    if (!cardImageCache[name]) cardImageCache[name] = {};
    if (!cardImageCache[name][setCode]) cardImageCache[name][setCode] = {};
    cardImageCache[name][setCode][key] = 'loading';
    decodeBlob(blob)
        .then((img) => {
            cardImageCache[name][setCode][key] = img;
            // Decoded bitmap is now the source of truth; drop our blob ref. The
            // image's own object URL retains whatever bytes it needs.
            if (cardBlobCache[name]?.[setCode]) delete cardBlobCache[name][setCode][key];
            imageLoadListeners.forEach((cb) => cb());
        })
        .catch(() => {
            delete cardImageCache[name][setCode][key];
        });
}

// Fetch bytes for one image key. decodeAfter=true decodes immediately (a live
// reveal / on-demand render); false just warms the blob (import warm-up),
// deferring the costly decode until the card is first rendered.
function fetchSlot(
    name: string,
    setCode: string,
    key: string,
    url: string,
    decodeAfter: boolean,
): void {
    if (cardImageCache[name]?.[setCode]?.[key] instanceof HTMLImageElement) return;
    const existing = cardBlobCache[name]?.[setCode]?.[key];
    if (existing !== undefined) {
        if (decodeAfter) {
            if (existing instanceof Blob) decodeSlot(name, setCode, key, existing);
            else decodeQueue.add(slotKey(name, setCode, key)); // blob mid-fetch
        }
        return;
    }
    if (!cardBlobCache[name]) cardBlobCache[name] = {};
    if (!cardBlobCache[name][setCode]) cardBlobCache[name][setCode] = {};
    cardBlobCache[name][setCode][key] = 'loading';
    if (decodeAfter) decodeQueue.add(slotKey(name, setCode, key));
    fetchBlobUrl(url)
        .then((blob) => {
            cardBlobCache[name][setCode][key] = blob;
            if (decodeQueue.delete(slotKey(name, setCode, key))) {
                decodeSlot(name, setCode, key, blob);
            }
        })
        .catch(() => {
            if (cardBlobCache[name]?.[setCode]) delete cardBlobCache[name][setCode][key];
            decodeQueue.delete(slotKey(name, setCode, key));
        });
}

// Fetch + decode every key now (eager). Used by the API/inspector paths.
function loadImagesForSet(name: string, setCode: string, uris: Record<string, string>): void {
    for (const [key, url] of Object.entries(uris)) fetchSlot(name, setCode, key, url, true);
}

// Fetch bytes only, no decode. Used by warm-up so import front-loads the network
// while decode cost is paid lazily, one card at a time, at reveal.
function warmBlobsForSet(name: string, setCode: string, uris: Record<string, string>): void {
    for (const [key, url] of Object.entries(uris)) fetchSlot(name, setCode, key, url, false);
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
            const backFace = data.card_faces?.[1];
            const allUris: Record<string, string> = face?.image_uris ?? data.image_uris ?? {};
            const backUris: Record<string, string> = backFace?.image_uris ?? {};
            const uris: Record<string, string> = {};
            if (allUris.normal) uris.normal = allUris.normal;
            if (allUris.border_crop) uris.border_crop = allUris.border_crop;
            if (backUris.normal) uris.normal_back = backUris.normal;
            if (backUris.border_crop) uris.border_crop_back = backUris.border_crop;
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

// Seed cardDataCache['*'] URLs from the offline oracle bulk (default printing;
// the bulk has no set-specific art). Returns the uris, or null on a bulk miss.
// URLs only - no bytes fetched, no decode.
function seedUrlsFromOracle(cardName: string): Record<string, string> | null {
    const oc = findOracleCard(cardName);
    const u = oc?.image_uris;
    if (!u || (!u.normal && !u.border_crop)) return null;
    const image_uris: Record<string, string> = {};
    if (u.normal) image_uris.normal = u.normal;
    if (u.border_crop) image_uris.border_crop = u.border_crop;
    if (u.normal_back) image_uris.normal_back = u.normal_back;
    if (u.border_crop_back) image_uris.border_crop_back = u.border_crop_back;
    const setData: SetData = {
        image_uris,
        ...(oc.frame && { frame: oc.frame }),
        ...(oc.layout && { layout: oc.layout }),
    };
    if (!cardDataCache[cardName]) cardDataCache[cardName] = {};
    cardDataCache[cardName]['*'] = setData;
    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
    return image_uris;
}

// Resolve the URL for one image key. Prefers cached URLs, then the offline
// oracle bulk (default printing). Returns null if only the API can answer, in
// which case ensureCardData is kicked off to populate + decode asynchronously.
function resolveUrl(
    cardName: string,
    setCode: string,
    key: string,
    edition?: string,
): string | null {
    const uris = cardDataCache[cardName]?.[setCode]?.image_uris;
    if (uris?.[key]) return uris[key];
    if (setCode === '*') {
        const seeded = seedUrlsFromOracle(cardName);
        if (seeded?.[key]) return seeded[key];
    }
    ensureCardData(cardName, edition);
    return null;
}

// Ensure one image key ends up decoded in cardImageCache. Prefers a warmed
// blob (just decode it); else fetches bytes + decodes; else waits on the API.
function requestKey(cardName: string, setCode: string, key: string, edition?: string): void {
    if (cardImageCache[cardName]?.[setCode]?.[key] !== undefined) return;
    const blob = cardBlobCache[cardName]?.[setCode]?.[key];
    if (blob instanceof Blob) {
        decodeSlot(cardName, setCode, key, blob);
        return;
    }
    if (blob === 'loading') {
        decodeQueue.add(slotKey(cardName, setCode, key)); // decode once it lands
        return;
    }
    const url = resolveUrl(cardName, setCode, key, edition);
    if (url) fetchSlot(cardName, setCode, key, url, true);
    // else: ensureCardData is in flight and will decode into cardImageCache.
}

export function ensureImage(
    cardName: string,
    edition?: string,
): HTMLImageElement | 'loading' | 'error' {
    const setCode = edition ?? '*';
    const img = cardImageCache[cardName]?.[setCode]?.['normal'];
    if (img !== undefined) return img;
    requestKey(cardName, setCode, 'normal', edition);
    return 'loading';
}

export function ensureBackImage(
    cardName: string,
    edition?: string,
): HTMLImageElement | 'loading' | 'error' | null {
    const setCode = edition ?? '*';
    const img = cardImageCache[cardName]?.[setCode]?.['normal_back'];
    if (img !== undefined) return img;
    const setData = cardDataCache[cardName]?.[setCode];
    if (setData && !isMultiFaceLayout(setData.layout)) return null;
    requestKey(cardName, setCode, 'normal_back', edition);
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
    requestKey(cardName, setCode, 'border_crop', edition);
    return { img: 'loading', frame: null };
}

// Front-load image BYTES for a batch of cards without decoding them, so a live
// reveal pays only a single quick decode (no network) and unrevealed cards
// never cost a full decoded bitmap. URLs come from cache or the offline oracle
// bulk; a card resolvable only via the API falls back to fetch + decode.
export function warmCardImages(cardNames: string[]): void {
    for (const name of cardNames) {
        const cached = cardDataCache[name]?.['*']?.image_uris;
        const uris =
            cached && Object.keys(cached).length ? cached : seedUrlsFromOracle(name);
        if (uris && Object.keys(uris).length) warmBlobsForSet(name, '*', uris);
        else ensureCardData(name);
    }
}

export interface CardImageData {
    name: string;
    image_uris: Record<string, string>;
    frame?: string;
    layout?: string;
}

// Controller side: resolve the default-printing image data (links + frame +
// layout) for a card, seeding from the offline oracle bulk if needed. Returns
// null if the card is unknown to the bulk. Used to ship URLs to the overlay
// window, which has no oracle DB of its own.
export function resolveCardImageData(cardName: string): CardImageData | null {
    let data = cardDataCache[cardName]?.['*'];
    if (!data || !Object.keys(data.image_uris).length) {
        if (!seedUrlsFromOracle(cardName)) return null;
        data = cardDataCache[cardName]['*'];
    }
    return {
        name: cardName,
        image_uris: data.image_uris,
        ...(data.frame && { frame: data.frame }),
        ...(data.layout && { layout: data.layout }),
    };
}

// Overlay side: seed URL/metadata pushed from the controller (the overlay has
// no oracle DB), then warm the bytes so a reveal needs no network and no API.
export function preloadCardImageData(entries: CardImageData[]): void {
    for (const e of entries) {
        if (!e.image_uris || !Object.keys(e.image_uris).length) continue;
        if (!cardDataCache[e.name]) cardDataCache[e.name] = {};
        cardDataCache[e.name]['*'] = {
            image_uris: e.image_uris,
            ...(e.frame && { frame: e.frame }),
            ...(e.layout && { layout: e.layout }),
        };
        warmBlobsForSet(e.name, '*', e.image_uris);
    }
    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
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
    // Only restore URL/metadata. Blobs load lazily via ensureImage/ensureBorderCrop
    // when a card is actually rendered, not eagerly for every card ever cached.
    for (const [name, sets] of Object.entries(data)) {
        cardDataCache[name] = sets;
    }
    try { localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cardDataCache)); } catch {}
}

try {
    const raw = localStorage.getItem(CARD_CACHE_KEY);
    if (raw) restoreCardDataCache(JSON.parse(raw));
} catch {}
