import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { EventType } from '../../types/event';
import type { NLETrack } from '../../types/nle';
import type { Clip, ClipType } from '../../types/clip';
import { ClipColorMap } from '../../types/clip';
import type { NLEGhostPos, NLEMoveResult, NLEClipGhostPos, ClipMoveResult } from './nleHookTypes';

export type { NLEGhostPos, NLEMoveResult, NLEClipGhostPos, ClipMoveResult };

const SCROLL_ZONE = 30;
const MAX_SCROLL_SPEED = 10;

type EventElement = {
    kind: 'event';
    id: number;
    fromTrackId: string;
    startTime: number;
    duration: number;
    type: EventType;
    isWaypoint: boolean;
};

type ClipElement = {
    kind: 'clip';
    id: string;
    fromTrackId: string;
    startTime: number;
    duration: number;
    clipType: ClipType;
};

type DragElement = EventElement | ClipElement;

interface ElementDragState {
    primary: DragElement;
    companions: DragElement[];
    startX: number;
    startY: number;
    startScrollLeft: number;
    primaryTrackIndex: number;
}

function makeEventGhost(el: EventElement, newTime: number, zoom: number): NLEGhostPos {
    return {
        left: newTime * zoom,
        width: el.isWaypoint ? 44 : el.duration * zoom,
        type: el.type,
        isWaypoint: el.isWaypoint,
    };
}

function makeClipGhost(el: ClipElement, newTime: number, zoom: number): NLEClipGhostPos {
    return {
        left: newTime * zoom,
        width: el.duration * zoom,
        color: ClipColorMap[el.clipType],
    };
}

function clampClipTime(time: number, duration: number, others: Clip[]): number {
    const start = Math.max(0, time);
    const end = start + duration;
    for (const other of others) {
        const os = other.time;
        const oe = os + other.duration;
        if (start < oe && end > os) {
            const distLeft = Math.abs(start - oe);
            const distRight = Math.abs(end - os);
            return distLeft <= distRight ? Math.max(0, oe) : Math.max(0, os - duration);
        }
    }
    return start;
}

function findTargetTrackIndex(
    tracks: NLETrack[],
    trackEls: Map<string, HTMLDivElement>,
    clientY: number,
): number {
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < tracks.length; i++) {
        const el = trackEls.get(tracks[i].id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY >= rect.top && clientY < rect.bottom) return i;
        const dist = Math.abs(clientY - (rect.top + rect.height / 2));
        if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    return closest;
}

export function useNLEElementDrag(
    zoomRef: RefObject<number>,
    scrollLeftRef: RefObject<number>,
    setScroll: (x: number) => void,
    trackElsRef: RefObject<Map<string, HTMLDivElement>>,
    scrollBoundaryRef: RefObject<HTMLDivElement | null>,
    eventTracks: NLETrack[],
    videoTracks: NLETrack[],
    audioTracks: NLETrack[],
    selectedEventIds: Set<number>,
    selectedClipIds: Set<string>,
    onMoveEvents: (moves: NLEMoveResult[]) => void,
    onMoveClips: (moves: ClipMoveResult[]) => void,
) {
    const [eventGhostsByTrack, setEventGhostsByTrack] = useState<Map<string, NLEGhostPos[]>>(new Map());
    const eventGhostsByTrackRef = useRef(eventGhostsByTrack);
    eventGhostsByTrackRef.current = eventGhostsByTrack;

    const [clipGhostsByTrack, setClipGhostsByTrack] = useState<Map<string, NLEClipGhostPos[]>>(new Map());
    const clipGhostsByTrackRef = useRef(clipGhostsByTrack);
    clipGhostsByTrackRef.current = clipGhostsByTrack;

    const [draggingEventIds, setDraggingEventIds] = useState<Set<number>>(new Set());
    const [draggingClipIds, setDraggingClipIds] = useState<Set<string>>(new Set());

    const moveDragRef = useRef<ElementDragState | null>(null);
    const targetTrackIndexRef = useRef(0);
    const scrollRafRef = useRef<number | null>(null);
    const scrollSpeedXRef = useRef(0);

    const selectedEventIdsRef = useRef(selectedEventIds);
    selectedEventIdsRef.current = selectedEventIds;
    const selectedClipIdsRef = useRef(selectedClipIds);
    selectedClipIdsRef.current = selectedClipIds;

    const eventTracksRef = useRef(eventTracks);
    eventTracksRef.current = eventTracks;
    const videoTracksRef = useRef(videoTracks);
    videoTracksRef.current = videoTracks;
    const audioTracksRef = useRef(audioTracks);
    audioTracksRef.current = audioTracks;

    const onMoveEventsRef = useRef(onMoveEvents);
    onMoveEventsRef.current = onMoveEvents;
    const onMoveClipsRef = useRef(onMoveClips);
    onMoveClipsRef.current = onMoveClips;

    const stopAutoScroll = () => {
        scrollSpeedXRef.current = 0;
        if (scrollRafRef.current) {
            cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
        }
    };

    const handleEventDragStart = useCallback((
        fromTrackId: string,
        eventId: number,
        e: ReactMouseEvent,
        time: number,
        duration: number,
    ) => {
        const track = eventTracksRef.current.find((t) => t.id === fromTrackId);
        const event = track?.events.find((ev) => ev.id === eventId);
        if (!event) return;

        const trackIndex = eventTracksRef.current.findIndex((t) => t.id === fromTrackId);
        if (trackIndex === -1) return;

        const primary: EventElement = {
            kind: 'event',
            id: eventId,
            fromTrackId,
            startTime: time,
            duration,
            type: event.type,
            isWaypoint: !event.resizable,
        };

        const currentEventIds = selectedEventIdsRef.current;
        const currentClipIds = selectedClipIdsRef.current;
        const isInSelection = currentEventIds.has(eventId);

        const companions: DragElement[] = [];
        if (isInSelection) {
            for (const t of eventTracksRef.current) {
                for (const ev of t.events) {
                    if (ev.id !== eventId && currentEventIds.has(ev.id)) {
                        companions.push({
                            kind: 'event',
                            id: ev.id,
                            fromTrackId: t.id,
                            startTime: ev.time,
                            duration: ev.duration ?? 0,
                            type: ev.type,
                            isWaypoint: !ev.resizable,
                        });
                    }
                }
            }
            for (const trackGroup of [videoTracksRef.current, audioTracksRef.current]) {
                for (const t of trackGroup) {
                    for (const clip of t.clips ?? []) {
                        if (currentClipIds.has(clip.id)) {
                            companions.push({
                                kind: 'clip',
                                id: clip.id,
                                fromTrackId: t.id,
                                startTime: clip.time,
                                duration: clip.duration,
                                clipType: clip.type,
                            });
                        }
                    }
                }
            }
        }

        moveDragRef.current = {
            primary,
            companions,
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: scrollLeftRef.current,
            primaryTrackIndex: trackIndex,
        };
        targetTrackIndexRef.current = trackIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClipDragStart = useCallback((
        fromTrackId: string,
        clip: Clip,
        e: ReactMouseEvent,
    ) => {
        const tracks = clip.type === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current;
        const trackIndex = tracks.findIndex((t) => t.id === fromTrackId);
        if (trackIndex === -1) return;

        const primary: ClipElement = {
            kind: 'clip',
            id: clip.id,
            fromTrackId,
            startTime: clip.time,
            duration: clip.duration,
            clipType: clip.type,
        };

        const currentClipIds = selectedClipIdsRef.current;
        const currentEventIds = selectedEventIdsRef.current;
        const isInSelection = currentClipIds.has(clip.id);

        const companions: DragElement[] = [];
        if (isInSelection) {
            for (const trackGroup of [videoTracksRef.current, audioTracksRef.current]) {
                for (const t of trackGroup) {
                    for (const c of t.clips ?? []) {
                        if (c.id !== clip.id && currentClipIds.has(c.id)) {
                            companions.push({
                                kind: 'clip',
                                id: c.id,
                                fromTrackId: t.id,
                                startTime: c.time,
                                duration: c.duration,
                                clipType: c.type,
                            });
                        }
                    }
                }
            }
            for (const t of eventTracksRef.current) {
                for (const ev of t.events) {
                    if (currentEventIds.has(ev.id)) {
                        companions.push({
                            kind: 'event',
                            id: ev.id,
                            fromTrackId: t.id,
                            startTime: ev.time,
                            duration: ev.duration ?? 0,
                            type: ev.type,
                            isWaypoint: !ev.resizable,
                        });
                    }
                }
            }
        }

        moveDragRef.current = {
            primary,
            companions,
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: scrollLeftRef.current,
            primaryTrackIndex: trackIndex,
        };
        targetTrackIndexRef.current = trackIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const DRAG_THRESHOLD = 4;

        const isDragging = () =>
            eventGhostsByTrackRef.current.size > 0 || clipGhostsByTrackRef.current.size > 0;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            if (!drag) return;

            const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
            const rawDeltaX = (e.clientX - drag.startX) + scrollDelta;
            const rawDeltaY = e.clientY - drag.startY;

            if (
                !isDragging() &&
                Math.abs(rawDeltaX) < DRAG_THRESHOLD &&
                Math.abs(rawDeltaY) < DRAG_THRESHOLD
            ) return;

            const zoom = zoomRef.current;
            const deltaTime = rawDeltaX / zoom;
            const allElements = [drag.primary, ...drag.companions];
            const minStartTime = Math.min(...allElements.map((el) => el.startTime));
            const clampedDeltaTime = Math.max(deltaTime, -minStartTime);

            if (!isDragging()) {
                const eventIds = new Set<number>();
                const clipIds = new Set<string>();
                if (drag.primary.kind === 'event') eventIds.add(drag.primary.id);
                else clipIds.add(drag.primary.id);
                for (const c of drag.companions) {
                    if (c.kind === 'event') eventIds.add(c.id);
                    else clipIds.add(c.id);
                }
                setDraggingEventIds(eventIds);
                setDraggingClipIds(clipIds);
            }

            let newPrimaryIndex: number;
            let primaryTargetTrack: NLETrack | undefined;
            let indexDelta: number;

            if (drag.primary.kind === 'event') {
                const desiredIndex = findTargetTrackIndex(eventTracksRef.current, trackElsRef.current, e.clientY);
                const rawDelta = desiredIndex - drag.primaryTrackIndex;
                const companionEventIndices = drag.companions
                    .filter((c) => c.kind === 'event')
                    .map((c) => eventTracksRef.current.findIndex((t) => t.id === c.fromTrackId))
                    .filter((i) => i !== -1);
                const allIndices = [drag.primaryTrackIndex, ...companionEventIndices];
                const minIdx = Math.min(...allIndices);
                const maxIdx = Math.max(...allIndices);
                const trackCount = eventTracksRef.current.length;
                indexDelta = Math.max(Math.min(rawDelta, trackCount - 1 - maxIdx), -minIdx);
                newPrimaryIndex = drag.primaryTrackIndex + indexDelta;
                primaryTargetTrack = eventTracksRef.current[newPrimaryIndex];
            } else {
                newPrimaryIndex = findTargetTrackIndex(
                    drag.primary.clipType === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current,
                    trackElsRef.current,
                    e.clientY,
                );
                indexDelta = newPrimaryIndex - drag.primaryTrackIndex;
                primaryTargetTrack = (drag.primary.clipType === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current)[newPrimaryIndex];
            }
            targetTrackIndexRef.current = newPrimaryIndex;

            const nextEventGhosts = new Map<string, NLEGhostPos[]>();
            const nextClipGhosts = new Map<string, NLEClipGhostPos[]>();

            if (primaryTargetTrack) {
                if (drag.primary.kind === 'event') {
                    const newTime = drag.primary.startTime + clampedDeltaTime;
                    nextEventGhosts.set(primaryTargetTrack.id, [makeEventGhost(drag.primary, newTime, zoom)]);
                } else {
                    const rawTime = Math.max(0, drag.primary.startTime + clampedDeltaTime);
                    const othersOnTarget = (primaryTargetTrack.clips ?? []).filter((c) => c.id !== (drag.primary as ClipElement).id);
                    const clampedTime = clampClipTime(rawTime, drag.primary.duration, othersOnTarget);
                    nextClipGhosts.set(primaryTargetTrack.id, [makeClipGhost(drag.primary, clampedTime, zoom)]);
                }
            }

            for (const c of drag.companions) {
                if (c.kind === 'event') {
                    let targetTrackId = c.fromTrackId;
                    if (drag.primary.kind === 'event') {
                        const cIdx = eventTracksRef.current.findIndex((t) => t.id === c.fromTrackId);
                        const cTrack = eventTracksRef.current[cIdx + indexDelta];
                        if (!cTrack) continue;
                        targetTrackId = cTrack.id;
                    }
                    const cTime = c.startTime + clampedDeltaTime;
                    const existing = nextEventGhosts.get(targetTrackId) ?? [];
                    existing.push(makeEventGhost(c, cTime, zoom));
                    nextEventGhosts.set(targetTrackId, existing);
                } else {
                    const cTime = Math.max(0, c.startTime + clampedDeltaTime);
                    const existing = nextClipGhosts.get(c.fromTrackId) ?? [];
                    existing.push(makeClipGhost(c, cTime, zoom));
                    nextClipGhosts.set(c.fromTrackId, existing);
                }
            }

            setEventGhostsByTrack(nextEventGhosts);
            setClipGhostsByTrack(nextClipGhosts);

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
            if (!drag) return;

            if (isDragging()) {
                const zoom = zoomRef.current;
                const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
                const deltaX = (e.clientX - drag.startX) + scrollDelta;
                const deltaTime = deltaX / zoom;
                const allElements = [drag.primary, ...drag.companions];
                const minStartTime = Math.min(...allElements.map((el) => el.startTime));
                const clampedDeltaTime = Math.max(deltaTime, -minStartTime);

                const newPrimaryIndex = targetTrackIndexRef.current;
                let indexDelta = newPrimaryIndex - drag.primaryTrackIndex;

                if (drag.primary.kind === 'event') {
                    const companionEventIndices = drag.companions
                        .filter((c) => c.kind === 'event')
                        .map((c) => eventTracksRef.current.findIndex((t) => t.id === c.fromTrackId))
                        .filter((i) => i !== -1);
                    const allIndices = [drag.primaryTrackIndex, ...companionEventIndices];
                    const minIdx = Math.min(...allIndices);
                    const maxIdx = Math.max(...allIndices);
                    const trackCount = eventTracksRef.current.length;
                    indexDelta = Math.max(Math.min(indexDelta, trackCount - 1 - maxIdx), -minIdx);
                }

                const eventMoves: NLEMoveResult[] = [];
                const clipMoves: ClipMoveResult[] = [];

                if (drag.primary.kind === 'event') {
                    const primaryTrack = eventTracksRef.current[newPrimaryIndex];
                    if (primaryTrack) {
                        eventMoves.push({
                            fromTrackId: drag.primary.fromTrackId,
                            toTrackId: primaryTrack.id,
                            eventId: drag.primary.id,
                            newTime: drag.primary.startTime + clampedDeltaTime,
                        });
                    }
                } else {
                    const tracks = drag.primary.clipType === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current;
                    const primaryTrack = tracks[newPrimaryIndex];
                    if (primaryTrack) {
                        const rawTime = Math.max(0, drag.primary.startTime + clampedDeltaTime);
                        const othersOnTarget = (primaryTrack.clips ?? []).filter((c) => c.id !== (drag.primary as ClipElement).id);
                        const clampedTime = clampClipTime(rawTime, drag.primary.duration, othersOnTarget);
                        clipMoves.push({
                            clipId: drag.primary.id,
                            fromTrackId: drag.primary.fromTrackId,
                            toTrackId: primaryTrack.id,
                            newTime: clampedTime,
                        });
                    }
                }

                for (const c of drag.companions) {
                    if (c.kind === 'event') {
                        let toTrackId = c.fromTrackId;
                        if (drag.primary.kind === 'event') {
                            const cIdx = eventTracksRef.current.findIndex((t) => t.id === c.fromTrackId);
                            const cTrack = eventTracksRef.current[cIdx + indexDelta];
                            if (!cTrack) continue;
                            toTrackId = cTrack.id;
                        }
                        eventMoves.push({
                            fromTrackId: c.fromTrackId,
                            toTrackId,
                            eventId: c.id,
                            newTime: c.startTime + clampedDeltaTime,
                        });
                    } else {
                        clipMoves.push({
                            clipId: c.id,
                            fromTrackId: c.fromTrackId,
                            toTrackId: c.fromTrackId,
                            newTime: Math.max(0, c.startTime + clampedDeltaTime),
                        });
                    }
                }

                if (eventMoves.length > 0) onMoveEventsRef.current(eventMoves);
                if (clipMoves.length > 0) onMoveClipsRef.current(clipMoves);
            }

            moveDragRef.current = null;
            setEventGhostsByTrack(new Map());
            setClipGhostsByTrack(new Map());
            setDraggingEventIds(new Set());
            setDraggingClipIds(new Set());
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            stopAutoScroll();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        eventGhostsByTrack,
        clipGhostsByTrack,
        draggingEventIds,
        draggingClipIds,
        handleEventDragStart,
        handleClipDragStart,
    };
}
