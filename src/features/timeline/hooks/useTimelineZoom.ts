import { useRef, useState } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from '../constants';

export function useTimelineZoom(initialZoom = 20) {
    const [zoom, setZoomState] = useState(initialZoom);
    const zoomRef = useRef(initialZoom);

    // Returns the new scrollLeft to apply so the pivot point stays fixed.
    // pivotPx: pixel offset from content left (not viewport left) under the mouse.
    // currentScrollLeft: scrollLeftRef.current at call time.
    const setZoom = (z: number, pivotPx = 0, currentScrollLeft = 0): number => {
        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
        const timeAtPivot = (currentScrollLeft + pivotPx) / zoomRef.current;
        const newScrollLeft = Math.max(0, timeAtPivot * clamped - pivotPx);
        zoomRef.current = clamped;
        setZoomState(clamped);
        return newScrollLeft;
    };

    return { zoom, zoomRef, setZoom };
}
