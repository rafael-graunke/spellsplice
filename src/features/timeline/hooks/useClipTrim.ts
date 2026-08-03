import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { Clip } from '../../../types/clip';
import { ClipColorMap } from '../../../types/clip';
import type { Snapper } from '../snapping';
import type { TrimEdge } from '../editOps';
import { trimClip } from '../editOps';

export interface TrimGhost {
    trackId: string;
    left: number;
    width: number;
    color: string;
    /** Edge stopped against the end of the source media. */
    atMediaLimit: boolean;
}

export interface TrimCommit {
    clipId: string;
    edge: TrimEdge;
    desiredTime: number;
    sourceDuration: number;
    ripple: boolean;
}

interface TrimState {
    clip: Clip;
    trackId: string;
    edge: TrimEdge;
    startX: number;
    startScrollLeft: number;
    sourceDuration: number;
    neighbours: Clip[];
    snapper: Snapper | null;
    desiredTime: number;
    ripple: boolean;
    moved: boolean;
}

/**
 * Edge-drag trimming. Ripple (Ctrl/Cmd held) is read live at mouseup so the
 * user can decide after starting the drag, matching how NLE trim modifiers work.
 */
export function useClipTrim(
    zoomRef: RefObject<number>,
    scrollLeftRef: RefObject<number>,
    createSnapper: (excludeClipIds: Set<string>) => Snapper | null,
    onCommit: (commit: TrimCommit) => void,
) {
    const [ghost, setGhost] = useState<TrimGhost | null>(null);
    const [snapTarget, setSnapTarget] = useState<number | null>(null);
    const [trimmingClipId, setTrimmingClipId] = useState<string | null>(null);
    const stateRef = useRef<TrimState | null>(null);
    const onCommitRef = useRef(onCommit);
    const createSnapperRef = useRef(createSnapper);
    // Written after commit rather than during render: the drag handlers below
    // only ever run from user events, so they always see the latest value.
    useEffect(() => {
        onCommitRef.current = onCommit;
        createSnapperRef.current = createSnapper;
    });

    const handleTrimStart = useCallback((
        trackId: string,
        clip: Clip,
        edge: TrimEdge,
        e: ReactMouseEvent,
        sourceDuration: number,
        neighbours: Clip[],
    ) => {
        e.stopPropagation();
        e.preventDefault();
        stateRef.current = {
            clip,
            trackId,
            edge,
            startX: e.clientX,
            startScrollLeft: scrollLeftRef.current,
            sourceDuration,
            neighbours,
            snapper: createSnapperRef.current(new Set([clip.id])),
            desiredTime: edge === 'start' ? clip.time : clip.time + clip.duration,
            ripple: false,
            moved: false,
        };
        setTrimmingClipId(clip.id);
    }, [scrollLeftRef]);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            const st = stateRef.current;
            if (!st) return;
            const zoom = zoomRef.current;
            const deltaX = (e.clientX - st.startX) + (scrollLeftRef.current - st.startScrollLeft);
            if (!st.moved && Math.abs(deltaX) < 2) return;
            st.moved = true;

            const anchor = st.edge === 'start' ? st.clip.time : st.clip.time + st.clip.duration;
            let desired = anchor + deltaX / zoom;
            let target: number | null = null;
            if (st.snapper && !e.altKey) {
                const snap = st.snapper([desired]);
                desired += snap.delta;
                target = snap.target;
            }
            st.desiredTime = desired;
            st.ripple = e.ctrlKey || e.metaKey;

            const next = trimClip(st.clip, st.edge, desired, st.sourceDuration, st.neighbours);
            setGhost({
                trackId: st.trackId,
                left: next.time * zoom,
                width: next.duration * zoom,
                color: ClipColorMap[st.clip.type].bg,
                atMediaLimit: next.atMediaLimit,
            });
            setSnapTarget(target);
        };

        const onMouseUp = (e: MouseEvent) => {
            const st = stateRef.current;
            stateRef.current = null;
            setGhost(null);
            setSnapTarget(null);
            setTrimmingClipId(null);
            if (!st || !st.moved) return;
            onCommitRef.current({
                clipId: st.clip.id,
                edge: st.edge,
                desiredTime: st.desiredTime,
                sourceDuration: st.sourceDuration,
                ripple: e.ctrlKey || e.metaKey,
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [zoomRef, scrollLeftRef]);

    return { trimGhost: ghost, trimSnapTarget: snapTarget, trimmingClipId, handleTrimStart };
}
