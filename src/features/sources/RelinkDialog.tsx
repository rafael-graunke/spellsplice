import { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { AudioLines, FolderOpen, Link2, Link2Off, Loader2, Plus, Trash2 } from 'lucide-react';
import type { MediaSource } from '../../types/source';
import type { Clip } from '../../types/clip';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toCandidates, unclaimedFiles, type CandidateFile, type SourceMatch } from '@/lib/matchSources';
import { matchCandidates, type MediaResolution } from '@/lib/resolveMedia';
import {
    collectFiles,
    ensureReadPermission,
    getMediaRoot,
    pickMediaRoot,
    setMediaRoot,
    supportsDirectoryPicker,
} from '@/lib/mediaRoots';

interface RelinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    sources: MediaSource[];
    clipsByTrack: Record<string, Clip[]>;
    onRelink: (sourceId: string, file: File) => void;
    onRelinkMany: (pairs: Array<{ sourceId: string; file: File }>) => void;
    onDelete: (sourceId: string) => void;
    onRelinkClips: (oldSourceId: string, newSourceId: string) => void;
    onDeleteOrphanedClips: (sourceId: string) => void;
    deletedSourceNames: Record<string, string>;
    /** Seeded by App from the resolve it already ran on project open. */
    resolution?: MediaResolution | null;
}

function clipCount(sourceId: string, clipsByTrack: Record<string, Clip[]>): number {
    return Object.values(clipsByTrack)
        .flat()
        .filter((c) => c.sourceId === sourceId).length;
}

const CONFIDENCE_STYLE: Record<SourceMatch['confidence'], string> = {
    exact: 'text-green-500',
    strong: 'text-green-500',
    weak: 'text-amber-500',
    none: 'text-destructive',
};

export function RelinkDialog({
    open,
    onOpenChange,
    projectId,
    sources,
    clipsByTrack,
    onRelink,
    onRelinkMany,
    onDelete,
    onRelinkClips,
    onDeleteOrphanedClips,
    deletedSourceNames,
    resolution,
}: RelinkDialogProps) {
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [confirmOrphanId, setConfirmOrphanId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const filesInputRef = useRef<HTMLInputElement>(null);
    const dirInputRef = useRef<HTMLInputElement>(null);
    const pendingRelinkId = useRef<string | null>(null);

    const [candidates, setCandidates] = useState<CandidateFile[]>([]);
    const [matches, setMatches] = useState<Map<string, SourceMatch>>(new Map());
    const [rootName, setRootName] = useState<string | undefined>();
    const [needsPermission, setNeedsPermission] = useState(false);
    const [busy, setBusy] = useState(false);

    const offlineSources = useMemo(() => sources.filter((s) => !s.file), [sources]);

    useEffect(() => {
        if (!open) return;
        setRootName(resolution?.rootName);
        setNeedsPermission(resolution?.needsPermission ?? false);
        if (resolution?.matches.length) {
            setMatches(new Map(resolution.matches.map((m) => [m.sourceId, m])));
            setCandidates(resolution.candidates);
        }
    }, [open, resolution]);

    const runMatch = useCallback(
        async (cands: CandidateFile[]) => {
            setBusy(true);
            try {
                setCandidates(cands);
                const next = await matchCandidates(offlineSources, cands);
                setMatches(new Map(next.map((m) => [m.sourceId, m])));
            } finally {
                setBusy(false);
            }
        },
        [offlineSources],
    );

    const handleChooseFolder = useCallback(async () => {
        if (!supportsDirectoryPicker()) {
            dirInputRef.current?.click();
            return;
        }
        const handle = await pickMediaRoot();
        if (!handle) return;
        setBusy(true);
        try {
            await setMediaRoot(projectId, handle);
            setRootName(handle.name);
            setNeedsPermission(false);
            await runMatch(await collectFiles(handle));
        } finally {
            setBusy(false);
        }
    }, [projectId, runMatch]);

    const handleReconnect = useCallback(async () => {
        const handle = await getMediaRoot(projectId);
        if (!handle) {
            await handleChooseFolder();
            return;
        }
        // Called straight from the click, so user activation is still live and
        // requestPermission is allowed to prompt.
        if (!(await ensureReadPermission(handle, { request: true }))) return;
        setBusy(true);
        try {
            setNeedsPermission(false);
            await runMatch(await collectFiles(handle));
        } finally {
            setBusy(false);
        }
    }, [projectId, handleChooseFolder, runMatch]);

    const handleOverride = useCallback((sourceId: string, cand: CandidateFile | null) => {
        setMatches((prev) => {
            const next = new Map(prev);
            if (!cand) {
                next.set(sourceId, { sourceId, confidence: 'none', reason: 'no match' });
                return next;
            }
            // A file can only back one source, so take it from whoever holds it.
            for (const [id, m] of next) {
                if (m.file === cand.file && id !== sourceId)
                    next.set(id, { sourceId: id, confidence: 'none', reason: 'no match' });
            }
            next.set(sourceId, { sourceId, file: cand.file, confidence: 'strong', reason: 'chosen' });
            return next;
        });
    }, []);

    const pending = useMemo(
        () =>
            offlineSources
                .map((s) => matches.get(s.id))
                .filter((m): m is SourceMatch & { file: File } => !!m?.file)
                .map((m) => ({ sourceId: m.sourceId, file: m.file })),
        [offlineSources, matches],
    );

    const handleApply = useCallback(() => {
        onRelinkMany(pending);
        setMatches(new Map());
        setCandidates([]);
    }, [onRelinkMany, pending]);

    const unclaimed = useMemo(
        () => unclaimedFiles(candidates, Array.from(matches.values())),
        [candidates, matches],
    );

    const handleRelinkClick = (sourceId: string) => {
        pendingRelinkId.current = sourceId;
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && pendingRelinkId.current) {
            onRelink(pendingRelinkId.current, file);
            pendingRelinkId.current = null;
        }
        e.target.value = '';
    };

    const handleDelete = (sourceId: string) => {
        onDelete(sourceId);
        setConfirmId(null);
    };

    const orphanedGroups = useMemo(() => {
        const sourceIds = new Set(sources.map((s) => s.id));
        const groups = new Map<string, number>();
        for (const clips of Object.values(clipsByTrack)) {
            for (const clip of clips) {
                if (!sourceIds.has(clip.sourceId)) {
                    groups.set(clip.sourceId, (groups.get(clip.sourceId) ?? 0) + 1);
                }
            }
        }
        return Array.from(groups.entries()).map(([sourceId, count]) => ({
            sourceId,
            name: deletedSourceNames[sourceId] ?? 'Unknown source',
            count,
        }));
    }, [sources, clipsByTrack, deletedSourceNames]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl" showCloseButton>
                <DialogHeader>
                    <DialogTitle>Manage Sources</DialogTitle>
                </DialogHeader>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*,image/*"
                    className="hidden"
                    onChange={handleFileChange}
                />
                <input
                    ref={filesInputRef}
                    type="file"
                    accept="video/*,audio/*,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) runMatch(toCandidates(e.target.files));
                        e.target.value = '';
                    }}
                />
                <input
                    ref={dirInputRef}
                    type="file"
                    multiple
                    // No handle comes back from a directory input, so this path
                    // matches once but cannot power a silent relink next open.
                    // @ts-expect-error non-standard attribute, supported everywhere it matters
                    webkitdirectory=""
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) runMatch(toCandidates(e.target.files));
                        e.target.value = '';
                    }}
                />

                {offlineSources.length > 0 && (
                    <div className="flex items-center gap-2 rounded border border-border bg-muted/30 px-2 py-1.5">
                        <div className="flex-1 min-w-0 text-xs">
                            {rootName ? (
                                <>
                                    <span className="text-muted-foreground">Media folder: </span>
                                    <span className="font-medium">{rootName}</span>
                                    {needsPermission && (
                                        <span className="text-amber-500"> · permission needed</span>
                                    )}
                                </>
                            ) : (
                                <span className="text-muted-foreground">
                                    {offlineSources.length} offline source
                                    {offlineSources.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                        {needsPermission && (
                            <Button size="xs" onClick={handleReconnect} disabled={busy}>
                                Reconnect
                            </Button>
                        )}
                        <Button size="xs" variant="outline" onClick={handleChooseFolder} disabled={busy}>
                            <FolderOpen className="w-3 h-3" /> Folder…
                        </Button>
                        <Button
                            size="xs"
                            variant="outline"
                            onClick={() => filesInputRef.current?.click()}
                            disabled={busy}
                        >
                            <Plus className="w-3 h-3" /> Files…
                        </Button>
                    </div>
                )}

                <div className="flex flex-col gap-1 max-h-80 overflow-y-auto -mx-1 px-1">
                    {sources.length === 0 && orphanedGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No sources in project</p>
                    ) : (
                        <>
                            {sources.map((source) => {
                                const offline = !source.file;
                                const count = clipCount(source.id, clipsByTrack);
                                const confirming = confirmId === source.id;
                                const match = offline ? matches.get(source.id) : undefined;
                                const showPicker = offline && candidates.length > 0;

                                return (
                                    <div
                                        key={source.id}
                                        className={`flex items-center gap-2 rounded px-2 py-1.5 ${
                                            offline ? 'bg-destructive/10' : 'bg-muted/30'
                                        }`}
                                    >
                                        <div className="relative w-14 aspect-video rounded overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                            {source.type === 'video' ? (
                                                source.thumbnailUrl && !offline ? (
                                                    <img
                                                        src={source.thumbnailUrl}
                                                        alt={source.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-muted/60" />
                                                )
                                            ) : (
                                                <AudioLines className="w-4 h-4 text-muted-foreground" />
                                            )}
                                            {offline && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-destructive/30">
                                                    <Link2Off className="w-4 h-4 text-destructive" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm truncate font-medium" title={source.name}>
                                                {source.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex gap-1.5">
                                                {offline ? (
                                                    match?.file ? (
                                                        <span className={CONFIDENCE_STYLE[match.confidence]}>
                                                            → {match.file.name} ({match.reason})
                                                        </span>
                                                    ) : (
                                                        <span className="text-destructive font-medium">
                                                            {candidates.length > 0 ? 'Not found' : 'Offline'}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-green-500">Online</span>
                                                )}
                                                {count > 0 && (
                                                    <span>· {count} clip{count !== 1 ? 's' : ''}</span>
                                                )}
                                            </div>
                                        </div>

                                        {confirming ? (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {count > 0
                                                        ? `Remove source? ${count} clip${count !== 1 ? 's' : ''} will be unlinked.`
                                                        : 'Remove source?'}
                                                </span>
                                                <Button
                                                    size="xs"
                                                    variant="outline"
                                                    onClick={() => setConfirmId(null)}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="xs"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(source.id)}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 shrink-0">
                                                {showPicker && (
                                                    <select
                                                        className="text-xs bg-muted border border-border rounded px-1 py-0.5 max-w-36"
                                                        value={
                                                            match?.file
                                                                ? String(
                                                                      candidates.findIndex(
                                                                          (c) => c.file === match.file,
                                                                      ),
                                                                  )
                                                                : ''
                                                        }
                                                        onChange={(e) =>
                                                            handleOverride(
                                                                source.id,
                                                                e.target.value === ''
                                                                    ? null
                                                                    : candidates[Number(e.target.value)],
                                                            )
                                                        }
                                                    >
                                                        <option value="">Not linked</option>
                                                        {match?.file && (
                                                            <option
                                                                value={candidates.findIndex(
                                                                    (c) => c.file === match.file,
                                                                )}
                                                            >
                                                                {match.file.name}
                                                            </option>
                                                        )}
                                                        {unclaimed.map((c) => (
                                                            <option
                                                                key={candidates.indexOf(c)}
                                                                value={candidates.indexOf(c)}
                                                            >
                                                                {c.relativePath ?? c.file.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                <Button
                                                    size="icon-xs"
                                                    variant={offline ? 'default' : 'ghost'}
                                                    title="Relink to file…"
                                                    onClick={() => handleRelinkClick(source.id)}
                                                >
                                                    <Link2 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="icon-xs"
                                                    variant="ghost"
                                                    title="Remove source"
                                                    onClick={() => setConfirmId(source.id)}
                                                >
                                                    <Trash2 className="w-3 h-3 text-destructive" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {orphanedGroups.length > 0 && (
                                <>
                                    {sources.length > 0 && (
                                        <div className="border-t border-border mt-1 pt-1">
                                            <p className="text-xs text-muted-foreground px-1 pb-1">Orphaned clips (source deleted)</p>
                                        </div>
                                    )}
                                    {orphanedGroups.map((group) => {
                                        const confirming = confirmOrphanId === group.sourceId;
                                        return (
                                            <div
                                                key={group.sourceId}
                                                className="flex items-center gap-2 rounded px-2 py-1.5 bg-red-950/30"
                                            >
                                                <div className="w-14 aspect-video rounded overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                                    <div className="w-full h-full bg-red-900/40" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm truncate font-medium text-red-300" title={group.name}>
                                                        {group.name}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        <span className="text-destructive font-medium">Deleted</span>
                                                        {' · '}
                                                        {group.count} clip{group.count !== 1 ? 's' : ''}
                                                    </div>
                                                </div>

                                                {confirming ? (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                            Delete {group.count} clip{group.count !== 1 ? 's' : ''}?
                                                        </span>
                                                        <Button size="xs" variant="outline" onClick={() => setConfirmOrphanId(null)}>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="destructive"
                                                            onClick={() => {
                                                                onDeleteOrphanedClips(group.sourceId);
                                                                setConfirmOrphanId(null);
                                                            }}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <select
                                                            className="text-xs bg-muted border border-border rounded px-1 py-0.5 max-w-28"
                                                            defaultValue=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    onRelinkClips(group.sourceId, e.target.value);
                                                                    e.target.value = '';
                                                                }
                                                            }}
                                                        >
                                                            <option value="">Relink to…</option>
                                                            {sources.map((s) => (
                                                                <option key={s.id} value={s.id}>
                                                                    {s.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <Button
                                                            size="icon-xs"
                                                            variant="ghost"
                                                            title="Delete orphaned clips"
                                                            onClick={() => setConfirmOrphanId(group.sourceId)}
                                                        >
                                                            <Trash2 className="w-3 h-3 text-destructive" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter showCloseButton>
                    {pending.length > 0 && (
                        <Button size="sm" onClick={handleApply} disabled={busy}>
                            Relink {pending.length}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
