import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export type FollowMode = 'off' | 'page' | 'smooth';

/** Keeps the playhead this far inside the viewport after a page jump. */
const PAGE_MARGIN_PX = 80;
/** Right-edge trigger band; crossing it pages the view forward. */
const EDGE_PX = 24;

interface AutoScrollOptions {
    isPlaying: boolean;
    mode: FollowMode;
    currentTimeRef: RefObject<number>;
    zoomRef: RefObject<number>;
    scrollLeftRef: RefObject<number>;
    containerWidthRef: RefObject<number>;
    setScroll: (x: number) => void;
    paddingX: number;
}

/**
 * Scrolls the timeline to keep the playhead visible during playback.
 *
 * Page scroll (the default in both Premiere and Resolve) jumps a screenful at
 * the edge; smooth pins the playhead near centre and scrolls continuously,
 * which is only affordable here because scrolling is a transform write with no
 * re-render.
 *
 * A manual scroll suspends following until the next play, so dragging the ruler
 * mid-playback doesn't fight the loop.
 */
export function useTimelineAutoScroll({
    isPlaying,
    mode,
    currentTimeRef,
    zoomRef,
    scrollLeftRef,
    containerWidthRef,
    setScroll,
    paddingX,
}: AutoScrollOptions) {
    const suspendedRef = useRef(false);

    const suspendFollow = useCallback(() => { suspendedRef.current = true; }, []);

    useEffect(() => {
        if (!isPlaying) return;
        suspendedRef.current = false;
        if (mode === 'off') return;

        let raf: number;
        const tick = () => {
            raf = requestAnimationFrame(tick);
            if (suspendedRef.current) return;
            const width = containerWidthRef.current;
            if (width <= 0) return;
            const contentPx = paddingX + currentTimeRef.current * zoomRef.current;
            const viewPx = contentPx - scrollLeftRef.current;
            if (mode === 'smooth') {
                setScroll(contentPx - width / 2);
            } else if (viewPx > width - EDGE_PX || viewPx < 0) {
                setScroll(contentPx - PAGE_MARGIN_PX);
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isPlaying, mode, currentTimeRef, zoomRef, scrollLeftRef, containerWidthRef, setScroll, paddingX]);

    return { suspendFollow };
}
