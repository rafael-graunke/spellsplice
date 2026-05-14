import { useEffect } from 'react';

interface TimelineKeyboardOptions {
    onDelete: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onTabNext?: () => void;
}

export function useTimelineKeyboard({
    onDelete,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
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
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onDelete, onCopy, onPaste, onUndo, onRedo, onTabNext]);
}
