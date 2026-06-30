import { useEffect, useCallback } from 'react';
import type { MutableRefObject } from 'react';

export function usePlayhead(
    isPlaying: boolean,
    duration: number,
    currentTimeRef: MutableRefObject<number>,
    zoomRef: MutableRefObject<number>,
    onSeek: (t: number) => void,
    onTick?: (cursorPx: number) => void,
) {
    const seekTo = useCallback((t: number) => {
        currentTimeRef.current = Math.max(0, Math.min(duration, t));
        onSeek(currentTimeRef.current);
    }, [duration, currentTimeRef, onSeek]);

    const cursorPx = useCallback((scrollLeft: number) =>
        currentTimeRef.current * zoomRef.current - scrollLeft,
    [currentTimeRef, zoomRef]);

    useEffect(() => {
        if (!isPlaying) return;
        let raf: number;
        const tick = () => {
            onTick?.(currentTimeRef.current * zoomRef.current);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [isPlaying, currentTimeRef, zoomRef, onTick]);

    return { seekTo, cursorPx };
}
