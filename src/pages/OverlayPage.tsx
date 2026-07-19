import { useCallback, useEffect, useRef, useState } from 'react';
import {
    resolveOverlayWebsocketUrl,
    resolveOverlayCardStripWidth,
    createDefaultLiveState,
    loadLiveScoreboardState,
    saveLiveScoreboardState,
    saveLiveModeConfig,
    loadLiveCardDisplayConfig,
    saveLiveCardDisplayConfig,
    loadLiveHandStackConfig,
    saveLiveHandStackConfig,
    type LiveMessage,
    type LiveOverlayState,
    type LiveDisplayCard,
    type LiveScoreboardState,
    type LiveCardDisplayConfig,
    type LiveHandStackConfig,
    type LivePlayerInfo,
    type SingleScoreboardConfig,
} from '@/lib/liveMode';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { subscribeImageLoad, preloadCardImageData } from '@/lib/cardCache';
import {
    renderLiveHand,
    getHandStackTopY,
    HAND_ANIM_DURATION,
    type HandAnim,
} from '@/renders/renderLiveHand';
import {
    renderLiveAnnotations,
    ANNOTATION_ANIM_DURATION,
    type LiveAnnotationData,
    type AnnotationAnim,
} from '@/renders/renderLiveAnnotation';
import {
    renderLiveCardDisplay,
    type DisplayAnim,
} from '@/renders/renderLiveCardDisplay';
import {
    getLiveScoreboardImage,
    renderLiveScoreboard,
} from '@/renders/renderLiveScoreboard';
import { OverlayPresenter } from '@/renders/overlayPresenter';

function defaultPlayerInfo(): LivePlayerInfo {
    return { name: '', deckName: '', life: 20, wins: 0 };
}

const WIDTH = 1920;
const HEIGHT = 1080;
const ANNOTATION_HAND_GAP = 50;

function OverlayPage() {
    const [wsUrl] = useState(() =>
        resolveOverlayWebsocketUrl(window.location.search)
    );
    // ?fps=1 draws a live rAF frame-rate meter and runs a continuous redraw
    // loop, so the actual callback rate CEF gives inside OBS (vs a real browser)
    // can be read directly. Off by default - zero cost.
    const [fpsDebug] = useState(
        () => new URLSearchParams(window.location.search).get('fps') === '1'
    );
    const fpsRef = useRef({ frames: 0, last: 0, value: 0 });
    const stripWRef = useRef(
        resolveOverlayCardStripWidth(window.location.search)
    );
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const stateRef = useRef<LiveOverlayState>(createDefaultLiveState());
    const annotationsRef = useRef<Record<string, LiveAnnotationData>>({});
    const displayCardRef = useRef<{
        left: LiveDisplayCard | null;
        right: LiveDisplayCard | null;
    }>({
        left: null,
        right: null,
    });
    // Hydrated from localStorage (this page's own, OBS-isolated profile) so a
    // reload before the controller reconnects keeps the last known scoreboard
    // instead of resetting to an empty one.
    const scoreboardRef = useRef<LiveScoreboardState>(
        loadLiveScoreboardState()
    );
    // Seeded from this page's own localStorage so placement is correct on the
    // very first paint, before the controller sends 'card-display-config'.
    const cardDisplayConfigRef = useRef<LiveCardDisplayConfig>(
        loadLiveCardDisplayConfig()
    );
    // Per-side hand stack placement/sizing, seeded from this page's own
    // localStorage so the very first paint is placed correctly before the
    // controller sends 'hand-stack-config'.
    const handStackConfigRef = useRef<LiveHandStackConfig>(
        loadLiveHandStackConfig()
    );
    const playerInfoRef = useRef<{
        left: LivePlayerInfo;
        right: LivePlayerInfo;
    }>({
        left: defaultPlayerInfo(),
        right: defaultPlayerInfo(),
    });
    const redrawRef = useRef<() => void>(() => {});
    // Active hand card animations, keyed by card instance id. Populated by
    // 'live-event' messages; drained by the rAF loop once each anim elapses.
    const handAnimRef = useRef<Map<string, HandAnim>>(new Map());
    // Active annotation card animations, keyed by card instance id. Populated by
    // 'live-event' messages (ANNOTATE_CARD / UNANNOTATE_CARD); drained by the
    // rAF loop once each anim elapses.
    const annotationAnimRef = useRef<Map<string, AnnotationAnim>>(new Map());
    // Per-side enter/exit animation for the featured display card.
    const displayAnimRef = useRef<{
        left: DisplayAnim | null;
        right: DisplayAnim | null;
    }>({ left: null, right: null });
    // Pending enter to start once the current exit finishes: a replace slides
    // the old card out, then queues the new card's slide-in.
    const displayAnimQueueRef = useRef<{
        left: DisplayAnim | null;
        right: DisplayAnim | null;
    }>({ left: null, right: null });
    const rafRef = useRef<number | null>(null);
    // Overlay content is rasterized on this 2D offscreen canvas, then presented
    // to the visible WebGL canvas via OverlayPresenter (GPU). Falls back to a
    // plain 2D blit if WebGL is unavailable.
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const presenterRef = useRef<OverlayPresenter | null>(null);
    const webglFailedRef = useRef(false);

    useEffect(() => {
        document.documentElement.style.background = 'transparent';
        document.body.style.background = 'transparent';
    }, []);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let overlay = overlayCanvasRef.current;
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.width = WIDTH;
            overlay.height = HEIGHT;
            overlayCanvasRef.current = overlay;
        }
        const ctx = overlay.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        const stripW = stripWRef.current;
        renderLiveCardDisplay(
            ctx,
            displayCardRef.current.left,
            displayCardRef.current.right,
            0,
            0,
            WIDTH,
            HEIGHT,
            stripW,
            cardDisplayConfigRef.current,
            displayAnimRef.current,
            performance.now()
        );
        const handStack = handStackConfigRef.current;
        renderLiveHand(
            ctx,
            stateRef.current.left,
            stateRef.current.right,
            0,
            0,
            WIDTH,
            HEIGHT,
            handStack,
            handAnimRef.current,
            performance.now()
        );
        renderLiveAnnotations(
            ctx,
            annotationsRef.current,
            0,
            WIDTH,
            {
                left:
                    getHandStackTopY(
                        stateRef.current.left,
                        handStack.left,
                        0,
                        HEIGHT
                    ) - ANNOTATION_HAND_GAP,
                right:
                    getHandStackTopY(
                        stateRef.current.right,
                        handStack.right,
                        0,
                        HEIGHT
                    ) - ANNOTATION_HAND_GAP,
            },
            {
                left: handStack.left.cardStripWidth,
                right: handStack.right.cardStripWidth,
            },
            annotationAnimRef.current,
            performance.now()
        );

        const drawScoreboard = (
            slot: string,
            config: SingleScoreboardConfig
        ) => {
            if (!config.svg) return;
            const img = getLiveScoreboardImage(
                slot,
                config.svg,
                config.fieldMappings,
                playerInfoRef.current.left,
                playerInfoRef.current.right,
                () => redrawRef.current()
            );
            if (img)
                renderLiveScoreboard(
                    ctx,
                    img,
                    config.anchor,
                    config.scale,
                    config.offset,
                    WIDTH,
                    HEIGHT
                );
        };
        const scoreboard = scoreboardRef.current;
        if (scoreboard.mode === 'shared') {
            drawScoreboard('shared', scoreboard.shared);
        } else {
            drawScoreboard('left', scoreboard.left);
            drawScoreboard('right', scoreboard.right);
        }

        if (fpsDebug) {
            ctx.save();
            ctx.font = 'bold 48px monospace';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#00ff00';
            ctx.fillText(`${Math.round(fpsRef.current.value)} fps`, 24, 24);
            ctx.restore();
        }

        // Present the rasterized overlay: GPU quad when WebGL is available,
        // else a plain 2D blit onto the visible canvas.
        const presenter = presenterRef.current;
        if (presenter) {
            presenter.present(overlay);
        } else if (webglFailedRef.current) {
            const vctx = canvas.getContext('2d');
            if (vctx) {
                vctx.clearRect(0, 0, WIDTH, HEIGHT);
                vctx.drawImage(overlay, 0, 0);
            }
        }
    }, [fpsDebug]);
    useEffect(() => {
        redrawRef.current = redraw;
    });
    // Acquire the WebGL present context once, before the first paint (so the
    // visible canvas isn't locked to a 2D context). Falls back to 2D if WebGL
    // is unavailable.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || presenterRef.current || webglFailedRef.current) return;
        try {
            presenterRef.current = new OverlayPresenter(canvas, WIDTH, HEIGHT);
        } catch {
            webglFailedRef.current = true;
        }
        return () => {
            presenterRef.current?.dispose();
            presenterRef.current = null;
        };
    }, []);
    // Paint immediately on mount using the locally-seeded scoreboard/state refs
    // (see scoreboardRef above) - otherwise the canvas stays blank until the
    // first socket message arrives, even though a default is already loaded.
    useEffect(() => {
        redraw();
    }, [redraw]);

    // Continuous redraw loop that samples the real rAF rate (?fps=1 only).
    useEffect(() => {
        if (!fpsDebug) return;
        let raf = 0;
        fpsRef.current.last = performance.now();
        const loop = () => {
            const f = fpsRef.current;
            f.frames++;
            const now = performance.now();
            const dt = now - f.last;
            if (dt >= 500) {
                f.value = (f.frames * 1000) / dt;
                f.frames = 0;
                f.last = now;
            }
            redrawRef.current();
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [fpsDebug]);

    // Drives hand + display-card animations: redraws every frame while any anim
    // is live, pruning elapsed ones, then stops (the overlay is otherwise
    // redraw-on-message). Reads redrawRef so it always calls the latest redraw.
    const animTick = useCallback(function tick() {
        const now = performance.now();
        const map = handAnimRef.current;
        for (const [id, a] of map) {
            if (now - a.start >= HAND_ANIM_DURATION) map.delete(id);
        }
        const annMap = annotationAnimRef.current;
        for (const [id, a] of annMap) {
            if (now - a.start >= ANNOTATION_ANIM_DURATION) annMap.delete(id);
        }
        const disp = displayAnimRef.current;
        const queue = displayAnimQueueRef.current;
        for (const side of ['left', 'right'] as const) {
            const a = disp[side];
            if (a && now - a.start >= a.anim.duration) {
                // Promote a queued enter (replace: exit done -> slide new in)
                // in the same frame so the static new card never flashes.
                const q = queue[side];
                if (q) {
                    disp[side] = { ...q, start: now };
                    queue[side] = null;
                } else {
                    disp[side] = null;
                }
            }
        }
        redrawRef.current();
        const active =
            map.size > 0 ||
            annMap.size > 0 ||
            disp.left !== null ||
            disp.right !== null ||
            queue.left !== null ||
            queue.right !== null;
        rafRef.current = active ? requestAnimationFrame(tick) : null;
    }, []);

    const startAnimLoop = useCallback(() => {
        if (rafRef.current == null)
            rafRef.current = requestAnimationFrame(animTick);
    }, [animTick]);

    useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const handleMessage = useCallback(
        (msg: LiveMessage) => {
            if (msg.type === 'live-state') {
                stateRef.current = msg.state;
                redraw();
            } else if (msg.type === 'live-event') {
                const { event } = msg;
                if (event.type === 'ADD_TO_HAND') {
                    handAnimRef.current.set(event.card.id, {
                        phase: 'enter',
                        start: performance.now(),
                        card: event.card,
                        side: event.side,
                    });
                    startAnimLoop();
                } else if (event.type === 'REMOVE_FROM_HAND') {
                    // The snapshot for this removal has not arrived yet, so
                    // stateRef still holds the pre-removal hand: capture the
                    // card's slot so the renderer can close the gap.
                    const preHand =
                        event.side === 'left'
                            ? stateRef.current.left
                            : stateRef.current.right;
                    handAnimRef.current.set(event.card.id, {
                        phase: 'exit',
                        start: performance.now(),
                        card: event.card,
                        side: event.side,
                        oldIndex: preHand.findIndex(
                            (c) => c.id === event.card.id
                        ),
                    });
                    startAnimLoop();
                } else if (
                    event.type === 'ANNOTATE_CARD' &&
                    event.annotationId
                ) {
                    annotationAnimRef.current.set(event.card.id, {
                        phase: 'enter',
                        start: performance.now(),
                        card: event.card,
                        side: event.side,
                        annotationId: event.annotationId,
                    });
                    startAnimLoop();
                } else if (
                    event.type === 'UNANNOTATE_CARD' &&
                    event.annotationId
                ) {
                    // Snapshot for this removal has not arrived yet, so
                    // annotationsRef still holds the pre-removal slot: capture
                    // the card's index so the renderer can close the gap.
                    const slot = annotationsRef.current[event.annotationId];
                    const preCards =
                        (event.side === 'left' ? slot?.left : slot?.right) ??
                        [];
                    annotationAnimRef.current.set(event.card.id, {
                        phase: 'exit',
                        start: performance.now(),
                        card: event.card,
                        side: event.side,
                        annotationId: event.annotationId,
                        oldIndex: preCards.findIndex(
                            (c) => c.id === event.card.id
                        ),
                    });
                    startAnimLoop();
                }
            } else if (msg.type === 'annotation-state') {
                annotationsRef.current = {
                    ...annotationsRef.current,
                    [msg.annotationId]: {
                        title: msg.title,
                        left: msg.state.left,
                        right: msg.state.right,
                    },
                };
                redraw();
            } else if (msg.type === 'card-display-state') {
                const prev = displayCardRef.current;
                const next = { left: msg.left, right: msg.right };
                for (const side of ['left', 'right'] as const) {
                    const p = prev[side];
                    const n = next[side];
                    const cfg = cardDisplayConfigRef.current[side].animation;
                    // appear -> enter the new card; clear -> exit the old one
                    // (kept in the anim so it can draw while leaving); replace
                    // -> exit the old card, then queue the new card's enter so
                    // it slides in only after the old one has slid out. Same
                    // card (e.g. a flip) leaves any running anim alone.
                    if (p && n && p.id !== n.id) {
                        displayAnimRef.current[side] = {
                            phase: 'exit',
                            start: performance.now(),
                            card: p,
                            anim: cfg,
                        };
                        displayAnimQueueRef.current[side] = {
                            phase: 'enter',
                            start: performance.now(),
                            card: n,
                            anim: cfg,
                        };
                    } else if (n && !p) {
                        displayAnimRef.current[side] = {
                            phase: 'enter',
                            start: performance.now(),
                            card: n,
                            anim: cfg,
                        };
                    } else if (p && !n) {
                        displayAnimRef.current[side] = {
                            phase: 'exit',
                            start: performance.now(),
                            card: p,
                            anim: cfg,
                        };
                    }
                }
                displayCardRef.current = next;
                startAnimLoop();
                redraw();
            } else if (msg.type === 'config-state') {
                stripWRef.current = msg.cardStripWidth;
                if (wsUrl)
                    saveLiveModeConfig({
                        websocketUrl: wsUrl,
                        cardStripWidth: msg.cardStripWidth,
                    });
                redraw();
            } else if (msg.type === 'card-display-config') {
                cardDisplayConfigRef.current = msg.config;
                saveLiveCardDisplayConfig(msg.config);
                redraw();
            } else if (msg.type === 'hand-stack-config') {
                handStackConfigRef.current = msg.config;
                saveLiveHandStackConfig(msg.config);
                redraw();
            } else if (msg.type === 'scoreboard-state') {
                scoreboardRef.current = msg.scoreboard;
                saveLiveScoreboardState(msg.scoreboard);
                redraw();
            } else if (msg.type === 'player-info-state') {
                playerInfoRef.current = { left: msg.left, right: msg.right };
                redraw();
            } else if (msg.type === 'preload-cards') {
                preloadCardImageData(msg.cards);
            }
        },
        [redraw, wsUrl, startAnimLoop]
    );

    const { send, status } = useLiveModeSocket(wsUrl, handleMessage);

    useEffect(() => {
        if (status === 'open') send({ type: 'request-state' });
    }, [status, send]);

    useEffect(() => subscribeImageLoad(redraw), [redraw]);

    if (!wsUrl) {
        return (
            <div className="h-screen flex items-center justify-center bg-background text-foreground">
                <p className="text-muted-foreground">
                    Live Mode not configured
                </p>
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
