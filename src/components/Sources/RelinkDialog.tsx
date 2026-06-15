import { useRef, useState } from 'react';
import { AudioLines, Link2, Trash2 } from 'lucide-react';
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
}: RelinkDialogProps) {
    const [confirmId, setConfirmId] = useState<string | null>(null);
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
                    {sources.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No sources in project</p>
                    ) : (
                        sources.map((source) => {
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
                                    <div className="w-14 aspect-video rounded overflow-hidden shrink-0 bg-muted flex items-center justify-center">
                                        {source.type === 'video' ? (
                                            source.thumbnailUrl ? (
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
                                                    ? `Delete ${count} clip${count !== 1 ? 's' : ''}?`
                                                    : 'Delete source?'}
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
                                                Delete
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
                                                title="Delete source"
                                                onClick={() => setConfirmId(source.id)}
                                            >
                                                <Trash2 className="w-3 h-3 text-destructive" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <DialogFooter showCloseButton />
            </DialogContent>
        </Dialog>
    );
}
