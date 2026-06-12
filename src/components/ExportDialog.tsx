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
import type { Clip } from '@/components/types/clip';
import type { MediaSource } from '@/components/types/source';
import type { Player } from '@/components/types/player';
import { exportVideo, type ExportProgress } from '@/lib/export';

interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    videoClips: Clip[];
    audioClips: Clip[];
    sources: MediaSource[];
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

const canExport = 'showSaveFilePicker' in window;

export function ExportDialog({ open, onClose, videoClips, audioClips, sources, players }: ExportDialogProps) {
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
        if (videoClips.length === 0) return;
        const abort = new AbortController();
        abortRef.current = abort;
        setStatus('running');
        setProgress(null);
        setError(null);
        try {
            await exportVideo(videoClips, audioClips, sources, players, setProgress, abort.signal, { fps });
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

    const noClips = videoClips.length === 0;

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
                            <span className="group relative">
                                <Button onClick={startExport} disabled={noClips || !canExport}>
                                    Export
                                </Button>
                                {!canExport && (
                                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        Video export requires Chrome or Edge. Save your project and open it there.
                                    </span>
                                )}
                                {canExport && noClips && (
                                    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                                        Add video clips to the timeline before exporting.
                                    </span>
                                )}
                            </span>
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
