import { useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { VideoState } from '@/components/types/video';
import type { Player } from '@/components/types/player';
import { exportVideo, type ExportProgress } from '@/lib/videoExport';

interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    video: VideoState | null;
    players: Player[];
}

type Status = 'idle' | 'running' | 'done' | 'error';

function formatEta(seconds: number): string {
    if (seconds <= 0 || !isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function phaseLabel(p: ExportProgress): string {
    switch (p.phase) {
        case 'loading': return 'Loading encoder…';
        case 'audio': return 'Extracting audio…';
        case 'frames': return `Frame ${p.currentFrame.toLocaleString()} / ${p.totalFrames.toLocaleString()}  —  ETA ${formatEta(p.eta)}`;
    }
}

export function ExportDialog({ open, onClose, video, players }: ExportDialogProps) {
    const [status, setStatus] = useState<Status>('idle');
    const [progress, setProgress] = useState<ExportProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState(60);
    const abortRef = useRef<AbortController | null>(null);

    const pct = progress && progress.totalFrames > 0
        ? (progress.currentFrame / progress.totalFrames) * 100
        : 0;

    const handleClose = () => {
        if (status === 'running') return;
        setStatus('idle');
        setProgress(null);
        setError(null);
        onClose();
    };

    const startExport = async () => {
        if (!video) return;
        const abort = new AbortController();
        abortRef.current = abort;
        setStatus('running');
        setProgress(null);
        setError(null);
        try {
            await exportVideo(video, players, setProgress, abort.signal, { fps });
            setStatus('done');
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                setStatus('idle');
                setProgress(null);
            } else {
                setError(err instanceof Error ? err.message : String(err));
                setStatus('error');
            }
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}
        >
            <DialogContent showCloseButton={status !== 'running'}>
                <DialogHeader>
                    <DialogTitle>Export Video</DialogTitle>
                    {status === 'idle' && (
                        <DialogDescription>
                            Renders all overlays and exports as MP4 or WebM.
                        </DialogDescription>
                    )}
                </DialogHeader>

                {status === 'idle' && (
                    <>
                        <div className="flex flex-col gap-4 py-2">
                            <label className="flex flex-col gap-1 text-sm">
                                Frame rate
                                <select
                                    value={fps}
                                    onChange={(e) => setFps(Number(e.target.value))}
                                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                >
                                    <option value={60}>60 fps</option>
                                    <option value={30}>30 fps</option>
                                </select>
                            </label>
                            </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>Cancel</Button>
                            <Button onClick={startExport} disabled={!video}>
                                Export
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {status === 'running' && (
                    <>
                        <div className="flex flex-col gap-3 py-2">
                            <p className="text-sm text-muted-foreground">
                                {progress ? phaseLabel(progress) : 'Starting…'}
                            </p>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-150"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            {progress && progress.rate > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {progress.rate.toFixed(1)} fps encode rate
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                        </DialogFooter>
                    </>
                )}

                {status === 'done' && (
                    <>
                        <p className="py-2 text-sm text-muted-foreground">
                            Export complete — file saved.
                        </p>
                        <DialogFooter>
                            <Button onClick={handleClose}>Close</Button>
                        </DialogFooter>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="py-2 flex flex-col gap-2">
                            <p className="text-sm text-destructive">
                                Export failed: {error}
                            </p>
                            {error?.includes('encoder') && (
                                <p className="text-xs text-muted-foreground">
                                    Try Chrome on a recent OS (Linux, macOS, or Windows).
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>Close</Button>
                            <Button onClick={startExport}>Retry</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
