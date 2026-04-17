import { useRef, useState } from 'react';
import { zoomToPercent } from './hooks/useZoom';

interface TimelineRulerProps {
    duration: number;
    zoom: number;
    onSeek: (time: number) => void;
    onScrollDelta: (deltaX: number) => void;
}

function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function TimelineRuler({ duration, zoom, onSeek, onScrollDelta }: TimelineRulerProps) {
    const rulerRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
    const [grabbing, setGrabbing] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setGrabbing(true);
        dragRef.current = { startX: e.clientX, moved: false };

        const onMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            const delta = e.clientX - dragRef.current.startX;
            if (Math.abs(delta) > 4) dragRef.current.moved = true;
            if (dragRef.current.moved) {
                onScrollDelta(delta);
                dragRef.current.startX = e.clientX;
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (dragRef.current && !dragRef.current.moved && rulerRef.current) {
                const x = e.clientX - rulerRef.current.getBoundingClientRect().left;
                onSeek(Math.max(0, Math.min(duration, x / zoom)));
            }
            dragRef.current = null;
            setGrabbing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    return (
        <div
            ref={rulerRef}
            className={`relative h-10 select-none ${grabbing ? 'cursor-grabbing' : 'cursor-pointer'}`}
            style={{ width: duration * zoom }}
            onMouseDown={handleMouseDown}
        >
            {(() => {
                const zp = zoomToPercent(zoom);
                const tickInterval = zp < 15 ? 5 : 1;
                const labelInterval = zp < 15 ? 10 : zp < 80 ? 5 : 1;
                return Array.from(
                    { length: Math.floor(duration / tickInterval) + 1 },
                    (_, i) => i * tickInterval,
                ).map((t) => {
                    const hasLabel = t % labelInterval === 0;
                    return (
                        <div
                            key={t}
                            className={`absolute top-0 border-l border-zinc-700 text-xs text-zinc-400 ${hasLabel ? 'h-5' : 'h-3'}`}
                            style={{ left: t * zoom }}
                        >
                            {hasLabel && (
                                <span className="absolute top-5 left-1/2 -translate-x-1/2">
                                    {formatTime(t)}
                                </span>
                            )}
                        </div>
                    );
                });
            })()}
        </div>
    );
}

export default TimelineRuler;
