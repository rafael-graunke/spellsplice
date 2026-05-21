import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { Player, } from '../../types/player';
import type { TrackEvent, EventType } from '../../types/event';
import { TRACK_HEIGHT } from '../constants';

const SCROLL_ZONE = 30;
const MAX_SCROLL_SPEED = 10;

interface GhostPos {
    left: number;
    top: number;
    width: number;
    type: EventType;
    isWaypoint: boolean;
}

interface EventDragData {
    eventId: number;
    sourcePlayerId: string;
    sourceLayer: number;
    startTime: number;
    startDuration: number;
    type: EventType;
    isWaypoint: boolean;
}

interface MoveDragState {
    primary: EventDragData;
    companions: EventDragData[];
    startX: number;
    startLayer: number;
    startScrollLeft: number;
    totalLayers: number;
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
            ? layerIndex * TRACK_HEIGHT + 3
            : layerIndex * TRACK_HEIGHT + 4,
        width: data.isWaypoint ? 44 : data.startDuration * zoom,
        type: data.type,
        isWaypoint: data.isWaypoint,
    };
}

export function useEventMoveDrag(
    innerRef: RefObject<HTMLDivElement | null>,
    zoomRef: RefObject<number>,
    scrollContainerRef: RefObject<HTMLDivElement | null>,
    selectedPlayer: Player | null,
    selectedEvents: TrackEvent[],
    onMoveEvents: (moves: MoveResult[]) => void,
) {
    const [ghostPositions, setGhostPositions] = useState<GhostPos[]>([]);
    const moveDragRef = useRef<MoveDragState | null>(null);
    const scrollRafRef = useRef<number | null>(null);
    const scrollSpeedRef = useRef(0);
    const scrollSpeedXRef = useRef(0);

    const stopAutoScroll = () => {
        scrollSpeedRef.current = 0;
        scrollSpeedXRef.current = 0;
        if (scrollRafRef.current) {
            cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
        }
    };

    const handleMoveStart = useCallback((
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
            startScrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
            totalLayers: selectedPlayer?.track.layers ?? 4,
        };

        const zoom = zoomRef.current!;
        setGhostPositions([
            makeGhost(primary, time, sourceLayer, zoom),
            ...companions.map((c) => makeGhost(c, c.startTime, c.sourceLayer, zoom)),
        ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPlayer, selectedEvents]);

    useEffect(() => {
        if (ghostPositions.length === 0) return;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) return;

            const rect = inner.getBoundingClientRect();
            const zoom = zoomRef.current!;
            const scrollEl = scrollContainerRef.current;
            const scrollDelta = (scrollEl?.scrollLeft ?? 0) - drag.startScrollLeft;
            const deltaX = (e.clientX - drag.startX) + scrollDelta;
            const deltaTime = deltaX / zoom;

            const yInInner = e.clientY - rect.top;
            const rawLayerDelta = Math.floor(yInInner / TRACK_HEIGHT) - drag.startLayer;

            const allElements = [drag.primary, ...drag.companions];
            const minStartTime = Math.min(...allElements.map((e) => e.startTime));
            const clampedDeltaTime = Math.max(deltaTime, -minStartTime);

            const allSourceLayers = allElements.map((e) => e.sourceLayer);
            const minSourceLayer = Math.min(...allSourceLayers);
            const maxSourceLayer = Math.max(...allSourceLayers);
            const clampedLayerDelta = Math.max(
                Math.min(rawLayerDelta, drag.totalLayers - 1 - maxSourceLayer),
                -minSourceLayer,
            );

            const primaryLayer = drag.primary.sourceLayer + clampedLayerDelta;
            const newTime = drag.primary.startTime + clampedDeltaTime;

            const ghosts = [
                makeGhost(drag.primary, newTime, primaryLayer, zoom),
                ...drag.companions.map((c) => {
                    const cLayer = c.sourceLayer + clampedLayerDelta;
                    return makeGhost(c, c.startTime + clampedDeltaTime, cLayer, zoom);
                }),
            ];
            setGhostPositions(ghosts);

            // Edge scroll
            if (scrollEl) {
                const sr = scrollEl.getBoundingClientRect();
                const distBottom = sr.bottom - e.clientY;
                const distTop = e.clientY - sr.top;
                const distRight = sr.right - e.clientX;
                const distLeft = e.clientX - sr.left;
                if (distBottom < 0) {
                    scrollSpeedRef.current = MAX_SCROLL_SPEED;
                } else if (distBottom < SCROLL_ZONE) {
                    scrollSpeedRef.current = ((SCROLL_ZONE - distBottom) / SCROLL_ZONE) * MAX_SCROLL_SPEED;
                } else if (distTop < 0) {
                    scrollSpeedRef.current = -MAX_SCROLL_SPEED;
                } else if (distTop < SCROLL_ZONE) {
                    scrollSpeedRef.current = -((SCROLL_ZONE - distTop) / SCROLL_ZONE) * MAX_SCROLL_SPEED;
                } else {
                    scrollSpeedRef.current = 0;
                }
                if (distRight < 0) {
                    scrollSpeedXRef.current = MAX_SCROLL_SPEED;
                } else if (distRight < SCROLL_ZONE) {
                    scrollSpeedXRef.current = ((SCROLL_ZONE - distRight) / SCROLL_ZONE) * MAX_SCROLL_SPEED;
                } else if (distLeft < 0) {
                    scrollSpeedXRef.current = -MAX_SCROLL_SPEED;
                } else if (distLeft < SCROLL_ZONE) {
                    scrollSpeedXRef.current = -((SCROLL_ZONE - distLeft) / SCROLL_ZONE) * MAX_SCROLL_SPEED;
                } else {
                    scrollSpeedXRef.current = 0;
                }
                if ((scrollSpeedRef.current !== 0 || scrollSpeedXRef.current !== 0) && !scrollRafRef.current) {
                    const tick = () => {
                        scrollEl.scrollTop += scrollSpeedRef.current;
                        scrollEl.scrollLeft += scrollSpeedXRef.current;
                        scrollRafRef.current = (scrollSpeedRef.current !== 0 || scrollSpeedXRef.current !== 0)
                            ? requestAnimationFrame(tick)
                            : null;
                    };
                    scrollRafRef.current = requestAnimationFrame(tick);
                }
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            stopAutoScroll();

            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) {
                setGhostPositions([]);
                return;
            }

            const rect = inner.getBoundingClientRect();
            const zoom = zoomRef.current!;
            const scrollDeltaUp = (scrollContainerRef.current?.scrollLeft ?? 0) - drag.startScrollLeft;
            const deltaX = (e.clientX - drag.startX) + scrollDeltaUp;
            const deltaTime = deltaX / zoom;

            const yInInner = e.clientY - rect.top;
            const rawLayerDelta = Math.floor(yInInner / TRACK_HEIGHT) - drag.startLayer;

            const allElements = [drag.primary, ...drag.companions];
            const minStartTime = Math.min(...allElements.map((e) => e.startTime));
            const clampedDeltaTime = Math.max(deltaTime, -minStartTime);

            const allSourceLayers = allElements.map((e) => e.sourceLayer);
            const minSourceLayer = Math.min(...allSourceLayers);
            const maxSourceLayer = Math.max(...allSourceLayers);
            const clampedLayerDelta = Math.max(
                Math.min(rawLayerDelta, drag.totalLayers - 1 - maxSourceLayer),
                -minSourceLayer,
            );

            const primaryLayer = drag.primary.sourceLayer + clampedLayerDelta;

            onMoveEvents([
                {
                    playerId: drag.primary.sourcePlayerId,
                    eventId: drag.primary.eventId,
                    newTime: drag.primary.startTime + clampedDeltaTime,
                    newLayer: primaryLayer,
                },
                ...drag.companions.map((c) => ({
                    playerId: c.sourcePlayerId,
                    eventId: c.eventId,
                    newTime: c.startTime + clampedDeltaTime,
                    newLayer: c.sourceLayer + clampedLayerDelta,
                })),
            ]);

            moveDragRef.current = null;
            setGhostPositions([]);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            stopAutoScroll();
        };
    }, [ghostPositions, selectedPlayer?.id, selectedPlayer?.track.layers]);

    return { ghostPositions, moveDragRef, handleMoveStart };
}
