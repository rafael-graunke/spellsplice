import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type { Player } from '../../types/player';
import type { TrackEvent } from '../../types/event';
import { TRACK_HEIGHT, MIN_LANES } from '../constants';

interface MarqueeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function useMarqueeDrag(
    innerRef: RefObject<HTMLDivElement | null>,
    selectedPlayer: Player | null,
    zoomRef: RefObject<number>,
    onSelect: (events: TrackEvent[]) => void,
    onDeselect: () => void,
): {
    marqueeRect: MarqueeRect | null;
    handleTrackMouseDown: (e: React.MouseEvent) => void;
} {
    const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
    const marqueeRectRef = useRef<MarqueeRect | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onDeselectRef = useRef(onDeselect);
    onDeselectRef.current = onDeselect;
    const selectedPlayerRef = useRef(selectedPlayer);
    selectedPlayerRef.current = selectedPlayer;

    const updateRect = (rect: MarqueeRect | null) => {
        marqueeRectRef.current = rect;
        setMarqueeRect(rect);
    };

    const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;

        const inner = innerRef.current;
        if (!inner) return;
        // Portal clicks (e.g. context menu items) bubble through the React tree
        // but their DOM nodes live in document.body, outside innerRef.
        if (!inner.contains(e.target as Node)) return;

        const innerRect = inner.getBoundingClientRect();
        const x0 = e.clientX - innerRect.left;
        const y0 = e.clientY - innerRect.top;
        startPosRef.current = { x: x0, y: y0 };
        updateRect(null);

        const onMouseMove = (e: MouseEvent) => {
            if (!startPosRef.current || !innerRef.current) return;
            const ir = innerRef.current.getBoundingClientRect();
            const curX = e.clientX - ir.left;
            const curY = e.clientY - ir.top;
            const { x: sx, y: sy } = startPosRef.current;
            const dx = curX - sx;
            const dy = curY - sy;
            if (!marqueeRectRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            updateRect({
                x: Math.min(sx, curX),
                y: Math.min(sy, curY),
                w: Math.abs(dx),
                h: Math.abs(dy),
            });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            const rect = marqueeRectRef.current;
            startPosRef.current = null;
            updateRect(null);

            if (!rect) {
                onDeselectRef.current();
                return;
            }

            const zoom = zoomRef.current!;
            const matched: TrackEvent[] = [];
            const sp = selectedPlayerRef.current;

            const events = sp?.track.events ?? [];
            const maxLayer = events.reduce((m, e) => Math.max(m, e.layer), -1);
            const totalLayers = Math.max(MIN_LANES, maxLayer + 1);

            for (let layerIndex = 0; layerIndex < totalLayers; layerIndex++) {
                const trackTop = layerIndex * TRACK_HEIGHT;
                const trackBottom = trackTop + TRACK_HEIGHT;
                if (rect.y + rect.h < trackTop || rect.y > trackBottom) continue;

                events
                    .filter((e) => e.layer === layerIndex)
                    .forEach((event) => {
                        const centerX = event.time * zoom;
                        const eventLeft = event.resizable ? centerX : centerX - 22;
                        const eventRight = event.resizable
                            ? centerX + (event.duration ?? 1) * zoom
                            : centerX + 22;

                        if (rect.x + rect.w >= eventLeft && rect.x <= eventRight) {
                            matched.push(event);
                        }
                    });
            }

            onSelectRef.current(matched);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { marqueeRect, handleTrackMouseDown };
}
