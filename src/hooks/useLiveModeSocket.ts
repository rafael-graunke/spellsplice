import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveMessage } from '@/lib/liveMode';
import { isMixedContentWs, isValidWsUrl } from '@/lib/liveMode';

export type LiveSocketStatus = 'connecting' | 'open' | 'closed';

const BACKOFF_STEPS_MS = [1000, 2000, 5000];

// Max characters per websocket frame. Many ws relays silently drop (or close on)
// frames over a cap - a large scoreboard SVG (embedded rasters can run into the
// megabytes) blows past it. Anything larger is split into chunk frames and
// reassembled by the receiver. Kept well under common 64KB/1MB caps, with margin
// for multi-byte chars pushing the byte size above the char count.
const CHUNK_SIZE = 32 * 1024;

// Envelope for one piece of a chunked message. `id` groups pieces of one
// message; `i`/`n` are this piece's index and the total count. The reserved
// `__ssChunk` key distinguishes it from a real LiveMessage.
interface ChunkFrame {
    __ssChunk: string;
    i: number;
    n: number;
    data: string;
}

function isChunkFrame(value: unknown): value is ChunkFrame {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__ssChunk' in value &&
        typeof (value as ChunkFrame).__ssChunk === 'string'
    );
}

export function useLiveModeSocket(url: string | null, onMessage: (msg: LiveMessage) => void) {
    const [status, setStatus] = useState<LiveSocketStatus>('closed');
    const wsRef = useRef<WebSocket | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    // Per-connection prefix so chunk ids never collide with another sender's on
    // the shared relay (each peer numbers its own messages from 0).
    const senderIdRef = useRef<string>('');
    if (senderIdRef.current === '') {
        senderIdRef.current =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `s${Math.floor(performance.now())}`;
    }
    const chunkSeqRef = useRef(0);
    // Reassembly buffers keyed by chunk id, holding partial messages until every
    // piece arrives.
    const inboxRef = useRef<
        Map<string, { parts: string[]; got: number; total: number }>
    >(new Map());

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
                // Drop any half-collected chunks from a prior connection: their
                // remaining pieces will never arrive on this new socket.
                inboxRef.current.clear();
                setStatus('open');
            };
            ws.onmessage = (e) => {
                let parsed: unknown;
                try {
                    parsed = JSON.parse(e.data);
                } catch {
                    // ignore malformed messages
                    return;
                }
                if (isChunkFrame(parsed)) {
                    handleChunk(parsed);
                    return;
                }
                onMessageRef.current(parsed as LiveMessage);
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

        const handleChunk = (frame: ChunkFrame) => {
            const inbox = inboxRef.current;
            let entry = inbox.get(frame.__ssChunk);
            if (!entry) {
                entry = { parts: new Array(frame.n), got: 0, total: frame.n };
                inbox.set(frame.__ssChunk, entry);
            }
            if (entry.parts[frame.i] === undefined) {
                entry.parts[frame.i] = frame.data;
                entry.got++;
            }
            if (entry.got === entry.total) {
                inbox.delete(frame.__ssChunk);
                try {
                    const msg = JSON.parse(entry.parts.join('')) as LiveMessage;
                    onMessageRef.current(msg);
                } catch {
                    // ignore malformed reassembled message
                }
            }
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
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const str = JSON.stringify(msg);
        if (str.length <= CHUNK_SIZE) {
            ws.send(str);
            return;
        }
        // Oversized: split into chunk frames the receiver reassembles. Frames
        // ride the same ordered connection, so no sequencing beyond the index.
        const id = `${senderIdRef.current}:${chunkSeqRef.current++}`;
        const total = Math.ceil(str.length / CHUNK_SIZE);
        for (let i = 0; i < total; i++) {
            const frame: ChunkFrame = {
                __ssChunk: id,
                i,
                n: total,
                data: str.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
            };
            ws.send(JSON.stringify(frame));
        }
    }, []);

    return { send, status };
}
