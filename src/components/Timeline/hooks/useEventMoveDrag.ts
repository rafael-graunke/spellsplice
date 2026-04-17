import { useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { Track, EventType } from '../../types/event';
import { RULER_HEIGHT, TRACK_HEIGHT } from '../constants';

interface GhostPos {
    left: number;
    top: number;
    width: number;
    color: string;
    type: EventType;
    isWaypoint: boolean;
}

export function useEventMoveDrag(
    innerRef: RefObject<HTMLDivElement>,
    zoomRef: RefObject<number>,
    tracks: Track[],
    onMoveEvent: (
        fromTrackId: string,
        toTrackId: string,
        eventId: number,
        newTime: number
    ) => void
) {
    const [ghostPos, setGhostPos] = useState<GhostPos | null>(null);
    const moveDragRef = useRef<{
        eventId: number;
        sourceTrackId: string;
        startX: number;
        startTime: number;
        startDuration: number;
        color: string;
        type: EventType;
        isWaypoint: boolean;
    } | null>(null);

    const handleMoveStart = (
        trackId: string,
        eventId: number,
        e: ReactMouseEvent,
        time: number,
        duration: number | undefined
    ) => {
        const inner = innerRef.current;
        if (!inner) return;

        const sourceTrack = tracks.find((t) => t.id === trackId);
        const event = sourceTrack?.events.find((ev) => ev.id === eventId);
        if (!event) return;

        const trackIndex = tracks.findIndex((t) => t.id === trackId);
        const isWaypoint = !event.resizable;

        moveDragRef.current = {
            eventId,
            sourceTrackId: trackId,
            startX: e.clientX,
            startTime: time,
            startDuration: duration ?? 0,
            color: event.color,
            type: event.type,
            isWaypoint,
        };

        setGhostPos({
            left: time * zoomRef.current!,
            top: isWaypoint
                ? RULER_HEIGHT + trackIndex * TRACK_HEIGHT
                : RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 4,
            width: isWaypoint ? 44 : (duration ?? 1) * zoomRef.current!,
            color: event.color,
            type: event.type,
            isWaypoint,
        });
    };

    useEffect(() => {
        if (!ghostPos) return;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) return;

            const rect = inner.getBoundingClientRect();
            const deltaX = e.clientX - drag.startX;
            const newTime = Math.max(
                0,
                drag.startTime + deltaX / zoomRef.current!
            );

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor(
                (yInInner - RULER_HEIGHT) / TRACK_HEIGHT
            );
            const trackIndex = Math.max(
                0,
                Math.min(tracks.length - 1, rawIndex)
            );

            setGhostPos({
                left: newTime * zoomRef.current!,
                top: drag.isWaypoint
                    ? RULER_HEIGHT + trackIndex * TRACK_HEIGHT
                    : RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 4,
                width: drag.isWaypoint
                    ? 44
                    : drag.startDuration * zoomRef.current!,
                color: drag.color,
                type: drag.type,
                isWaypoint: drag.isWaypoint,
            });
        };

        const onMouseUp = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) {
                setGhostPos(null);
                return;
            }

            const rect = inner.getBoundingClientRect();
            const deltaX = e.clientX - drag.startX;
            const newTime = Math.max(
                0,
                drag.startTime + deltaX / zoomRef.current!
            );

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor(
                (yInInner - RULER_HEIGHT) / TRACK_HEIGHT
            );
            const targetIndex = Math.max(
                0,
                Math.min(tracks.length - 1, rawIndex)
            );
            const targetTrackId = tracks[targetIndex].id;

            onMoveEvent(
                drag.sourceTrackId,
                targetTrackId,
                drag.eventId,
                newTime
            );
            moveDragRef.current = null;
            setGhostPos(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [ghostPos, tracks]);

    return { ghostPos, moveDragRef, handleMoveStart };
}
