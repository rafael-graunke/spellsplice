import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { Clip, ClipType } from '../../types/clip';
import { ClipColorMap } from '../../types/clip';
import type { NLETrack } from '../../types/nle';

const SCROLL_ZONE = 30;
const MAX_SCROLL_SPEED = 10;

export interface NLEClipGhostPos {
    left: number;
    width: number;
    color: string;
}

export interface ClipMoveResult {
    clipId: string;
    fromTrackId: string;
    toTrackId: string;
    newTime: number;
}

interface ClipDragData {
    clip: Clip;
    fromTrackId: string;
    clipType: ClipType;
}

interface ClipMoveDragState {
    data: ClipDragData;
    startX: number;
    startY: number;
    startScrollLeft: number;
    primaryTrackIndex: number;
}

/** Returns the nearest start time that fits the clip (given duration) without overlapping other clips. */
function clampClipTime(time: number, duration: number, others: Clip[]): number {
    const start = Math.max(0, time);
    const end = start + duration;

    for (const other of others) {
        const os = other.time;
        const oe = os + other.duration;
        // Check overlap: [start, end) intersects [os, oe)
        if (start < oe && end > os) {
            // Snap to whichever side is closer
            const distLeft = Math.abs(start - oe); // snap right edge of other to our left
            const distRight = Math.abs(end - os);  // snap left edge of other to our right
            if (distLeft <= distRight) {
                return Math.max(0, oe);
            } else {
                return Math.max(0, os - duration);
            }
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
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(clientY - center);
        if (clientY >= rect.top && clientY < rect.bottom) return i;
        if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    return closest;
}

export function useNLEClipDrag(
    zoomRef: RefObject<number>,
    scrollLeftRef: RefObject<number>,
    setScroll: (x: number) => void,
    trackElsRef: RefObject<Map<string, HTMLDivElement>>,
    scrollBoundaryRef: RefObject<HTMLDivElement | null>,
    videoTracks: NLETrack[],
    audioTracks: NLETrack[],
    onMoveClips: (moves: ClipMoveResult[]) => void,
) {
    const [clipGhostsByTrack, setClipGhostsByTrack] = useState<Map<string, NLEClipGhostPos[]>>(new Map());
    const clipGhostsByTrackRef = useRef(clipGhostsByTrack);
    clipGhostsByTrackRef.current = clipGhostsByTrack;
    const [draggingClipIds, setDraggingClipIds] = useState<Set<string>>(new Set());
    const moveDragRef = useRef<ClipMoveDragState | null>(null);
    const targetTrackIndexRef = useRef(0);
    const scrollRafRef = useRef<number | null>(null);
    const scrollSpeedXRef = useRef(0);

    const videoTracksRef = useRef(videoTracks);
    videoTracksRef.current = videoTracks;
    const audioTracksRef = useRef(audioTracks);
    audioTracksRef.current = audioTracks;

    const stopAutoScroll = () => {
        scrollSpeedXRef.current = 0;
        if (scrollRafRef.current) {
            cancelAnimationFrame(scrollRafRef.current);
            scrollRafRef.current = null;
        }
    };

    const handleClipMoveStart = useCallback((
        fromTrackId: string,
        clip: Clip,
        e: ReactMouseEvent,
    ) => {
        const tracks = clip.type === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current;
        const trackIndex = tracks.findIndex((t) => t.id === fromTrackId);
        if (trackIndex === -1) return;

        moveDragRef.current = {
            data: { clip, fromTrackId, clipType: clip.type },
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

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            if (!drag) return;

            const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
            const rawDeltaX = (e.clientX - drag.startX) + scrollDelta;
            const rawDeltaY = e.clientY - drag.startY;

            if (
                clipGhostsByTrackRef.current.size === 0 &&
                Math.abs(rawDeltaX) < DRAG_THRESHOLD &&
                Math.abs(rawDeltaY) < DRAG_THRESHOLD
            ) return;

            const zoom = zoomRef.current;
            const deltaTime = rawDeltaX / zoom;

            if (clipGhostsByTrackRef.current.size === 0) {
                setDraggingClipIds(new Set([drag.data.clip.id]));
            }

            const tracks = drag.data.clipType === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current;
            const newIndex = findTargetTrackIndex(tracks, trackElsRef.current, e.clientY);
            targetTrackIndexRef.current = newIndex;
            const targetTrack = tracks[newIndex];

            const rawTime = Math.max(0, drag.data.clip.time + deltaTime);
            const othersOnTarget = (targetTrack?.clips ?? []).filter(c => c.id !== drag.data.clip.id);
            const clampedTime = clampClipTime(rawTime, drag.data.clip.duration, othersOnTarget);

            const nextGhosts = new Map<string, NLEClipGhostPos[]>();
            if (targetTrack) {
                nextGhosts.set(targetTrack.id, [{
                    left: clampedTime * zoom,
                    width: drag.data.clip.duration * zoom,
                    color: ClipColorMap[drag.data.clipType],
                }]);
            }
            setClipGhostsByTrack(nextGhosts);

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
            if (!drag) return;

            if (clipGhostsByTrackRef.current.size > 0) {
                const zoom = zoomRef.current;
                const scrollDelta = scrollLeftRef.current - drag.startScrollLeft;
                const deltaX = (e.clientX - drag.startX) + scrollDelta;
                const deltaTime = deltaX / zoom;

                const tracks = drag.data.clipType === 'VIDEO' ? videoTracksRef.current : audioTracksRef.current;
                const newIndex = targetTrackIndexRef.current;
                const targetTrack = tracks[newIndex];

                if (targetTrack) {
                    const rawTime = Math.max(0, drag.data.clip.time + deltaTime);
                    const othersOnTarget = (targetTrack.clips ?? []).filter(c => c.id !== drag.data.clip.id);
                    const clampedTime = clampClipTime(rawTime, drag.data.clip.duration, othersOnTarget);

                    onMoveClips([{
                        clipId: drag.data.clip.id,
                        fromTrackId: drag.data.fromTrackId,
                        toTrackId: targetTrack.id,
                        newTime: clampedTime,
                    }]);
                }
            }

            moveDragRef.current = null;
            setClipGhostsByTrack(new Map());
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

    return { clipGhostsByTrack, draggingClipIds, handleClipMoveStart };
}
