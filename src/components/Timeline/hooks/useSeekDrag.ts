import { useEffect, useState } from 'react';
import type { RefObject, SetStateAction } from 'react';

export function useSeekDrag(
    innerRef: RefObject<HTMLDivElement | null>,
    zoom: number,
    duration: number,
    setCurrentTime: (t: SetStateAction<number>) => void
) {
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const inner = innerRef.current;
            if (!inner) return;
            const x = e.clientX - inner.getBoundingClientRect().left;
            setCurrentTime(Math.max(0, Math.min(duration, x / zoom)));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, zoom, duration]);

    return { isDragging, setIsDragging };
}
