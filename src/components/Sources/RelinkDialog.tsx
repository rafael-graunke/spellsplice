import { useRef, useState, useMemo } from 'react';
import { AudioLines, Link2, Link2Off, Trash2 } from 'lucide-react';
import type { MediaSource } from '../types/source';
import type { Clip } from '../types/clip';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface RelinkDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sources: MediaSource[];
    clipsByTrack: Record<string, Clip[]>;
    onRelink: (sourceId: string, file: File) => void;
    onDelete: (sourceId: string) => void;
    onRelinkClips: (oldSourceId: string, newSourceId: string) => void;
    onDeleteOrphanedClips: (sourceId: string) => void;
    deletedSourceNames: Record<string, string>;
}

function clipCount(sourceId: string, clipsByTrack: Record<string, Clip[]>): number {
    return Object.values(clipsByTrack)
        .flat()
        .filter((c) => c.sourceId === sourceId).length;
}

export function RelinkDialog({
    open,
    onOpenChange,
    sources,
    clipsByTrack,
    onRelink,
    onDelete,
    onRelinkClips,
    onDeleteOrphanedClips,
    deletedSourceNames,
}: RelinkDialogProps) {
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [confirmOrphanId, setConfirmOrphanId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pendingRelinkId = useRef<string | null>(null);

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
            <DialogContent className="sm:max-w-lg" showCloseButton>
                <DialogHeader>
                    <DialogTitle>Manage Sources</DialogTitle>
                </DialogHeader>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div className="flex flex-col gap-1 max-h-80 overflow-y-auto -mx-1 px-1">
                    {sources.length === 0 && orphanedGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No sources in project</p>
                    ) : (
                        <>
                            {sources.map((source) => {
                                const offline = !source.file;
                                const count = clipCount(source.id, clipsByTrack);
                                const confirming = confirmId === source.id;

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
                                                    <span className="text-destructive font-medium">Offline</span>
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

                <DialogFooter showCloseButton />
            </DialogContent>
        </Dialog>
    );
}
