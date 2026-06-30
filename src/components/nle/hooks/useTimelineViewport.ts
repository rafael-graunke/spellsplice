import type { MutableRefObject } from 'react';

export function useTimelineViewport(
    scrollLeftRef: MutableRefObject<number>,
    zoomRef: MutableRefObject<number>,
    containerWidthRef: MutableRefObject<number>,
) {
    const getViewport = () => {
        const start = scrollLeftRef.current / zoomRef.current;
        const end = (scrollLeftRef.current + containerWidthRef.current) / zoomRef.current;
        return { visibleStart: start, visibleEnd: end };
    };

    return { getViewport };
}
