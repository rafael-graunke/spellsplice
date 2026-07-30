import { useCallback, useState } from 'react';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    Copy,
    Loader2,
    XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    buildOverlayUrl,
    isMixedContentWs,
    isValidWsUrl,
    loadLiveModeConfig,
    saveLiveModeConfig,
} from '@/lib/liveMode';

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

function ConnectionSection({
    url,
    onUrlChange,
    cardStripWidth,
    onStart,
}: Props) {
    const [status, setStatus] = useState<TestStatus>('idle');
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(buildOverlayUrl(url, cardStripWidth));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [url, cardStripWidth]);

    const handleUrlChange = useCallback(
        (value: string) => {
            onUrlChange(value);
            setStatus('idle');
        },
        [onUrlChange]
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
    const mixedContent = isMixedContentWs(url);
    const invalidUrl = url.length > 0 && !isValidWsUrl(url);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Connection</h2>
                <div className="flex flex-col gap-4">
                    <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm space-y-2">
                        <div className="flex items-center gap-2 font-medium text-yellow-600 dark:text-yellow-500">
                            <AlertTriangle className="size-4" />
                            Heads up!
                        </div>
                        <p className="text-muted-foreground">
                            Spellsplice Live Mode needs a WebSocket server
                            running locally. Unless you connect over{' '}
                            <code className="font-mono">wss://</code>, make sure
                            this browser, OBS, and the server all run on the
                            same machine and connect through a loopback address
                            (<code className="font-mono">127.0.0.1</code> or{' '}
                            <code className="font-mono">localhost</code>). Any
                            other connection will downgrade this browser&apos;s
                            secure connection.
                        </p>
                        <p className="text-muted-foreground">
                            You can download the local WebSocket server for
                            Spellsplice by{' '}
                            <a
                                href="/spellsplice-relay.py"
                                download
                                className="font-medium text-yellow-600 underline dark:text-yellow-500"
                            >
                                clicking here
                            </a>{' '}
                            (requires Python 3 installed).
                        </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="live-ws-url"
                            className="text-sm font-medium"
                        >
                            WebSocket URL
                        </label>
                        <Input
                            id="live-ws-url"
                            placeholder="wss://example.com/socket"
                            value={url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            disabled={busy}
                            aria-invalid={invalidUrl}
                            className={cn(
                                invalidUrl &&
                                    'border-destructive focus-visible:ring-destructive/40'
                            )}
                        />
                        {invalidUrl && (
                            <p className="text-xs text-destructive">
                                Enter a valid{' '}
                                <code className="font-mono">ws://</code> or{' '}
                                <code className="font-mono">wss://</code> URL.
                            </p>
                        )}
                    </div>

                    {mixedContent && (
                        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs space-y-1.5">
                            <div className="flex items-center gap-1.5 font-medium text-yellow-600 dark:text-yellow-500">
                                <AlertTriangle className="size-3.5" />
                                Insecure connection blocked
                            </div>
                            <p className="text-muted-foreground">
                                This page is served over HTTPS, so it can&apos;t
                                reach a plaintext{' '}
                                <code className="font-mono">ws://</code> address
                                on a LAN IP. The browser flags the page as
                                &quot;Not secure&quot; and blocks the
                                connection.
                            </p>
                            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
                                <li>
                                    Same machine as OBS? Use{' '}
                                    <code className="font-mono">
                                        ws://localhost:8765
                                    </code>{' '}
                                    instead.
                                </li>
                                <li>
                                    Two machines? Expose the relay over a{' '}
                                    <code className="font-mono">wss://</code>{' '}
                                    tunnel (e.g. cloudflared / ngrok) and paste
                                    that URL.
                                </li>
                            </ul>
                        </div>
                    )}

                    {url && !mixedContent && !invalidUrl && (
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                                Paste this into OBS&apos;s Browser Source URL
                                field:
                            </p>
                            <div className="relative rounded-md border bg-muted/60 dark:bg-black/40 py-2.5 pl-3 pr-10">
                                <code className="block font-mono text-xs text-foreground break-all select-all leading-relaxed">
                                    {buildOverlayUrl(url, cardStripWidth)}
                                </code>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 size-7 cursor-pointer"
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <Check className="size-3.5 text-green-500" />
                                    ) : (
                                        <Copy className="size-3.5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-row justify-between items-center w-full gap-2">
                        {status !== 'idle' && (
                            <div className="flex items-center gap-2 text-sm">
                                {status === 'testing' && (
                                    <>
                                        <Loader2 className="size-4 animate-spin text-yellow-500" />
                                        <span className="text-yellow-500">
                                            Testing connection...
                                        </span>
                                    </>
                                )}
                                {status === 'success' && (
                                    <>
                                        <CheckCircle2 className="size-4 text-green-500" />
                                        <span className="text-green-500">
                                            Connected Successfully!
                                        </span>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <XCircle className="size-4 text-red-500" />
                                        <span className="text-red-500">
                                            Connection failed
                                        </span>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 ml-auto">
                            <Button
                                variant="outline"
                                onClick={handleTest}
                                disabled={
                                    busy || !url || mixedContent || invalidUrl
                                }
                            >
                                Test Connection
                            </Button>
                            <Button
                                onClick={handleStart}
                                disabled={
                                    busy || !url || mixedContent || invalidUrl
                                }
                            >
                                Start
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ConnectionSection;
