import { useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { Track, TrackEvent, EventType } from '../../types/event';
import { RULER_HEIGHT, TRACK_HEIGHT } from '../constants';

interface GhostPos {
    left: number;
    top: number;
    width: number;
    color: string;
    type: EventType;
    isWaypoint: boolean;
}

interface EventDragData {
    eventId: number;
    sourceTrackId: string;
    sourceTrackIndex: number;
    startTime: number;
    startDuration: number;
    color: string;
    type: EventType;
    isWaypoint: boolean;
}

interface MoveDragState {
    primary: EventDragData;
    companions: EventDragData[];
    startX: number;
    startTrackIndex: number;
}

type MoveResult = {
    fromTrackId: string;
    toTrackId: string;
    eventId: number;
    newTime: number;
};

function makeGhost(data: EventDragData, newTime: number, trackIndex: number, zoom: number): GhostPos {
    return {
        left: newTime * zoom,
        top: data.isWaypoint
            ? RULER_HEIGHT + trackIndex * TRACK_HEIGHT
            : RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 4,
        width: data.isWaypoint ? 44 : data.startDuration * zoom,
        color: data.color,
        type: data.type,
        isWaypoint: data.isWaypoint,
    };
}

export function useEventMoveDrag(
    innerRef: RefObject<HTMLDivElement>,
    zoomRef: RefObject<number>,
    tracks: Track[],
    selectedEvents: TrackEvent[],
    onMoveEvent: (fromTrackId: string, toTrackId: string, eventId: number, newTime: number) => void,
    onMoveMultipleEvents: (moves: MoveResult[]) => void,
) {
    const [ghostPositions, setGhostPositions] = useState<GhostPos[]>([]);
    const moveDragRef = useRef<MoveDragState | null>(null);

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

        const primary: EventDragData = {
            eventId,
            sourceTrackId: trackId,
            sourceTrackIndex: trackIndex,
            startTime: time,
            startDuration: duration ?? 0,
            color: event.color,
            type: event.type,
            isWaypoint: !event.resizable,
        };

        const isMultiMove =
            selectedEvents.length > 1 &&
            selectedEvents.some((se) => se.id === eventId);

        const companions: EventDragData[] = isMultiMove
            ? selectedEvents
                  .filter((se) => se.id !== eventId)
                  .flatMap((se) => {
                      const seTrackIndex = tracks.findIndex((t) =>
                          t.events.some((ev) => ev.id === se.id)
                      );
                      if (seTrackIndex === -1) return [];
                      const seTrack = tracks[seTrackIndex];
                      const current = seTrack.events.find((ev) => ev.id === se.id)!;
                      return [
                          {
                              eventId: se.id,
                              sourceTrackId: seTrack.id,
                              sourceTrackIndex: seTrackIndex,
                              startTime: current.time,
                              startDuration: current.duration ?? 0,
                              color: current.color,
                              type: current.type,
                              isWaypoint: !current.resizable,
                          },
                      ];
                  })
            : [];

        moveDragRef.current = {
            primary,
            companions,
            startX: e.clientX,
            startTrackIndex: trackIndex,
        };

        const zoom = zoomRef.current!;
        setGhostPositions([
            makeGhost(primary, time, trackIndex, zoom),
            ...companions.map((c) =>
                makeGhost(c, c.startTime, c.sourceTrackIndex, zoom)
            ),
        ]);
    };

    useEffect(() => {
        if (ghostPositions.length === 0) return;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) return;

            const rect = inner.getBoundingClientRect();
            const zoom = zoomRef.current!;
            const deltaX = e.clientX - drag.startX;
            const deltaTime = deltaX / zoom;

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor((yInInner - RULER_HEIGHT) / TRACK_HEIGHT);
            const primaryTrackIndex = Math.max(0, Math.min(tracks.length - 1, rawIndex));
            const trackDelta = primaryTrackIndex - drag.startTrackIndex;

            const newTime = Math.max(0, drag.primary.startTime + deltaTime);

            const ghosts = [
                makeGhost(drag.primary, newTime, primaryTrackIndex, zoom),
                ...drag.companions.map((c) => {
                    const cTrackIndex = Math.max(
                        0,
                        Math.min(tracks.length - 1, c.sourceTrackIndex + trackDelta)
                    );
                    return makeGhost(
                        c,
                        Math.max(0, c.startTime + deltaTime),
                        cTrackIndex,
                        zoom
                    );
                }),
            ];
            setGhostPositions(ghosts);
        };

        const onMouseUp = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) {
                setGhostPositions([]);
                return;
            }

            const rect = inner.getBoundingClientRect();
            const zoom = zoomRef.current!;
            const deltaX = e.clientX - drag.startX;
            const deltaTime = deltaX / zoom;

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor((yInInner - RULER_HEIGHT) / TRACK_HEIGHT);
            const primaryTrackIndex = Math.max(0, Math.min(tracks.length - 1, rawIndex));
            const trackDelta = primaryTrackIndex - drag.startTrackIndex;
            const targetTrackId = tracks[primaryTrackIndex].id;

            if (drag.companions.length === 0) {
                onMoveEvent(
                    drag.primary.sourceTrackId,
                    targetTrackId,
                    drag.primary.eventId,
                    Math.max(0, drag.primary.startTime + deltaTime)
                );
            } else {
                const moves: MoveResult[] = [
                    {
                        fromTrackId: drag.primary.sourceTrackId,
                        toTrackId: targetTrackId,
                        eventId: drag.primary.eventId,
                        newTime: Math.max(0, drag.primary.startTime + deltaTime),
                    },
                    ...drag.companions.map((c) => {
                        const cTrackIndex = Math.max(
                            0,
                            Math.min(tracks.length - 1, c.sourceTrackIndex + trackDelta)
                        );
                        return {
                            fromTrackId: c.sourceTrackId,
                            toTrackId: tracks[cTrackIndex].id,
                            eventId: c.eventId,
                            newTime: Math.max(0, c.startTime + deltaTime),
                        };
                    }),
                ];
                onMoveMultipleEvents(moves);
            }

            moveDragRef.current = null;
            setGhostPositions([]);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [ghostPositions, tracks]);

    return { ghostPositions, moveDragRef, handleMoveStart };
}
