const DB_NAME = 'spellsplice-cards';
const DB_VERSION = 2;
const STORE_CARDS = 'cards';
const STORE_META = 'meta';
const IDX_NAME = 'by-name';
const IDX_PRIMARY = 'by-primary';
const BULK_DATA_INFO_URL = 'https://api.scryfall.com/bulk-data/default-cards';

// Bump when the shape of stored card records changes, to force a re-sync
// even though the remote bulk data's updated_at hasn't changed.
const SCHEMA_VERSION = 7;

// Re-download the bulk when the local copy is older than this. Within the
// window we never touch the network (not even the bulk-data info endpoint).
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OracleCard {
    name: string;
    colors?: string[];
    mana_cost?: string;
    layout?: string;
    // Kept from the bulk download so image links need no per-card API call.
    // Keys mirror cardCache's SetData.image_uris; back-face keys only for DFCs.
    image_uris?: {
        normal?: string;
        border_crop?: string;
        normal_back?: string;
        border_crop_back?: string;
    };
    frame?: string;
    // Per-edition fields (the store now holds one record per printing).
    edition?: string; // Scryfall set code
    cn?: string; // collector number
    // set_name is not stored per record (fully implied by `edition`); it is
    // attached at read time from the meta setNames table by getPrintings.
    set_name?: string;
}

// Stored record adds the sparse `primaryName` marker: present only on the
// canonical (latest paper) printing per name, so the `by-primary` index yields
// exactly the one-per-name view we load into memory.
type StoredCard = OracleCard & { primaryName?: string };

// Transform and modal DFC cards store colors/mana_cost/images per-face
// instead of at the top level, and have two separately-illustrated faces.
export function isMultiFaceLayout(layout: string | undefined): boolean {
    return layout === 'transform' || layout === 'modal_dfc';
}

interface BulkMeta {
    key: 'bulk';
    fetchedAt: number;
    schema: number;
    count: number;
    setNames: Record<string, string>;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function getDb(): Promise<IDBDatabase> {
    return (dbPromise ??= openDb());
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            // The cards store shape changed (keyPath 'name' -> autoIncrement,
            // one record per printing); drop and rebuild it with its indexes.
            if (db.objectStoreNames.contains(STORE_CARDS)) {
                db.deleteObjectStore(STORE_CARDS);
            }
            const cards = db.createObjectStore(STORE_CARDS, { autoIncrement: true });
            cards.createIndex(IDX_NAME, 'name', { unique: false });
            cards.createIndex(IDX_PRIMARY, 'primaryName', { unique: false });
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

function setMeta(
    db: IDBDatabase,
    fetchedAt: number,
    count: number,
    setNames: Record<string, string>,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({
            key: 'bulk',
            fetchedAt,
            schema: SCHEMA_VERSION,
            count,
            setNames,
        } satisfies BulkMeta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function deleteMeta(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).delete('bulk');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Rows written per transaction. A single 113k-row transaction makes IndexedDB
// buffer every structured-cloned write in native memory until it commits, a big
// spike; smaller transactions commit and free between batches, and the await
// between them lets GC run.
const WRITE_CHUNK = 5000;

function runTx(db: IDBDatabase, work: (store: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CARDS, 'readwrite');
        work(tx.objectStore(STORE_CARDS));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function replaceCards(db: IDBDatabase, cards: StoredCard[]): Promise<void> {
    await runTx(db, (store) => store.clear());
    for (let i = 0; i < cards.length; i += WRITE_CHUNK) {
        const end = Math.min(i + WRITE_CHUNK, cards.length);
        await runTx(db, (store) => {
            for (let j = i; j < end; j++) store.put(cards[j]);
        });
    }
}

// Load the one-record-per-name canonical view (latest paper printing) via the
// sparse primary index, without reading every per-edition row.
function getPrimaryCards(db: IDBDatabase): Promise<StoredCard[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CARDS, 'readonly');
        const req = tx.objectStore(STORE_CARDS).index(IDX_PRIMARY).getAll();
        req.onsuccess = () => resolve(req.result as StoredCard[]);
        req.onerror = () => reject(req.error);
    });
}

function getByName(db: IDBDatabase, name: string): Promise<StoredCard[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CARDS, 'readonly');
        const req = tx
            .objectStore(STORE_CARDS)
            .index(IDX_NAME)
            .getAll(IDBKeyRange.only(name));
        req.onsuccess = () => resolve(req.result as StoredCard[]);
        req.onerror = () => reject(req.error);
    });
}

export type OracleCardsStatus = 'idle' | 'checking' | 'downloading' | 'storing' | 'ready' | 'error';

let cardsCache: OracleCard[] | null = null;
// Normalized-name -> canonical card, so findOracleCard (called from the overlay
// render path via overlayData.toOracle) is O(1) instead of an O(34k) scan that
// re-normalizes every card on every call.
let nameIndex: Map<string, OracleCard> | null = null;
let setNamesCache: Record<string, string> | null = null;
let loadPromise: Promise<OracleCard[]> | null = null;
let refreshing = false;

function setCardsCache(cards: OracleCard[]): void {
    cardsCache = cards;
    const m = new Map<string, OracleCard>();
    for (const c of cards) {
        const k = normalizeCardName(c.name);
        if (!m.has(k)) m.set(k, c);
    }
    nameIndex = m;
}

type RawUris = { normal?: string; border_crop?: string };
interface RawCard {
    name: string;
    set?: string;
    set_name?: string;
    collector_number?: string;
    layout?: string;
    colors?: string[];
    mana_cost?: string;
    frame?: string;
    released_at?: string;
    games?: string[];
    image_uris?: RawUris;
    card_faces?: Array<{
        colors?: string[];
        mana_cost?: string;
        image_uris?: RawUris;
    }>;
}

// Fetch the bulk, filter to the stored spec, mark canonical printings, persist,
// and refresh the in-memory caches. Shared by the blocking first load, the
// silent background refresh, and force refresh.
async function downloadAndStore(
    db: IDBDatabase,
    onStatus?: (status: OracleCardsStatus) => void,
): Promise<OracleCard[]> {
    const infoRes = await fetch(BULK_DATA_INFO_URL, { headers: { Accept: 'application/json' } });
    const info = await infoRes.json();
    // The full default-cards JSON is ~557MB, past V8's ~512MiB max string
    // length, so Response.json() throws. Stream the gzipped JSONL variant and
    // parse one card per line instead: no giant string, lower peak memory.
    const jsonlUri: string = info.jsonl_download_uri;

    const records: StoredCard[] = [];
    const setNames: Record<string, string> = {};
    // Track the latest paper printing per name so we can flag it canonical.
    const bestPaper = new Map<string, { idx: number; released: string }>();

    const handleCard = (c: RawCard): void => {
        if (c.layout === 'art_series') return;
        if (c.set && c.set_name) setNames[c.set] = c.set_name;

        // Transform/modal-DFC cards omit top-level colors/mana_cost/image_uris;
        // fall back to the per-face values.
        const front = c.card_faces?.[0];
        const back = c.card_faces?.[1];
        const frontUris = front?.image_uris ?? c.image_uris;
        const backUris = back?.image_uris;
        const image_uris: OracleCard['image_uris'] = {};
        if (frontUris?.normal) image_uris.normal = frontUris.normal;
        if (frontUris?.border_crop) image_uris.border_crop = frontUris.border_crop;
        if (backUris?.normal) image_uris.normal_back = backUris.normal;
        if (backUris?.border_crop) image_uris.border_crop_back = backUris.border_crop;

        const rec: StoredCard = { name: c.name, edition: c.set };
        const colors = c.colors ?? front?.colors;
        if (colors) rec.colors = colors;
        const mana = c.mana_cost ?? front?.mana_cost;
        if (mana) rec.mana_cost = mana;
        if (c.layout) rec.layout = c.layout;
        if (c.frame) rec.frame = c.frame;
        if (c.collector_number) rec.cn = c.collector_number;
        if (Object.keys(image_uris).length > 0) rec.image_uris = image_uris;

        const idx = records.push(rec) - 1;

        // Canonical = newest paper printing. released_at is YYYY-MM-DD, so a
        // lexicographic max is chronological. Digital-only names never get a
        // canonical record and so stay out of the in-memory view.
        if (c.games?.includes('paper') && c.released_at) {
            const prev = bestPaper.get(c.name);
            if (!prev || c.released_at > prev.released) {
                bestPaper.set(c.name, { idx, released: c.released_at });
            }
        }
    };

    onStatus?.('downloading');
    const res = await fetch(jsonlUri);
    if (!res.ok || !res.body) throw new Error(`bulk download failed: ${res.status}`);

    const stream = res.body
        .pipeThrough(new DecompressionStream('gzip'))
        .pipeThrough(new TextDecoderStream());
    const reader = stream.getReader();
    let buf = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            if (line) handleCard(JSON.parse(line));
        }
    }
    if (buf.trim()) handleCard(JSON.parse(buf));

    onStatus?.('storing');
    for (const { idx } of bestPaper.values()) {
        records[idx].primaryName = records[idx].name;
    }

    await replaceCards(db, records);
    await setMeta(db, Date.now(), records.length, setNames);

    setNamesCache = setNames;
    setCardsCache(records.filter((r) => r.primaryName));
    return cardsCache!;
}

// Kick a silent, non-blocking re-download when the local copy is past its TTL.
function refreshInBackground(db: IDBDatabase): void {
    if (refreshing) return;
    refreshing = true;
    downloadAndStore(db)
        .catch((err) => console.warn('background card refresh failed', err))
        .finally(() => {
            refreshing = false;
        });
}

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
            const db = await getDb();
            const meta = await getMeta(db);

            if (meta && meta.schema === SCHEMA_VERSION) {
                setNamesCache = meta.setNames ?? {};
                const cards = await getPrimaryCards(db);
                setCardsCache(cards);
                onStatus?.('ready');
                // Stale but usable: serve now, refresh silently in the background.
                if (Date.now() - meta.fetchedAt > TTL_MS) refreshInBackground(db);
                return cards;
            }

            // No usable local copy (first run or schema bump): blocking download.
            const cards = await downloadAndStore(db, onStatus);
            onStatus?.('ready');
            return cards;
        } catch (err) {
            loadPromise = null;
            onStatus?.('error');
            console.error('card database load failed', err);
            throw err;
        }
    })();

    return loadPromise;
}

export async function forceRefreshOracleCards(onStatus?: (status: OracleCardsStatus) => void): Promise<OracleCard[]> {
    cardsCache = null;
    nameIndex = null;
    setNamesCache = null;
    loadPromise = null;
    const db = await getDb();
    await deleteMeta(db);
    return ensureOracleCards(onStatus);
}

// Read every printing of a card straight from IndexedDB (edition picker,
// per-edition image metadata, decklist verify). set_name is attached from the
// cached code->name table. Empty result => caller falls back to Scryfall.
export async function getPrintings(name: string): Promise<OracleCard[]> {
    const db = await getDb();
    const rows = await getByName(db, name);
    const names = setNamesCache ?? {};
    return rows.map((r) => ({
        ...r,
        set_name: r.edition ? names[r.edition] : undefined,
    }));
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
    const exact = nameIndex?.get(q);
    if (exact) return exact;
    // Split/double-faced names ("Fire // Ice") indexed under the full name only;
    // fall back to a per-face scan (rare, so the O(n) cost is acceptable).
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
