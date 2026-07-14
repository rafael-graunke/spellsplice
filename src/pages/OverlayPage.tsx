import { useCallback, useEffect, useRef, useState } from 'react';
import {
    resolveOverlayWebsocketUrl,
    resolveOverlayCardStripWidth,
    createDefaultLiveState,
    loadLiveTemplateState,
    saveLiveTemplateState,
    saveLiveModeConfig,
    type LiveMessage,
    type LiveOverlayState,
    type LiveDisplayCard,
    type LiveTemplateState,
    type LivePlayerInfo,
    type SingleTemplateConfig,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { subscribeImageLoad } from '@/lib/cardCache';
import { renderLiveHand, getHandStackTopY } from '@/renders/renderLiveHand';
import { renderLiveAnnotations, type LiveAnnotationData } from '@/renders/renderLiveAnnotation';
import { renderLiveCardDisplay } from '@/renders/renderLiveCardDisplay';
import { getLiveTemplateImage, renderLiveTemplate } from '@/renders/renderLiveTemplate';

function defaultPlayerInfo(): LivePlayerInfo {
    return { name: '', deckName: '', life: 20, wins: 0 };
}

const WIDTH = 1920;
const HEIGHT = 1080;
const ANNOTATION_HAND_GAP = 50;

function OverlayPage() {
    const [wsUrl] = useState(() => resolveOverlayWebsocketUrl(window.location.search));
    const stripWRef = useRef(resolveOverlayCardStripWidth(window.location.search));
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<LiveOverlayState>(createDefaultLiveState());
    const annotationsRef = useRef<Record<string, LiveAnnotationData>>({});
    const displayCardRef = useRef<{ left: LiveDisplayCard | null; right: LiveDisplayCard | null }>({
        left: null,
        right: null,
    });
    // Hydrated from localStorage (this page's own, OBS-isolated profile) so a
    // reload before the controller reconnects keeps the last known template
    // instead of resetting to an empty one.
    const templateRef = useRef<LiveTemplateState>(loadLiveTemplateState());
    const playerInfoRef = useRef<{ left: LivePlayerInfo; right: LivePlayerInfo }>({
        left: defaultPlayerInfo(),
        right: defaultPlayerInfo(),
    });
    const redrawRef = useRef<() => void>(() => {});

    useEffect(() => {
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
    }, []);

    const redraw = useCallback(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        const stripW = stripWRef.current;
        renderLiveCardDisplay(ctx, displayCardRef.current.left, displayCardRef.current.right, 0, 0, WIDTH, stripW);
        renderLiveHand(ctx, stateRef.current.left, stateRef.current.right, 0, 0, WIDTH, HEIGHT, stripW);
        renderLiveAnnotations(
            ctx,
            Object.values(annotationsRef.current),
            0,
            WIDTH,
            {
                left: getHandStackTopY(stateRef.current.left, 0, HEIGHT, stripW) - ANNOTATION_HAND_GAP,
                right: getHandStackTopY(stateRef.current.right, 0, HEIGHT, stripW) - ANNOTATION_HAND_GAP,
            },
            stripW,
        );

        const drawTemplate = (slot: string, config: SingleTemplateConfig) => {
            if (!config.svg) return;
            const img = getLiveTemplateImage(
                slot,
                config.svg,
                config.fieldMappings,
                playerInfoRef.current.left,
                playerInfoRef.current.right,
                () => redrawRef.current(),
            );
            if (img) renderLiveTemplate(ctx, img, config.anchor, config.scale, config.margins, WIDTH, HEIGHT);
        };
        const template = templateRef.current;
        if (template.mode === 'shared') {
            drawTemplate('shared', template.shared);
        } else {
            drawTemplate('left', template.left);
            drawTemplate('right', template.right);
        }
    }, []);
    useEffect(() => {
        redrawRef.current = redraw;
    });
    // Paint immediately on mount using the locally-seeded template/state refs
    // (see templateRef above) - otherwise the canvas stays blank until the
    // first socket message arrives, even though a default is already loaded.
    useEffect(() => {
        redraw();
    }, [redraw]);

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
            } else if (msg.type === 'card-display-state') {
                displayCardRef.current = { left: msg.left, right: msg.right };
                redraw();
            } else if (msg.type === 'config-state') {
                stripWRef.current = msg.cardStripWidth;
                if (wsUrl) saveLiveModeConfig({ websocketUrl: wsUrl, cardStripWidth: msg.cardStripWidth });
                redraw();
            } else if (msg.type === 'template-state') {
                templateRef.current = msg.template;
                saveLiveTemplateState(msg.template);
                redraw();
            } else if (msg.type === 'player-info-state') {
                playerInfoRef.current = { left: msg.left, right: msg.right };
                redraw();
            }
        },
        [redraw, wsUrl],
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
