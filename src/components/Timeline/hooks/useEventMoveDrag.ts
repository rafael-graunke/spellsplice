import { useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { Player, } from '../../types/player';
import type { TrackEvent, EventType } from '../../types/event';
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
    sourcePlayerId: string;
    sourceLayer: number;
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
    startLayer: number;
}

type MoveResult = {
    playerId: string;
    eventId: number;
    newTime: number;
    newLayer: number;
};

function makeGhost(data: EventDragData, newTime: number, layerIndex: number, zoom: number): GhostPos {
    return {
        left: newTime * zoom,
        top: data.isWaypoint
            ? RULER_HEIGHT + layerIndex * TRACK_HEIGHT
            : RULER_HEIGHT + layerIndex * TRACK_HEIGHT + 4,
        width: data.isWaypoint ? 44 : data.startDuration * zoom,
        color: data.color,
        type: data.type,
        isWaypoint: data.isWaypoint,
    };
}

export function useEventMoveDrag(
    innerRef: RefObject<HTMLDivElement | null>,
    zoomRef: RefObject<number>,
    selectedPlayer: Player | null,
    selectedEvents: TrackEvent[],
    onMoveEvent: (playerId: string, eventId: number, newTime: number, newLayer: number) => void,
    onMoveMultipleEvents: (moves: MoveResult[]) => void,
) {
    const [ghostPositions, setGhostPositions] = useState<GhostPos[]>([]);
    const moveDragRef = useRef<MoveDragState | null>(null);

    const handleMoveStart = (
        playerId: string,
        sourceLayer: number,
        eventId: number,
        e: ReactMouseEvent,
        time: number,
        duration: number | undefined
    ) => {
        const inner = innerRef.current;
        if (!inner) return;

        const event = selectedPlayer?.track.events.find((ev) => ev.id === eventId);
        if (!event) return;

        const primary: EventDragData = {
            eventId,
            sourcePlayerId: playerId,
            sourceLayer,
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
                      const current = selectedPlayer?.track.events.find(
                          (ev) => ev.id === se.id
                      );
                      if (!current) return [];
                      return [
                          {
                              eventId: se.id,
                              sourcePlayerId: playerId,
                              sourceLayer: current.layer,
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
            startLayer: sourceLayer,
        };

        const zoom = zoomRef.current!;
        setGhostPositions([
            makeGhost(primary, time, sourceLayer, zoom),
            ...companions.map((c) => makeGhost(c, c.startTime, c.sourceLayer, zoom)),
        ]);
    };

    useEffect(() => {
        if (ghostPositions.length === 0) return;

        const totalLayers = selectedPlayer?.track.layers ?? 1;

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
            const primaryLayer = Math.max(0, Math.min(totalLayers - 1, rawIndex));
            const layerDelta = primaryLayer - drag.startLayer;

            const newTime = Math.max(0, drag.primary.startTime + deltaTime);

            const ghosts = [
                makeGhost(drag.primary, newTime, primaryLayer, zoom),
                ...drag.companions.map((c) => {
                    const cLayer = Math.max(
                        0,
                        Math.min(totalLayers - 1, c.sourceLayer + layerDelta)
                    );
                    return makeGhost(c, Math.max(0, c.startTime + deltaTime), cLayer, zoom);
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
            const primaryLayer = Math.max(0, Math.min(totalLayers - 1, rawIndex));
            const layerDelta = primaryLayer - drag.startLayer;

            if (drag.companions.length === 0) {
                onMoveEvent(
                    drag.primary.sourcePlayerId,
                    drag.primary.eventId,
                    Math.max(0, drag.primary.startTime + deltaTime),
                    primaryLayer
                );
            } else {
                const moves: MoveResult[] = [
                    {
                        playerId: drag.primary.sourcePlayerId,
                        eventId: drag.primary.eventId,
                        newTime: Math.max(0, drag.primary.startTime + deltaTime),
                        newLayer: primaryLayer,
                    },
                    ...drag.companions.map((c) => ({
                        playerId: c.sourcePlayerId,
                        eventId: c.eventId,
                        newTime: Math.max(0, c.startTime + deltaTime),
                        newLayer: Math.max(0, Math.min(totalLayers - 1, c.sourceLayer + layerDelta)),
                    })),
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
    }, [ghostPositions, selectedPlayer?.id, selectedPlayer?.track.layers]);

    return { ghostPositions, moveDragRef, handleMoveStart };
}
