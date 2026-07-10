import { useCallback, useEffect, useRef, useState } from 'react';
import {
    resolveOverlayWebsocketUrl,
    createDefaultLiveState,
    type LiveMessage,
    type LiveOverlayState,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { subscribeImageLoad } from '@/lib/cardCache';
import { renderLiveHand } from '@/renders/renderLiveHand';

const WIDTH = 1920;
const HEIGHT = 1080;

function OverlayPage() {
    const [wsUrl] = useState(() => resolveOverlayWebsocketUrl(window.location.search));
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<LiveOverlayState>(createDefaultLiveState());

    useEffect(() => {
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
    }, []);

    const redraw = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        renderLiveHand(ctx, stateRef.current.left, stateRef.current.right, 0, 0, WIDTH, HEIGHT);
    }, []);

    const handleMessage = useCallback(
        (msg: LiveMessage) => {
            if (msg.type === 'live-state') {
                stateRef.current = msg.state;
                redraw();
            }
        },
        [redraw],
    );

    const { send, status } = useLiveModeSocket(wsUrl, handleMessage);

    useEffect(() => {
        if (status === 'open') send({ type: 'request-state' });
    }, [status, send]);

    useEffect(() => subscribeImageLoad(redraw), [redraw]);

    if (!wsUrl) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-foreground">
                <p className="text-muted-foreground">Live Mode not configured</p>
            </div>
        );
    }

    return (
        <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            style={{ width: '100vw', height: '100vh', display: 'block' }}
        />
    );
}

export default OverlayPage;
