import { useCallback, useState } from 'react';
import { CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { buildOverlayUrl, loadLiveModeConfig, saveLiveModeConfig } from '@/lib/liveMode';

interface LiveModeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: () => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const TEST_TIMEOUT_MS = 5000;

function testWebsocket(url: string): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch {
            resolve(false);
            return;
        }
        const finish = (result: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            ws.onopen = null;
            ws.onerror = null;
            ws.close();
            resolve(result);
        };
        const timer = setTimeout(() => finish(false), TEST_TIMEOUT_MS);
        ws.onopen = () => finish(true);
        ws.onerror = () => finish(false);
    });
}

function LiveModeDialog({ open, onOpenChange, onStart }: LiveModeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && <LiveModeDialogContent onStart={onStart} />}
        </Dialog>
    );
}

function LiveModeDialogContent({ onStart }: { onStart: () => void }) {
    const [url, setUrl] = useState(() => loadLiveModeConfig()?.websocketUrl ?? '');
    const [status, setStatus] = useState<TestStatus>('idle');

    const handleUrlChange = useCallback((value: string) => {
        setUrl(value);
        setStatus('idle');
    }, []);

    const handleTest = useCallback(async () => {
        setStatus('testing');
        const ok = await testWebsocket(url);
        setStatus(ok ? 'success' : 'error');
    }, [url]);

    const handleStart = useCallback(async () => {
        setStatus('testing');
        const ok = await testWebsocket(url);
        if (ok) {
            saveLiveModeConfig({ websocketUrl: url });
            setStatus('success');
            onStart();
        } else {
            setStatus('error');
        }
    }, [url, onStart]);

    const busy = status === 'testing';

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Live Mode Configuration</DialogTitle>
                <DialogDescription>
                    Set the WebSocket URL used by Live Mode. This is shared with the overlay and does not
                    affect timeline projects.
                </DialogDescription>
            </DialogHeader>

            <Input
                placeholder="wss://example.com/socket"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                disabled={busy}
            />

            {url && (
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                        Paste this into OBS&apos;s Browser Source URL field (works without shared
                        localStorage):
                    </p>
                    <InputGroup>
                        <InputGroupInput readOnly value={buildOverlayUrl(url)} className="text-xs" />
                        <InputGroupAddon align="inline-end">
                            <InputGroupButton
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => navigator.clipboard.writeText(buildOverlayUrl(url))}
                            >
                                <Copy />
                            </InputGroupButton>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            )}

            {status !== 'idle' && (
                <div className="flex items-center gap-2 text-sm">
                    {status === 'testing' && (
                        <>
                            <Loader2 className="size-4 animate-spin text-yellow-500" />
                            <span className="text-yellow-500">Testing connection...</span>
                        </>
                    )}
                    {status === 'success' && (
                        <>
                            <CheckCircle2 className="size-4 text-green-500" />
                            <span className="text-green-500">Connected Successfully!</span>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <XCircle className="size-4 text-red-500" />
                            <span className="text-red-500">Connection failed</span>
                        </>
                    )}
                </div>
            )}

            <DialogFooter>
                <Button variant="outline" onClick={handleTest} disabled={busy || !url}>
                    Test Connection
                </Button>
                <Button onClick={handleStart} disabled={busy || !url}>
                    Start
                </Button>
            </DialogFooter>
        </DialogContent>
    );
}

export default LiveModeDialog;
