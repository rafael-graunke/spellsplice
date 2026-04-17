import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';

export const percentToZoom = (p: number): number =>
    MIN_ZOOM + (p / 100) * (MAX_ZOOM - MIN_ZOOM);

export const zoomToPercent = (z: number): number =>
    ((z - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;

export function useZoom(
    containerRef: RefObject<HTMLDivElement>,
    trackRef: RefObject<HTMLDivElement>,
    innerRef: RefObject<HTMLDivElement>
) {
    const [zoomPercent, setZoomPercent] = useState(zoomToPercent(50));
    const zoom = percentToZoom(zoomPercent);
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    const handleZoomChange = (newPercent: number) => {
        const clamped = Math.min(Math.max(0, newPercent), 100);
        const newZoom = percentToZoom(clamped);
        zoomRef.current = newZoom;
        setZoomPercent(clamped);
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
            const newZoom = Math.min(
                Math.max(MIN_ZOOM, oldZoom * (1 + delta * zoomIntensity)),
                MAX_ZOOM
            );
            const newScrollLeft = time * newZoom + padding - trackX;

            zoomRef.current = newZoom;
            setZoomPercent(zoomToPercent(newZoom));
            track.scrollLeft = newScrollLeft;
        };

        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    return { zoom, zoomPercent, zoomRef, handleZoomChange };
}
