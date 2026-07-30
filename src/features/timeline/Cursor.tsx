import { useRef, useImperativeHandle, forwardRef } from 'react';
import type { RefObject } from 'react';
import { PlayHead } from '@/assets/icons';

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
}

const Cursor = forwardRef<CursorHandle, CursorProps>(
    function Cursor({ setIsPlaying, scrollAreaRef, onSeek, zoomRef, scrollLeftRef, paddingX, duration }, ref) {
        const lineRef = useRef<HTMLDivElement>(null);
        const handleRef = useRef<SVGSVGElement>(null);

        useImperativeHandle(ref, () => ({
            setPosition(px: number) {
                if (lineRef.current) lineRef.current.style.left = `${px}px`;
                if (handleRef.current) handleRef.current.style.left = `${px}px`;
            },
        }));

        const startDrag = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsPlaying(false);

            const onMouseMove = (e: MouseEvent) => {
                if (!scrollAreaRef.current) return;
                const rect = scrollAreaRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const t = Math.max(0, Math.min(duration, (x - paddingX + scrollLeftRef.current) / zoomRef.current));
                onSeek(t);
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        };

        return (
            <div className="absolute inset-0 pointer-events-none z-20">
                <PlayHead
                    ref={handleRef}
                    className="size-6 cursor-col-resize absolute text-red-500 z-21 pointer-events-auto -translate-x-1/2"
                    fill="red"
                    onMouseDown={startDrag}
                />
                <div
                    ref={lineRef}
                    style={{ left: 0 }}
                    className="cursor-col-resize absolute top-0 bottom-0 -translate-x-[1px] w-[2px] bg-red-500 z-20 pointer-events-auto"
                    onMouseDown={startDrag}
                />
            </div>
        );
    }
);

export default Cursor;
