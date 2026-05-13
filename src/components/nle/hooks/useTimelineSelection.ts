import { useState, useCallback } from 'react';

export interface MarqueeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export function useTimelineSelection() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

    const select = useCallback((id: number, additive = false) => {
        setSelectedIds((prev) => {
            if (additive) {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            }
            return new Set([id]);
        });
    }, []);

    const selectMany = useCallback((ids: number[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    return { selectedIds, marqueeRect, setMarqueeRect, select, selectMany, clearSelection };
}
