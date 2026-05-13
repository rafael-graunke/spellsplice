import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { TrackEvent, EventType } from '../../types/event';
import type { NLETrack } from '../../types/nle';
import { TrackType } from '../../types/nle';

const SCROLL_ZONE = 30;
const MAX_SCROLL_SPEED = 10;

export interface NLEGhostPos {
    left: number;
    width: number;
    type: EventType;
    isWaypoint: boolean;
}

export interface NLEMoveResult {
    fromTrackId: string;
    toTrackId: string;
    eventId: number;
    newTime: number;
}

interface EventDragData {
    eventId: number;
    fromTrackId: string;
    startTime: number;
    startDuration: number;
    type: EventType;
    isWaypoint: boolean;
}

interface MoveDragState {
    primary: EventDragData;
    companions: EventDragData[];
    startX: number;
    startScrollLeft: number;
    primaryTrackIndex: number; // index into eventTracks at drag start
}

function makeGhost(data: EventDragData, newTime: number, zoom: number): NLEGhostPos {
    return {
        left: newTime * zoom,
        width: data.isWaypoint ? 44 : data.startDuration * zoom,
        type: data.type,
        isWaypoint: data.isWaypoint,
    };
}

function findTargetTrackIndex(
    eventTracks: NLETrack[],
    trackEls: Map<string, HTMLDivElement>,
    clientY: number,
): number {
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < eventTracks.length; i++) {
        const el = trackEls.get(eventTracks[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(clientY - center);
        if (clientY >= rect.top && clientY < rect.bottom) return i;
        if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    return closest;
}

export function useNLEEventDrag(
    zoomRef: RefObject<number>,
    scrollLeftRef: RefObject<number>,
    setScroll: (x: number) => void,
    trackElsRef: RefObject<Map<string, HTMLDivElement>>,
    scrollBoundaryRef: RefObject<HTMLDivElement | null>,
    eventTracks: NLETrack[],
    selectedIds: Set<number>,
    getAllEvents: () => Map<string, TrackEvent[]>,
    onMoveEvents: (moves: NLEMoveResult[]) => void,
) {
    const [ghostsByTrack, setGhostsByTrack] = useState<Map<string, NLEGhostPos[]>>(new Map());
    const [draggingIds, setDraggingIds] = useState<Set<number>>(new Set());
    const moveDragRef = useRef<MoveDragState | null>(null);
    const targetTrackIndexRef = useRef(0);
    const scrollRafRef = useRef<number | null>(null);
    const scrollSpeedXRef = useRef(0);

    const stopAutoScroll = () => {
        scrollSpeedXRef.current = 0;
        if (scrollRafRef.current) {
            cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
        }
    };

    const handleMoveStart = useCallback((
        fromTrackId: string,
        eventId: number,
        e: ReactMouseEvent,
        time: number,
        duration: number,
    ) => {
        const allEvents = getAllEvents();
        const trackEvents = allEvents.get(fromTrackId);
        const event = trackEvents?.find((ev) => ev.id === eventId);
        if (!event) return;

        const trackIndex = eventTracks.findIndex((t) => t.id === fromTrackId);
        if (trackIndex === -1) return;

        const primary: EventDragData = {
            eventId,
            fromTrackId,
            startTime: time,
            startDuration: duration,
            type: event.type,
            isWaypoint: !event.resizable,
        };

        const isMultiMove =
            selectedIds.size > 1 && selectedIds.has(eventId);

        const companions: EventDragData[] = isMultiMove
            ? (() => {
                const results: EventDragData[] = [];
                for (const [tId, evs] of allEvents) {
                    const track = eventTracks.find((t) => t.id === tId);
                    if (!track) continue;
                    for (const ev of evs) {
                        if (ev.id !== eventId && selectedIds.has(ev.id)) {
                            results.push({
                                eventId: ev.id,
                                fromTrackId: tId,
                                startTime: ev.time,
                                startDuration: ev.duration ?? 0,
                                type: ev.type,
                                isWaypoint: !ev.resizable,
                            });
                        }
                    }
                }
                return results;
            })()
            : [];

        moveDragRef.current = {
            primary,
            companions,
            startX: e.clientX,
            startScrollLeft: scrollLeftRef.current,
            primaryTrackIndex: trackIndex,
        };
        targetTrackIndexRef.current = trackIndex;

        const zoom = zoomRef.current;
        const initialGhosts = new Map<string, NLEGhostPos[]>();
        initialGhosts.set(fromTrackId, [makeGhost(primary, time, zoom)]);
        for (const c of companions) {
            const existing = initialGhosts.get(c.fromTrackId) ?? [];
            existing.push(makeGhost(c, c.startTime, zoom));
            initialGhosts.set(c.fromTrackId, existing);
        }
        setGhostsByTrack(initialGhosts);
        setDraggingIds(new Set([primary.eventId, ...companions.map((c) => c.eventId)]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventTracks, selectedIds]);

    useEffect(() => {
        if (ghostsByTrack.size === 0) return;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            if (!drag) return;

            const zoom = zoomRef.current;
            const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
            const deltaX = (e.clientX - drag.startX) + scrollDelta;
            const deltaTime = deltaX / zoom;

            const newPrimaryIndex = findTargetTrackIndex(eventTracks, trackElsRef.current, e.clientY);
            targetTrackIndexRef.current = newPrimaryIndex;
            const indexDelta = newPrimaryIndex - drag.primaryTrackIndex;

            const newTime = Math.max(0, drag.primary.startTime + deltaTime);
            const primaryTrack = eventTracks[newPrimaryIndex];

            const nextGhosts = new Map<string, NLEGhostPos[]>();
            if (primaryTrack) {
                nextGhosts.set(primaryTrack.id, [makeGhost(drag.primary, newTime, zoom)]);
            }

            for (const c of drag.companions) {
                const cTrackIndex = Math.max(
                    0,
                    Math.min(
                        eventTracks.length - 1,
                        eventTracks.findIndex((t) => t.id === c.fromTrackId) + indexDelta,
                    ),
                );
                const cTrack = eventTracks[cTrackIndex];
                if (!cTrack) continue;
                const cTime = Math.max(0, c.startTime + deltaTime);
                const existing = nextGhosts.get(cTrack.id) ?? [];
                existing.push(makeGhost(c, cTime, zoom));
                nextGhosts.set(cTrack.id, existing);
            }
            setGhostsByTrack(nextGhosts);

            // Horizontal edge scroll
            const scrollAreaRect = scrollBoundaryRef.current?.getBoundingClientRect();
            if (scrollAreaRect) {
                const distRight = scrollAreaRect.right - e.clientX;
                const distLeft = e.clientX - scrollAreaRect.left;
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
                if (scrollSpeedXRef.current !== 0 && !scrollRafRef.current) {
                    const tick = () => {
                        setScroll(scrollLeftRef.current + scrollSpeedXRef.current);
                        scrollRafRef.current = scrollSpeedXRef.current !== 0
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
            if (!drag) {
                setGhostsByTrack(new Map());
                setDraggingIds(new Set());
                return;
            }

            const zoom = zoomRef.current;
            const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
            const deltaX = (e.clientX - drag.startX) + scrollDelta;
            const deltaTime = deltaX / zoom;

            const newPrimaryIndex = targetTrackIndexRef.current;
            const indexDelta = newPrimaryIndex - drag.primaryTrackIndex;
            const primaryTrack = eventTracks[newPrimaryIndex];

            const moves: NLEMoveResult[] = [];

            if (primaryTrack) {
                moves.push({
                    fromTrackId: drag.primary.fromTrackId,
                    toTrackId: primaryTrack.id,
                    eventId: drag.primary.eventId,
                    newTime: Math.max(0, drag.primary.startTime + deltaTime),
                });
            }

            for (const c of drag.companions) {
                const cTrackIndex = Math.max(
                    0,
                    Math.min(
                        eventTracks.length - 1,
                        eventTracks.findIndex((t) => t.id === c.fromTrackId) + indexDelta,
                    ),
                );
                const cTrack = eventTracks[cTrackIndex];
                if (!cTrack) continue;
                moves.push({
                    fromTrackId: c.fromTrackId,
                    toTrackId: cTrack.id,
                    eventId: c.eventId,
                    newTime: Math.max(0, c.startTime + deltaTime),
                });
            }

            onMoveEvents(moves);
            moveDragRef.current = null;
            setGhostsByTrack(new Map());
            setDraggingIds(new Set());
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            stopAutoScroll();
        };
    // eventTracks identity changes when trackGroups changes — primitive dependency not possible here,
    // so we depend on the array ref. The effect re-registers listeners when drag begins (ghostsByTrack.size > 0).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ghostsByTrack.size, eventTracks]);

    return { ghostsByTrack, draggingIds, handleMoveStart };
}

export { TrackType };
