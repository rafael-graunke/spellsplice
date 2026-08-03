import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { RefObject } from 'react';
import { PlayHead } from '@/assets/icons';
import type { Snapper } from './snapping';
import { resolvePlayheadTime } from './snapping';

/** Paired with the global cursor override in index.css. */
const DRAG_CLASS = 'playhead-dragging';

export interface CursorHandle {
    setPosition(px: number): void;
}

interface CursorProps {
    setIsPlaying: (playing: boolean) => void;
    scrollAreaRef: RefObject<HTMLDivElement | null>;
    onSeek: (t: number) => void;
    zoomRef: RefObject<number>;
    scrollLeftRef: RefObject<number>;
    paddingX: number;
    duration: number;
    createSnapper?: () => Snapper | null;
    onSnapTargetChange?: (t: number | null) => void;
}

const Cursor = forwardRef<CursorHandle, CursorProps>(
    function Cursor({ setIsPlaying, scrollAreaRef, onSeek, zoomRef, scrollLeftRef, paddingX, duration, createSnapper, onSnapTargetChange }, ref) {
        const lineRef = useRef<HTMLDivElement>(null);
        const handleRef = useRef<SVGSVGElement>(null);

        useImperativeHandle(ref, () => ({
            setPosition(px: number) {
                if (lineRef.current) lineRef.current.style.left = `${px}px`;
                if (handleRef.current) handleRef.current.style.left = `${px}px`;
            },
        }));

        // Unmounting mid-drag (a mode switch) would otherwise leave the whole
        // app stuck showing a resize cursor.
        useEffect(() => () => document.body.classList.remove(DRAG_CLASS), []);

        const startDrag = (e: React.PointerEvent) => {
            e.stopPropagation();
            // Also suppresses the compatibility mouse events, so the drag can't
            // double-fire through the handlers underneath.
            e.preventDefault();
            setIsPlaying(false);
            // Pointer capture keeps the col-resize cursor for the whole drag.
            // Without it the pointer picks up the cursor of whatever it passes
            // over — clips (grab), trim handles (ew-resize), ruler (pointer) —
            // and flickers between them.
            const target = e.currentTarget as Element;
            try {
                target.setPointerCapture(e.pointerId);
            } catch {
                // pointer capture unsupported / already released
            }
            document.body.classList.add(DRAG_CLASS);

            // Built once per drag: the target set is fixed while dragging, and
            // sorting it on every move would be wasted work.
            const snapper = createSnapper?.() ?? null;

            const onPointerMove = (e: PointerEvent) => {
                if (!scrollAreaRef.current) return;
                const rect = scrollAreaRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const raw = Math.max(0, Math.min(duration, (x - paddingX + scrollLeftRef.current) / zoomRef.current));
                const { time, target: snapped } = resolvePlayheadTime(raw, snapper, e.altKey);
                onSnapTargetChange?.(snapped);
                onSeek(time);
            };

            const onPointerUp = (e: PointerEvent) => {
                onSnapTargetChange?.(null);
                document.body.classList.remove(DRAG_CLASS);
                try {
                    target.releasePointerCapture(e.pointerId);
                } catch {
                    // already released by the browser
                }
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        };

        return (
            <div className="absolute inset-0 pointer-events-none z-20">
                <PlayHead
                    ref={handleRef}
                    className="size-6 cursor-col-resize absolute text-red-500 z-21 pointer-events-auto -translate-x-1/2"
                    fill="red"
                    onPointerDown={startDrag}
                />
                <div
                    ref={lineRef}
                    style={{ left: 0 }}
                    className="cursor-col-resize absolute top-0 bottom-0 -translate-x-[1px] w-[2px] bg-red-500 z-20 pointer-events-auto"
                    onPointerDown={startDrag}
                />
            </div>
        );
    }
);

export default Cursor;
