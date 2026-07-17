import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveMessage } from '@/lib/liveMode';

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

        let cancelled = false;
        let attempt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;

        const connect = () => {
            if (cancelled) return;
            setStatus('connecting');
            const ws = new WebSocket(url);
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
