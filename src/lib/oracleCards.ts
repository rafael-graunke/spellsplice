const DB_NAME = 'spellsplice-cards';
// v3: replaced the single per-printing 'cards' store (+2 secondary indexes)
// with two name-keyed stores and no secondary indexes at all.
const DB_VERSION = 3;
const STORE_CANONICAL = 'canonical';
const STORE_PRINTINGS = 'printings';
const STORE_META = 'meta';
const BULK_DATA_INFO_URL = 'https://api.scryfall.com/bulk-data/default-cards';

// Bump when the shape of stored card records changes, to force a re-sync
// even though the remote bulk data's updated_at hasn't changed.
const SCHEMA_VERSION = 8;

// Re-download the bulk when the local copy is older than this. Within the
// window we never touch the network (not even the bulk-data info endpoint).
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OracleCard {
    name: string;
    colors?: string[];
    mana_cost?: string;
    layout?: string;
    // Reconstructed at read time from the stored image id (see reconstructUris);
    // never persisted. Keys mirror cardCache's SetData.image_uris; back-face keys
    // only for DFCs.
    image_uris?: {
        normal?: string;
        border_crop?: string;
        normal_back?: string;
        border_crop_back?: string;
    };
    frame?: string;
    // Per-edition fields, populated only by getPrintings (the in-memory canonical
    // view leaves them unset).
    edition?: string; // Scryfall set code
    cn?: string; // collector number
    // set_name is not stored per record (fully implied by `edition`); it is
    // attached at read time from the meta setNames table by getPrintings.
    set_name?: string;
}

// Stored shape, canonical-store: one record per name (the newest paper printing,
// in full) keyed by `name`. `img` is the bare Scryfall image id; image URLs are
// rebuilt from it on read. No image_uris on disk.
interface CanonicalRecord {
    name: string;
    colors?: string[];
    mana_cost?: string;
    layout?: string;
    frame?: string;
    img?: string;
}

// Stored shape, printings-store: one record per name aggregating every printing.
// `layout` is oracle-invariant so it lives once at the top, not per printing.
interface PrintingEntry {
    edition?: string;
    cn?: string;
    frame?: string;
    img?: string;
}
interface PrintingsRecord {
    name: string;
    layout?: string;
    printings: PrintingEntry[];
}

// Transform and modal DFC cards store colors/mana_cost/images per-face
// instead of at the top level, and have two separately-illustrated faces.
export function isMultiFaceLayout(layout: string | undefined): boolean {
    return layout === 'transform' || layout === 'modal_dfc';
}

// ---- image id <-> url ------------------------------------------------------

const IMG_HOST = 'https://cards.scryfall.io';

// Scryfall image paths are fully templated by size, face, and the card's image
// id (sharded on its first two chars). We store just the id and rebuild every
// variant. The `?<mtime>` cache-buster the API appends is intentionally dropped:
// keeping it stored buys nothing (the path already loads without it) and a fresh
// or synthesized value would only defeat browser/CDN caching.
function imgUri(
    id: string,
    size: 'normal' | 'border_crop',
    face: 'front' | 'back'
): string {
    return `${IMG_HOST}/${size}/${face}/${id[0]}/${id[1]}/${id}.jpg`;
}

// Pull the bare image id out of a full Scryfall image URL (.../{id}.jpg?ts).
const IMG_ID_RE = /\/([0-9a-f-]{36})\.(?:jpg|png)/;
function idFromUri(url: string | undefined): string | undefined {
    return url ? (IMG_ID_RE.exec(url)?.[1] ?? undefined) : undefined;
}

// Rebuild the image_uris object consumers expect from a stored image id. DFCs
// get back-face variants too; front and back share the same id, differing only
// in the face path segment.
function reconstructUris(
    img: string | undefined,
    layout: string | undefined
): OracleCard['image_uris'] | undefined {
    if (!img) return undefined;
    const uris: OracleCard['image_uris'] = {
        normal: imgUri(img, 'normal', 'front'),
        border_crop: imgUri(img, 'border_crop', 'front'),
    };
    if (isMultiFaceLayout(layout)) {
        uris.normal_back = imgUri(img, 'normal', 'back');
        uris.border_crop_back = imgUri(img, 'border_crop', 'back');
    }
    return uris;
}

function hydrateCanonical(r: CanonicalRecord): OracleCard {
    const image_uris = reconstructUris(r.img, r.layout);
    const card: OracleCard = { name: r.name };
    if (r.colors) card.colors = r.colors;
    if (r.mana_cost) card.mana_cost = r.mana_cost;
    if (r.layout) card.layout = r.layout;
    if (r.frame) card.frame = r.frame;
    if (image_uris) card.image_uris = image_uris;
    return card;
}

// ---- indexeddb -------------------------------------------------------------

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
            // Drop the pre-v3 per-printing store; both new stores are keyed by
            // `name` and carry no secondary indexes.
            if (db.objectStoreNames.contains('cards')) {
                db.deleteObjectStore('cards');
            }
            if (!db.objectStoreNames.contains(STORE_CANONICAL)) {
                db.createObjectStore(STORE_CANONICAL, { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains(STORE_PRINTINGS)) {
                db.createObjectStore(STORE_PRINTINGS, { keyPath: 'name' });
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

function setMeta(
    db: IDBDatabase,
    fetchedAt: number,
    count: number,
    setNames: Record<string, string>
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

// Rows written per transaction. A single huge transaction makes IndexedDB buffer
// every structured-cloned write in native memory until it commits, a big spike;
// smaller transactions commit and free between batches, and the await between
// them lets GC run.
const WRITE_CHUNK = 20000;

function runTx(
    db: IDBDatabase,
    storeName: string,
    work: (store: IDBObjectStore) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        work(tx.objectStore(storeName));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// Bulk-insert into a freshly cleared, name-keyed store. add() not put(): the
// store was just cleared and every key is unique per name, so no write collides;
// add() skips the existing-key lookup put() runs per row. No secondary index
// means each row costs one primary-key insert and nothing more.
async function writeRows<T>(
    db: IDBDatabase,
    storeName: string,
    rows: T[],
    onProgress?: (fraction: number) => void
): Promise<void> {
    for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
        const end = Math.min(i + WRITE_CHUNK, rows.length);
        await runTx(db, storeName, (store) => {
            for (let j = i; j < end; j++) store.add(rows[j]);
        });
        onProgress?.(end / rows.length);
    }
}

// Load the one-record-per-name canonical view with a single getAll on the
// canonical store (no index, no per-printing rows touched).
function getAllCanonical(db: IDBDatabase): Promise<CanonicalRecord[]> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CANONICAL, 'readonly');
        const req = tx.objectStore(STORE_CANONICAL).getAll();
        req.onsuccess = () => resolve(req.result as CanonicalRecord[]);
        req.onerror = () => reject(req.error);
    });
}

function getPrintingsRecord(
    db: IDBDatabase,
    name: string
): Promise<PrintingsRecord | undefined> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PRINTINGS, 'readonly');
        const req = tx.objectStore(STORE_PRINTINGS).get(name);
        req.onsuccess = () =>
            resolve(req.result as PrintingsRecord | undefined);
        req.onerror = () => reject(req.error);
    });
}

// ---- module cache ----------------------------------------------------------

export type OracleCardsStatus =
    'idle' | 'checking' | 'downloading' | 'storing' | 'ready' | 'error';

// progress is 0..1 within the current phase; omitted when the phase has no
// measurable total (e.g. a download with no Content-Length -> indeterminate bar).
export type OracleCardsProgress = (
    status: OracleCardsStatus,
    progress?: number
) => void;

let cardsCache: OracleCard[] | null = null;
// Normalized-name -> canonical card, so findOracleCard (called from the overlay
// render path via overlayData.toOracle) is O(1) instead of an O(34k) scan that
// re-normalizes every card on every call.
let nameIndex: Map<string, OracleCard> | null = null;
let setNamesCache: Record<string, string> | null = null;
let loadPromise: Promise<OracleCard[]> | null = null;
let refreshing = false;
// The non-blocking write of the printings store, kicked after the canonical
// store is in and the UI unblocks. Held so a force refresh waits for it and a
// TTL refresh won't start a second, racing rebuild.
let restWrite: Promise<void> | null = null;

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

// Fetch the bulk, build the canonical + printings records, persist canonical
// first (unblocking the UI) then printings in the background, and refresh the
// in-memory caches. Shared by the blocking first load, the silent background
// refresh, and force refresh.
async function downloadAndStore(
    db: IDBDatabase,
    onStatus?: OracleCardsProgress
): Promise<OracleCard[]> {
    const infoRes = await fetch(BULK_DATA_INFO_URL, {
        headers: { Accept: 'application/json' },
    });
    const info = await infoRes.json();
    // The full default-cards JSON is ~557MB, past V8's ~512MiB max string
    // length, so Response.json() throws. Stream the gzipped JSONL variant and
    // parse one card per line instead: no giant string, lower peak memory.
    const jsonlUri: string = info.jsonl_download_uri;

    const setNames: Record<string, string> = {};
    // One aggregate printings record per name (every printing nested).
    const printingsByName = new Map<string, PrintingsRecord>();
    // Newest paper printing per name -> the canonical record + its release date.
    const canonicalByName = new Map<
        string,
        { rec: CanonicalRecord; released: string }
    >();

    const handleCard = (c: RawCard): void => {
        if (c.layout === 'art_series') return;
        if (c.set && c.set_name) setNames[c.set] = c.set_name;

        // Transform/modal-DFC cards omit top-level colors/mana_cost/image_uris;
        // fall back to the per-face front values.
        const front = c.card_faces?.[0];
        const frontUris = front?.image_uris ?? c.image_uris;
        const img = idFromUri(frontUris?.normal ?? frontUris?.border_crop);

        // printings store: append this printing to the name's aggregate.
        let pr = printingsByName.get(c.name);
        if (!pr) {
            pr = { name: c.name, printings: [] };
            if (c.layout) pr.layout = c.layout;
            printingsByName.set(c.name, pr);
        }
        const entry: PrintingEntry = {};
        if (c.set) entry.edition = c.set;
        if (c.collector_number) entry.cn = c.collector_number;
        if (c.frame) entry.frame = c.frame;
        if (img) entry.img = img;
        pr.printings.push(entry);

        // canonical = newest paper printing. released_at is YYYY-MM-DD, so a
        // lexicographic max is chronological. Digital-only names never win a
        // canonical record and so stay out of the in-memory view.
        if (c.games?.includes('paper') && c.released_at) {
            const prev = canonicalByName.get(c.name);
            if (!prev || c.released_at > prev.released) {
                const rec: CanonicalRecord = { name: c.name };
                const colors = c.colors ?? front?.colors;
                if (colors) rec.colors = colors;
                const mana = c.mana_cost ?? front?.mana_cost;
                if (mana) rec.mana_cost = mana;
                if (c.layout) rec.layout = c.layout;
                if (c.frame) rec.frame = c.frame;
                if (img) rec.img = img;
                canonicalByName.set(c.name, { rec, released: c.released_at });
            }
        }
    };

    onStatus?.('downloading', 0);
    const res = await fetch(jsonlUri);
    if (!res.ok || !res.body)
        throw new Error(`bulk download failed: ${res.status}`);

    // Count compressed bytes against Content-Length for a download %. Direct
    // scryfall.io file origins send Content-Length; if absent, total stays 0 and
    // we emit no fraction (indeterminate bar). Only report on whole-% steps so
    // React isn't flooded with a setState per stream chunk.
    const total = Number(res.headers.get('Content-Length')) || 0;
    let received = 0;
    let lastPct = -1;
    const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            if (total) {
                received += chunk.byteLength;
                const pct = Math.floor((received / total) * 100);
                if (pct !== lastPct) {
                    lastPct = pct;
                    onStatus?.('downloading', received / total);
                }
            }
            controller.enqueue(chunk);
        },
    });

    // Cast the counter's readable side back to res.body's exact chunk type so it
    // pipes into DecompressionStream. TS 5.7's Uint8Array<ArrayBuffer> vs the
    // TransformStream generic's ArrayBufferLike otherwise mismatch here.
    const stream = (
        res.body.pipeThrough(counter) as ReadableStream<Uint8Array<ArrayBuffer>>
    )
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

    onStatus?.('storing', 0);
    const canonicalRecs = Array.from(canonicalByName.values(), (v) => v.rec);
    const printingsRecs = Array.from(printingsByName.values());

    // Drop meta up front so a crash mid-write leaves no "valid" flag pointing at
    // half-written stores; a reload then re-downloads instead of reading empty.
    await deleteMeta(db);
    await runTx(db, STORE_CANONICAL, (s) => s.clear());
    await runTx(db, STORE_PRINTINGS, (s) => s.clear());

    // Blocking: write the canonical view, then unblock the UI with it in memory.
    await writeRows(db, STORE_CANONICAL, canonicalRecs, (f) =>
        onStatus?.('storing', f)
    );
    setNamesCache = setNames;
    setCardsCache(canonicalRecs.map(hydrateCanonical));

    // Background: the ~2x-larger printings store isn't on the load path (only the
    // edition picker / decklist verify read it), so write it after the UI is up.
    // setMeta lands last, marking the whole DB valid only once both stores are in.
    restWrite = (async () => {
        try {
            await writeRows(db, STORE_PRINTINGS, printingsRecs);
            await setMeta(db, Date.now(), canonicalRecs.length, setNames);
        } catch (err) {
            console.warn('background printings write failed', err);
        } finally {
            restWrite = null;
        }
    })();

    return cardsCache!;
}

// Kick a silent, non-blocking re-download when the local copy is past its TTL.
function refreshInBackground(db: IDBDatabase): void {
    if (refreshing || restWrite) return;
    refreshing = true;
    downloadAndStore(db)
        .catch((err) => console.warn('background card refresh failed', err))
        .finally(() => {
            refreshing = false;
        });
}

export function ensureOracleCards(
    onStatus?: OracleCardsProgress
): Promise<OracleCard[]> {
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
            }
        );
    }

    loadPromise = (async () => {
        try {
            onStatus?.('checking');
            const db = await getDb();
            const meta = await getMeta(db);

            if (meta && meta.schema === SCHEMA_VERSION) {
                setNamesCache = meta.setNames ?? {};
                const recs = await getAllCanonical(db);
                setCardsCache(recs.map(hydrateCanonical));
                onStatus?.('ready');
                // Stale but usable: serve now, refresh silently in the background.
                if (Date.now() - meta.fetchedAt > TTL_MS)
                    refreshInBackground(db);
                return cardsCache!;
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

export async function forceRefreshOracleCards(
    onStatus?: OracleCardsProgress
): Promise<OracleCard[]> {
    // Let any in-flight background printings write finish first, so we don't
    // clear the stores out from under it.
    if (restWrite) await restWrite.catch(() => {});
    cardsCache = null;
    nameIndex = null;
    setNamesCache = null;
    loadPromise = null;
    const db = await getDb();
    await deleteMeta(db);
    return ensureOracleCards(onStatus);
}

// Read every printing of a card straight from IndexedDB (edition picker,
// per-edition image metadata, decklist verify). One get() on the printings
// store; image URLs are rebuilt from stored ids, set_name from the cached
// code->name table. Empty result => caller falls back to Scryfall.
export async function getPrintings(name: string): Promise<OracleCard[]> {
    const db = await getDb();
    const rec = await getPrintingsRecord(db, name);
    if (!rec) return [];
    const names = setNamesCache ?? {};
    return rec.printings.map((p) => {
        const card: OracleCard = { name, layout: rec.layout };
        if (p.edition) {
            card.edition = p.edition;
            card.set_name = names[p.edition];
        }
        if (p.cn) card.cn = p.cn;
        if (p.frame) card.frame = p.frame;
        const image_uris = reconstructUris(p.img, rec.layout);
        if (image_uris) card.image_uris = image_uris;
        return card;
    });
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
        c.name.split(' // ').some((face) => normalizeCardName(face) === q)
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
