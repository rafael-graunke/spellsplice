const DB_NAME = 'spellsplice-cards';
const DB_VERSION = 1;
const STORE_CARDS = 'cards';
const STORE_META = 'meta';
const BULK_DATA_INFO_URL = 'https://api.scryfall.com/bulk-data/oracle-cards';

// Bump when the shape of stored card records changes, to force a re-sync
// even though the remote bulk data's updated_at hasn't changed.
const SCHEMA_VERSION = 5;

export interface OracleCard {
    name: string;
    colors?: string[];
    mana_cost?: string;
    layout?: string;
}

// Transform and modal DFC cards store colors/mana_cost/images per-face
// instead of at the top level, and have two separately-illustrated faces.
export function isMultiFaceLayout(layout: string | undefined): boolean {
    return layout === 'transform' || layout === 'modal_dfc';
}

interface BulkMeta {
    key: 'bulk';
    updatedAt: string;
    schema: number;
    count: number;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_CARDS)) {
                db.createObjectStore(STORE_CARDS, { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getMeta(db: IDBDatabase): Promise<BulkMeta | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get('bulk');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function setMeta(db: IDBDatabase, updatedAt: string, count: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({ key: 'bulk', updatedAt, schema: SCHEMA_VERSION, count } satisfies BulkMeta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function putCards(db: IDBDatabase, cards: OracleCard[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CARDS, 'readwrite');
        const store = tx.objectStore(STORE_CARDS);
        for (const card of cards) store.put(card);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function getAllCards(db: IDBDatabase): Promise<OracleCard[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CARDS, 'readonly');
        const req = tx.objectStore(STORE_CARDS).getAll();
        req.onsuccess = () => resolve(req.result as OracleCard[]);
        req.onerror = () => reject(req.error);
    });
}

export type OracleCardsStatus = 'idle' | 'checking' | 'downloading' | 'storing' | 'ready' | 'error';

let cardsCache: OracleCard[] | null = null;
let loadPromise: Promise<OracleCard[]> | null = null;

export function ensureOracleCards(onStatus?: (status: OracleCardsStatus) => void): Promise<OracleCard[]> {
    if (cardsCache) {
        onStatus?.('ready');
        return Promise.resolve(cardsCache);
    }
    if (loadPromise) {
        return loadPromise.then(
            (cards) => {
                onStatus?.('ready');
                return cards;
            },
            (err) => {
                onStatus?.('error');
                throw err;
            },
        );
    }

    loadPromise = (async () => {
        try {
            onStatus?.('checking');
            const db = await openDb();
            const meta = await getMeta(db);

            const infoRes = await fetch(BULK_DATA_INFO_URL, { headers: { Accept: 'application/json' } });
            const info = await infoRes.json();
            const remoteUpdatedAt: string = info.updated_at;
            const downloadUri: string = info.download_uri;

            if (meta && meta.updatedAt === remoteUpdatedAt && meta.schema === SCHEMA_VERSION) {
                const cards = await getAllCards(db);
                cardsCache = cards;
                onStatus?.('ready');
                return cards;
            }

            onStatus?.('downloading');
            const cardsRes = await fetch(downloadUri);
            const raw: Array<{
                name: string;
                layout?: string;
                colors?: string[];
                mana_cost?: string;
                card_faces?: Array<{ colors?: string[]; mana_cost?: string }>;
            }> = await cardsRes.json();

            const byName = new Map<string, OracleCard>();
            for (const c of raw) {
                if (c.layout === 'art_series') continue;
                if (!byName.has(c.name)) {
                    // Transform/modal-DFC cards omit top-level colors/mana_cost;
                    // fall back to the front face's values.
                    const front = c.card_faces?.[0];
                    byName.set(c.name, {
                        name: c.name,
                        colors: c.colors ?? front?.colors,
                        mana_cost: c.mana_cost ?? front?.mana_cost,
                        layout: c.layout,
                    });
                }
            }
            const cards = [...byName.values()];

            onStatus?.('storing');
            await putCards(db, cards);
            await setMeta(db, remoteUpdatedAt, cards.length);

            cardsCache = cards;
            onStatus?.('ready');
            return cards;
        } catch (err) {
            loadPromise = null;
            onStatus?.('error');
            throw err;
        }
    })();

    return loadPromise;
}

export async function forceRefreshOracleCards(onStatus?: (status: OracleCardsStatus) => void): Promise<OracleCard[]> {
    cardsCache = null;
    loadPromise = null;
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).delete('bulk');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    return ensureOracleCards(onStatus);
}

function normalizeCardName(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/['’]/g, '')
        .toLowerCase();
}

export function findOracleCard(name: string): OracleCard | undefined {
    if (!cardsCache) return undefined;
    const q = normalizeCardName(name);
    const exact = cardsCache.find((c) => normalizeCardName(c.name) === q);
    if (exact) return exact;
    return cardsCache.find((c) =>
        c.name.split(' // ').some((face) => normalizeCardName(face) === q),
    );
}

export function searchOracleCards(query: string, limit = 20): OracleCard[] {
    if (!cardsCache || !query) return [];
    const q = normalizeCardName(query);

    const exact: OracleCard[] = [];
    const prefix: OracleCard[] = [];
    const substring: OracleCard[] = [];

    for (const card of cardsCache) {
        const name = normalizeCardName(card.name);
        if (name === q) exact.push(card);
        else if (name.startsWith(q)) prefix.push(card);
        else if (name.includes(q)) substring.push(card);
    }

    prefix.sort((a, b) => a.name.localeCompare(b.name));
    substring.sort((a, b) => a.name.localeCompare(b.name));

    return [...exact, ...prefix, ...substring].slice(0, limit);
}
