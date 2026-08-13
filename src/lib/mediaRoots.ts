import { kindOf, type CandidateFile } from './matchSources';

const DB_NAME = 'spellsplice-media';
const DB_VERSION = 1;
const STORE = 'roots';

// Walk limits. A media folder that needs more than this is almost certainly the
// user having picked a home directory by mistake, and walking it would hang the
// dialog rather than help.
const MAX_DEPTH = 4;
const MAX_FILES = 2000;

/**
 * Permission and directory-iteration members of the File System Access API that
 * lib.dom does not declare. Mirrors the `as any` cast already used for
 * showSaveFilePicker in features/export/codec.ts.
 */
type DirHandle = FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
    queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
    let db: IDBDatabase;
    try {
        db = await openDb();
    } catch {
        // Private browsing and blocked storage both reject here. Losing the
        // remembered folder is a downgrade to the manual picker, not an error
        // worth surfacing.
        return undefined;
    }
    try {
        return await new Promise<T>((resolve, reject) => {
            const req = fn(db.transaction(STORE, mode).objectStore(STORE));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch {
        return undefined;
    } finally {
        db.close();
    }
}

export function getMediaRoot(projectId: string): Promise<FileSystemDirectoryHandle | undefined> {
    return withStore<FileSystemDirectoryHandle>('readonly', (s) => s.get(projectId));
}

export async function setMediaRoot(
    projectId: string,
    handle: FileSystemDirectoryHandle,
): Promise<void> {
    await withStore('readwrite', (s) => s.put(handle, projectId) as IDBRequest<IDBValidKey>);
}

export async function deleteMediaRoot(projectId: string): Promise<void> {
    await withStore('readwrite', (s) => s.delete(projectId) as IDBRequest<undefined>);
}

type PickerWindow = Window & {
    showDirectoryPicker?: (options?: {
        mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
};

export function supportsDirectoryPicker(): boolean {
    return typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

export async function pickMediaRoot(): Promise<FileSystemDirectoryHandle | null> {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) return null;
    try {
        return await picker.call(window, { mode: 'read' });
    } catch {
        // AbortError when the user dismisses the picker.
        return null;
    }
}

/**
 * Checks read permission on a stored handle. `request: true` may only be passed
 * from a real user gesture: requestPermission needs user activation, and the
 * awaits inside importProject consume the activation from the File > Open click,
 * so the project-open path must query only and let a button do the asking.
 */
export async function ensureReadPermission(
    handle: FileSystemDirectoryHandle,
    { request = false }: { request?: boolean } = {},
): Promise<boolean> {
    const dir = handle as DirHandle;
    try {
        if ((await dir.queryPermission({ mode: 'read' })) === 'granted') return true;
        if (!request) return false;
        return (await dir.requestPermission({ mode: 'read' })) === 'granted';
    } catch {
        return false;
    }
}

/** Recursively collects media files, tagging each with its path relative to the root. */
export async function collectFiles(
    handle: FileSystemDirectoryHandle,
    maxDepth = MAX_DEPTH,
): Promise<CandidateFile[]> {
    const out: CandidateFile[] = [];

    async function walk(dir: DirHandle, prefix: string, depth: number): Promise<void> {
        if (depth > maxDepth || out.length >= MAX_FILES) return;
        for await (const entry of dir.values()) {
            if (out.length >= MAX_FILES) return;
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.kind === 'directory') {
                await walk(entry as DirHandle, path, depth + 1);
            } else {
                try {
                    const file = await (entry as FileSystemFileHandle).getFile();
                    if (kindOf(file)) out.push({ file, relativePath: path });
                } catch {
                    // Unreadable entry (permission, deleted mid-walk) — skip.
                }
            }
        }
    }

    try {
        await walk(handle as DirHandle, '', 0);
    } catch {
        // Partial results are still useful; return what was collected.
    }
    return out;
}
