import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useZoom(
    containerRef: RefObject<HTMLDivElement>,
    trackRef: RefObject<HTMLDivElement>,
    innerRef: RefObject<HTMLDivElement>,
) {
    const [zoom, setZoom] = useState(50);
    const zoomRef = useRef(zoom);

    const handleZoomChange = (newZoom: number) => {
        zoomRef.current = newZoom;
        setZoom(newZoom);
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handler = (e: WheelEvent) => {
            e.preventDefault();

            const track = trackRef.current;
            const inner = innerRef.current;
            if (!track || !inner) return;

            const trackRect = track.getBoundingClientRect();
            const innerRect = inner.getBoundingClientRect();
            const trackX = e.clientX - trackRect.left;
            const scrollLeft = track.scrollLeft;
            const oldZoom = zoomRef.current;

            const padding = innerRect.left - trackRect.left + scrollLeft;
            const contentX = scrollLeft + trackX - padding;
            const time = contentX / oldZoom;

            const zoomIntensity = 0.001;
            const delta = -e.deltaY;
            const newZoom = Math.min(Math.max(5, oldZoom * (1 + delta * zoomIntensity)), 200);
            const newScrollLeft = time * newZoom + padding - trackX;

            zoomRef.current = newZoom;
            setZoom(newZoom);
            track.scrollLeft = newScrollLeft;
        };

        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    return { zoom, zoomRef, handleZoomChange };
}
