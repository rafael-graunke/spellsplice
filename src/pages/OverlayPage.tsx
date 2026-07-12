import { useCallback, useEffect, useRef, useState } from 'react';
import {
    resolveOverlayWebsocketUrl,
    createDefaultLiveState,
    type LiveMessage,
    type LiveOverlayState,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { subscribeImageLoad } from '@/lib/cardCache';
import { renderLiveHand, getHandStackTopY } from '@/renders/renderLiveHand';
import { renderLiveAnnotations, type LiveAnnotationData } from '@/renders/renderLiveAnnotation';

const WIDTH = 1920;
const HEIGHT = 1080;
const ANNOTATION_HAND_GAP = 50;

function OverlayPage() {
    const [wsUrl] = useState(() => resolveOverlayWebsocketUrl(window.location.search));
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<LiveOverlayState>(createDefaultLiveState());
    const annotationsRef = useRef<Record<string, LiveAnnotationData>>({});

    useEffect(() => {
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
    }, []);

    const redraw = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        renderLiveHand(ctx, stateRef.current.left, stateRef.current.right, 0, 0, WIDTH, HEIGHT);
        renderLiveAnnotations(ctx, Object.values(annotationsRef.current), 0, WIDTH, {
            left: getHandStackTopY(stateRef.current.left, 0, HEIGHT) - ANNOTATION_HAND_GAP,
            right: getHandStackTopY(stateRef.current.right, 0, HEIGHT) - ANNOTATION_HAND_GAP,
        });
    }, []);

    const handleMessage = useCallback(
        (msg: LiveMessage) => {
            if (msg.type === 'live-state') {
                stateRef.current = msg.state;
                redraw();
            } else if (msg.type === 'annotation-state') {
                annotationsRef.current = {
                    ...annotationsRef.current,
                    [msg.annotationId]: { title: msg.title, left: msg.state.left, right: msg.state.right },
                };
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
