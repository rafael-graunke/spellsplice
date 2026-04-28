import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Diamond } from 'lucide-react';

export interface TimelineCursorHandle {
    setPosition(px: number): void;
}

interface TimelineCursorProps {
    setIsDragging: (dragging: boolean) => void;
    setIsPlaying: (playing: boolean) => void;
}

const TimelineCursor = forwardRef<TimelineCursorHandle, TimelineCursorProps>(
    function TimelineCursor({ setIsDragging, setIsPlaying }, ref) {
        const lineRef = useRef<HTMLDivElement>(null);
        const handleRef = useRef<SVGSVGElement>(null);

        useImperativeHandle(ref, () => ({
            setPosition(px: number) {
                if (lineRef.current) lineRef.current.style.left = `${px}px`;
                if (handleRef.current) handleRef.current.style.left = `${px - 9}px`;
            },
        }));

        return (
            <div id="timeline-cursor" className="absolute inset-0 pointer-events-none z-20">
                <Diamond
                    ref={handleRef}
                    style={{ left: 0 }}
                    className="top-1 cursor-col-resize absolute text-red-500 z-21 pointer-events-auto"
                    size={20}
                    fill="red"
                    onMouseDown={() => {
                        setIsDragging(true);
                        setIsPlaying(false);
                    }}
                />
                <div
                    ref={lineRef}
                    style={{ left: 0 }}
                    className="cursor-col-resize absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 pointer-events-auto"
                    onMouseDown={() => {
                        setIsDragging(true);
                        setIsPlaying(false);
                    }}
                />
            </div>
        );
    }
);

export default TimelineCursor;
