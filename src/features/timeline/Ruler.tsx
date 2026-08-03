import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from './constants';
import type { Marker } from '../../types/marker';
import { MarkerColorMap } from '../../types/marker';
import type { Snapper } from './snapping';
import { resolvePlayheadTime } from './snapping';

const SCROLL_BUCKET_PX = 256;
const OVERSCAN_PX = 512;
/**
 * Hit box, much wider than the 6px flag it contains. `M` drops a marker exactly
 * at the playhead, whose 24px handle sits on the same spot, so a marker needs a
 * real target and a z-index above the cursor or it is unclickable on creation.
 */
const MARKER_HIT_W = 14;

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function zoomToPercent(zoom: number): number {
    return ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;
}

interface RulerColors {
    tick?: string;
    label?: string;
}

interface RulerProps {
    duration: number;
    zoom: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
    onSeek: (t: number) => void;
    setScroll: (x: number) => void;
    setMaxScroll: (max: number) => void;
    paddingX?: number;
    colors?: RulerColors;
    markers?: Marker[];
    onMarkerClick?: (marker: Marker, e: React.MouseEvent) => void;
    inPoint?: number | null;
    outPoint?: number | null;
    onScrollGesture?: () => void;
    createSnapper?: () => Snapper | null;
}

const DEFAULT_COLORS: Required<RulerColors> = {
    tick: 'border-zinc-700',
    label: 'text-zinc-400',
};

function Ruler({ duration, zoom, scrollLeftRef, subscribe, onSeek, setScroll, setMaxScroll, paddingX = 0, colors, markers, onMarkerClick, inPoint, outPoint, onScrollGesture, createSnapper }: RulerProps) {
    const { tick: tickColor, label: labelColor } = { ...DEFAULT_COLORS, ...colors };
    const outerRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
    const [grabbing, setGrabbing] = useState(false);

    const [width, setWidth] = useState(0);
    // Quantised so scrolling re-renders once per bucket, not per pixel — the
    // transform-only scroll below must stay render-free.
    const [scrollBucket, setScrollBucket] = useState(0);

    useEffect(() => {
        const el = outerRef.current;
        if (!el) return;
        setWidth(el.clientWidth);
        const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Keep max scroll in sync with duration/zoom/container size
    useEffect(() => {
        setMaxScroll(2 * paddingX + duration * zoom - width);
    }, [duration, zoom, width, setMaxScroll, paddingX]);

    // Direct DOM scroll updates — no re-renders during scroll
    useEffect(() => {
        return subscribe((x) => {
            if (innerRef.current) {
                innerRef.current.style.transform = `translateX(${-x}px)`;
            }
            const bucket = Math.floor(x / SCROLL_BUCKET_PX);
            setScrollBucket((prev) => (prev === bucket ? prev : bucket));
        });
    }, [subscribe]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setGrabbing(true);
        dragRef.current = { startX: e.clientX, moved: false };

        const onMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = e.clientX - dragRef.current.startX;
            if (Math.abs(delta) > 4) dragRef.current.moved = true;
            if (dragRef.current.moved) {
                onScrollGesture?.();
                setScroll(scrollLeftRef.current - delta);
                dragRef.current.startX = e.clientX;
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (dragRef.current && !dragRef.current.moved && outerRef.current) {
                const x = e.clientX - outerRef.current.getBoundingClientRect().left;
                const raw = Math.max(0, Math.min(duration, (x - paddingX + scrollLeftRef.current) / zoom));
                onSeek(resolvePlayheadTime(raw, createSnapper?.() ?? null, e.altKey).time);
            }
            dragRef.current = null;
            setGrabbing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const zp = zoomToPercent(zoom);
    const tickInterval = zp < 15 ? 5 : 1;
    const labelInterval = zp < 15 ? 10 : zp < 80 ? 5 : 1;

    const ticks = useMemo(() => {
        const scrollLeft = scrollBucket * SCROLL_BUCKET_PX;
        const startPx = scrollLeft - paddingX - OVERSCAN_PX;
        const endPx = scrollLeft + width - paddingX + OVERSCAN_PX;
        const first = Math.max(0, Math.floor(startPx / zoom / tickInterval) * tickInterval);
        const last = Math.min(duration, endPx / zoom);
        const out: number[] = [];
        for (let t = first; t <= last; t += tickInterval) out.push(t);
        return out;
    }, [scrollBucket, width, zoom, duration, tickInterval, paddingX]);

    return (
        <div
            ref={outerRef}
            className={`relative h-full overflow-hidden select-none ${grabbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
            onMouseDown={handleMouseDown}
        >
            <div
                ref={innerRef}
                className="absolute inset-y-0 left-0"
                style={{ width: duration * zoom, transform: `translateX(${-(scrollLeftRef.current ?? 0)}px)`, left: paddingX }}
            >
                {inPoint != null && outPoint != null && outPoint > inPoint && (
                    <div
                        className="absolute top-0 h-1.5 bg-sky-400/80 rounded-sm pointer-events-none"
                        style={{ left: inPoint * zoom, width: (outPoint - inPoint) * zoom }}
                    />
                )}
                {inPoint != null && (
                    <div
                        className="absolute top-0 h-2.5 w-0.5 bg-sky-400 pointer-events-none"
                        style={{ left: inPoint * zoom }}
                    />
                )}
                {outPoint != null && (
                    <div
                        className="absolute top-0 h-2.5 w-0.5 bg-sky-400 pointer-events-none"
                        style={{ left: outPoint * zoom - 2 }}
                    />
                )}
                {markers?.map((m) => (
                    <div
                        key={m.id}
                        title={m.name || undefined}
                        className="group absolute top-0 bottom-0 z-30 flex justify-start cursor-pointer"
                        style={{ left: m.time * zoom - MARKER_HIT_W / 2, width: MARKER_HIT_W }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onMarkerClick?.(m, e); }}
                    >
                        <div
                            className={`h-3 w-1.5 rounded-b-sm transition-all group-hover:h-4 group-hover:ring-1 group-hover:ring-white ${MarkerColorMap[m.color].bg}`}
                            style={{ marginLeft: MARKER_HIT_W / 2 - 3 }}
                        />
                    </div>
                ))}
                {ticks.map((t) => {
                    const hasLabel = t % labelInterval === 0;
                    return (
                        <div
                            key={t}
                            className={`absolute bottom-0 border-l text-xs ${tickColor} ${labelColor} ${hasLabel ? 'h-4' : 'h-2'}`}
                            style={{ left: t * zoom }}
                        >
                            {hasLabel && (
                                <span className="absolute text-xs top-[-14px] left-1/2 -translate-x-1/2 whitespace-nowrap">
                                    {formatTime(t)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default React.memo(Ruler);
