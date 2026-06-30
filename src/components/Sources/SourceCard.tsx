import { useRef, useState } from 'react';
import { AudioLines, Link2, Link2Off, Trash2 } from 'lucide-react';
import type { MediaSource } from '../types/source';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface SourceCardProps {
    source: MediaSource;
    clipCount?: number;
    onRelink?: (file: File) => void;
    onDelete?: () => void;
}

export function SourceCard({ source, clipCount, onRelink, onDelete }: SourceCardProps) {
    const loading = source.loading;
    const offline = !source.file && !loading;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const card = (
        <div
            className={`flex flex-col rounded overflow-hidden border text-xs ${
                offline
                    ? 'border-destructive/50 bg-destructive/10 cursor-not-allowed opacity-70'
                    : loading
                      ? 'border-border bg-muted/30 cursor-not-allowed opacity-60'
                      : 'border-border bg-muted/30 cursor-grab active:cursor-grabbing'
            }`}
            draggable={!loading && !offline}
            onDragStart={loading || offline ? undefined : (e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData(
                    'application/x-spellsplice-source',
                    JSON.stringify({ sourceId: source.id, sourceType: source.type }),
                );
            }}
        >
            <div className="relative w-full aspect-video bg-muted flex items-center justify-center">
                {source.type === 'video' ? (
                    source.thumbnailUrl && !offline ? (
                        <img
                            src={source.thumbnailUrl}
                            alt={source.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full bg-muted animate-pulse" />
                    )
                ) : (
                    <AudioLines className="w-6 h-6 text-muted-foreground" />
                )}
                {offline && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Link2Off className="w-5 h-5 text-destructive" />
                    </div>
                )}
                <span className="absolute bottom-1 right-1 bg-black/70 text-white rounded px-1 leading-none py-0.5">
                    {formatDuration(source.duration)}
                </span>
                {clipCount !== undefined && clipCount > 0 && (
                    <span className="absolute top-1 left-1 bg-black/70 text-white rounded px-1 leading-none py-0.5">
                        {clipCount}
                    </span>
                )}
            </div>
            <div className="px-1.5 py-1 truncate text-foreground/80" title={source.name}>
                {source.name}
            </div>
        </div>
    );

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>{card}</ContextMenuTrigger>
                <ContextMenuContent>
                    {onRelink && (
                        <ContextMenuItem
                            disabled={!offline}
                            onSelect={() => fileInputRef.current?.click()}
                        >
                            <Link2 />
                            Relink…
                        </ContextMenuItem>
                    )}
                    {onRelink && onDelete && <ContextMenuSeparator />}
                    {onDelete && (
                        <ContextMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                            <Trash2 />
                            Delete
                        </ContextMenuItem>
                    )}
                </ContextMenuContent>
            </ContextMenu>

            {onRelink && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onRelink(file);
                        e.target.value = '';
                    }}
                />
            )}

            {onDelete && (
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogContent showCloseButton>
                        <DialogHeader>
                            <DialogTitle>Delete source?</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            {clipCount && clipCount > 0
                                ? `"${source.name}" is used by ${clipCount} clip${clipCount !== 1 ? 's' : ''}. Deleting it will orphan those clips.`
                                : `Remove "${source.name}" from the project?`}
                        </p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => {
                                    onDelete();
                                    setDeleteOpen(false);
                                }}
                            >
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
