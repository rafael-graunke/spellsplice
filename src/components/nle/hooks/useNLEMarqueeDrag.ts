import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { NLETrack } from '../../types/nle';
interface MarqueeRect { x: number; y: number; w: number; h: number; }

const HYSTERESIS = 5;

export function useNLEMarqueeDrag(
    scrollBoundaryRef: RefObject<HTMLDivElement | null>,
    trackElsRef: RefObject<Map<string, HTMLDivElement>>,
    eventTracks: NLETrack[],
    clipTracks: NLETrack[],
    zoomRef: RefObject<number>,
    scrollLeftRef: RefObject<number>,
    onSelectMany: (eventIds: number[], clipIds: string[]) => void,
    onDeselectAll: () => void,
    infoWidth: number,
    paddingX: number,
): { marqueeRect: MarqueeRect | null; handleMarqueeMouseDown: (e: React.MouseEvent) => void } {
    const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
    const stateRef = useRef<{ startX: number; startY: number; active: MarqueeRect | null } | null>(null);

    const ctxRef = useRef({ eventTracks, clipTracks, zoomRef, scrollLeftRef, onSelectMany, onDeselectAll, infoWidth, paddingX });
    ctxRef.current = { eventTracks, clipTracks, zoomRef, scrollLeftRef, onSelectMany, onDeselectAll, infoWidth, paddingX };

    const handleMarqueeMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const boundary = scrollBoundaryRef.current;
        if (!boundary) return;
        const br = boundary.getBoundingClientRect();
        stateRef.current = { startX: e.clientX - br.left, startY: e.clientY - br.top, active: null };

        const onMouseMove = (ev: MouseEvent) => {
            const s = stateRef.current;
            const b = scrollBoundaryRef.current?.getBoundingClientRect();
            if (!s || !b) return;
            const cx = ev.clientX - b.left;
            const cy = ev.clientY - b.top;
            const dx = cx - s.startX;
            const dy = cy - s.startY;
            if (Math.abs(dx) < HYSTERESIS && Math.abs(dy) < HYSTERESIS) return;
            const r: MarqueeRect = {
                x: dx >= 0 ? s.startX : cx,
                y: dy >= 0 ? s.startY : cy,
                w: Math.abs(dx),
                h: Math.abs(dy),
            };
            s.active = r;
            setMarqueeRect(r);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            const s = stateRef.current;
            stateRef.current = null;
            setMarqueeRect(null);

            const rect = s?.active;
            if (!rect || !scrollBoundaryRef.current) return;

            const { eventTracks, clipTracks, zoomRef, scrollLeftRef, onSelectMany, onDeselectAll, infoWidth, paddingX } = ctxRef.current;
            const b = scrollBoundaryRef.current.getBoundingClientRect();
            const mx1 = rect.x, mx2 = rect.x + rect.w;
            const my1 = rect.y, my2 = rect.y + rect.h;
            const zoom = zoomRef.current;
            const scrollLeft = scrollLeftRef.current;
            const contentLeft = infoWidth + paddingX;
            const matchedEvents: number[] = [];
            const matchedClips: string[] = [];

            for (const track of eventTracks) {
                const trackEl = trackElsRef.current.get(track.id);
                if (!trackEl) continue;
                const tr = trackEl.getBoundingClientRect();
                const top = tr.top - b.top;
                const bottom = tr.bottom - b.top;
                if (bottom <= my1 || top >= my2) continue;

                for (const ev of track.events) {
                    let evL: number, evR: number;
                    if (ev.resizable) {
                        evL = contentLeft + ev.time * zoom - scrollLeft;
                        evR = evL + (ev.duration ?? 1) * zoom;
                    } else {
                        const cx = contentLeft + ev.time * zoom - scrollLeft;
                        evL = cx - 22;
                        evR = cx + 22;
                    }
                    if (evR >= mx1 && evL <= mx2) matchedEvents.push(ev.id);
                }
            }

            for (const track of clipTracks) {
                const trackEl = trackElsRef.current.get(track.id);
                if (!trackEl) continue;
                const tr = trackEl.getBoundingClientRect();
                const top = tr.top - b.top;
                const bottom = tr.bottom - b.top;
                if (bottom <= my1 || top >= my2) continue;

                for (const clip of track.clips ?? []) {
                    const clipL = contentLeft + clip.time * zoom - scrollLeft;
                    const clipR = clipL + clip.duration * zoom;
                    if (clipR >= mx1 && clipL <= mx2) matchedClips.push(clip.id);
                }
            }

            if (matchedEvents.length > 0 || matchedClips.length > 0) onSelectMany(matchedEvents, matchedClips);
            else onDeselectAll();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [scrollBoundaryRef, trackElsRef]);

    return { marqueeRect, handleMarqueeMouseDown };
}
