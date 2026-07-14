import { useCallback, useState } from 'react';
import { CheckCircle2, Copy, Download, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { buildOverlayUrl, loadLiveModeConfig, saveLiveModeConfig } from '@/lib/liveMode';

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

interface Props {
    url: string;
    onUrlChange: (url: string) => void;
    cardStripWidth: number;
    onStart: () => void;
}

function ConnectionSection({ url, onUrlChange, cardStripWidth, onStart }: Props) {
    const [status, setStatus] = useState<TestStatus>('idle');

    const handleUrlChange = useCallback(
        (value: string) => {
            onUrlChange(value);
            setStatus('idle');
        },
        [onUrlChange],
    );

    const handleTest = useCallback(async () => {
        setStatus('testing');
        const ok = await testWebsocket(url);
        setStatus(ok ? 'success' : 'error');
    }, [url]);

    const handleStart = useCallback(async () => {
        setStatus('testing');
        const ok = await testWebsocket(url);
        if (ok) {
            saveLiveModeConfig({ ...loadLiveModeConfig(), websocketUrl: url });
            setStatus('success');
            onStart();
        } else {
            setStatus('error');
        }
    }, [url, onStart]);

    const busy = status === 'testing';

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Connection</h2>
                <div className="flex flex-col gap-4">
                    <div className="rounded-md border p-3 bg-muted/40 text-xs text-muted-foreground space-y-1.5">
                        <p>
                            Need a relay server? Download the script below, run{' '}
                            <code className="font-mono">python3 spellsplice-relay.py</code>, then point the field
                            below at <code className="font-mono">ws://localhost:8765</code> (use your LAN IP
                            instead of <code className="font-mono">localhost</code> if OBS is on another machine).
                        </p>
                        <a
                            href="/spellsplice-relay.py"
                            download
                            className="inline-flex items-center gap-1.5 text-foreground hover:underline"
                        >
                            <Download className="size-3.5" />
                            Download relay script (.py, requires Python 3)
                        </a>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="live-ws-url" className="text-sm font-medium">WebSocket URL</label>
                        <Input
                            id="live-ws-url"
                            placeholder="wss://example.com/socket"
                            value={url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    {url && (
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                                Paste this into OBS&apos;s Browser Source URL field (works without shared
                                localStorage):
                            </p>
                            <InputGroup>
                                <InputGroupInput
                                    readOnly
                                    value={buildOverlayUrl(url, cardStripWidth)}
                                    className="text-xs"
                                />
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                            navigator.clipboard.writeText(buildOverlayUrl(url, cardStripWidth))
                                        }
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

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleTest} disabled={busy || !url}>
                            Test Connection
                        </Button>
                        <Button onClick={handleStart} disabled={busy || !url}>
                            Start
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConnectionSection;
