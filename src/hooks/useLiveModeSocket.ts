import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveMessage } from '@/lib/liveMode';
import { isMixedContentWs, isValidWsUrl } from '@/lib/liveMode';

export type LiveSocketStatus = 'connecting' | 'open' | 'closed';

const BACKOFF_STEPS_MS = [1000, 2000, 5000];

export function useLiveModeSocket(url: string | null, onMessage: (msg: LiveMessage) => void) {
    const [status, setStatus] = useState<LiveSocketStatus>('closed');
    const wsRef = useRef<WebSocket | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    useEffect(() => {
        if (!url) {
            setStatus('closed');
            return;
        }

        // Only connect on a well-formed absolute ws://|wss:// URL. A relative or
        // half-typed value (e.g. "foo") does NOT throw - WebSocket resolves it
        // against the page origin (ws://localhost:5173/foo) and fires a real
        // connection attempt on every keystroke. Bail instead.
        if (!isValidWsUrl(url)) {
            setStatus('closed');
            return;
        }

        // Never auto-attempt a plaintext ws:// to a non-loopback host from an
        // https page: the request is blocked/deprecated as mixed content and
        // downgrades the whole document's security indicator to "Not secure".
        if (isMixedContentWs(url)) {
            setStatus('closed');
            return;
        }

        let cancelled = false;
        let attempt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            if (cancelled) return;
            setStatus('connecting');
            let ws: WebSocket;
            try {
                ws = new WebSocket(url);
            } catch {
                // Malformed URL (e.g. a half-typed value) throws synchronously;
                // stay closed rather than crashing. A new url re-runs the effect.
                setStatus('closed');
                return;
            }
            wsRef.current = ws;

            ws.onopen = () => {
                attempt = 0;
                setStatus('open');
            };
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data) as LiveMessage;
                    onMessageRef.current(msg);
                } catch {
                    // ignore malformed messages
                }
            };
            ws.onclose = () => {
                setStatus('closed');
                if (cancelled) return;
                const delay = BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
                attempt++;
                retryTimer = setTimeout(connect, delay);
            };
            ws.onerror = () => {
                ws.close();
            };
        };

        connect();

        return () => {
            cancelled = true;
            clearTimeout(retryTimer);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [url]);

    const send = useCallback((msg: LiveMessage) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
        }
    }, []);

    return { send, status };
}
