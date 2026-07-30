import { useRef, useCallback } from 'react';

export function useTimelineScroll() {
    const scrollLeftRef = useRef(0);
    const maxScrollRef = useRef(Infinity);
    const listenersRef = useRef<Set<(x: number) => void>>(new Set());

    const setScroll = useCallback((x: number) => {
        scrollLeftRef.current = Math.max(0, Math.min(maxScrollRef.current, x));
        listenersRef.current.forEach((fn) => fn(scrollLeftRef.current));
    }, []);

    const setMaxScroll = useCallback((max: number) => {
        maxScrollRef.current = max;
        // re-clamp if current scroll exceeds new max
        if (scrollLeftRef.current > max) setScroll(max);
    }, [setScroll]);

    const subscribe = useCallback((fn: (x: number) => void) => {
        listenersRef.current.add(fn);
        return () => { listenersRef.current.delete(fn); };
    }, []);

    return { scrollLeftRef, maxScrollRef, setScroll, setMaxScroll, subscribe };
}
