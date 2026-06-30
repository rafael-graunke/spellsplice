import { useEffect } from 'react';
import type { RefObject } from 'react';

interface TimelineKeyboardOptions {
    onDelete: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSeek: (t: number) => void;
    currentTimeRef: RefObject<number>;
    duration: number;
    onTabNext?: () => void;
}

export function useTimelineKeyboard({
    onDelete,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
    onSeek,
    currentTimeRef,
    duration,
    onTabNext,
}: TimelineKeyboardOptions) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

            const mod = e.ctrlKey || e.metaKey;
            if (e.key === 'Delete' || e.key === 'Backspace') { onDelete(); }
            else if (mod && e.key === 'c') { onCopy(); }
            else if (mod && e.key === 'v') { onPaste(); }
            else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); onUndo(); }
            else if (mod && (e.key === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); onRedo(); }
            else if (e.key === 'Tab' && !mod && onTabNext) { e.preventDefault(); onTabNext(); }
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const step = mod ? 1 / 30 : 1;
                const dir = e.key === 'ArrowLeft' ? -1 : 1;
                onSeek(Math.max(0, Math.min(duration, currentTimeRef.current + dir * step)));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onDelete, onCopy, onPaste, onUndo, onRedo, onSeek, currentTimeRef, duration, onTabNext]);
}
