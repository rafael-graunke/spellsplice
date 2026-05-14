import { useState, useCallback } from 'react';

export function useTimelineSelection() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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

    return { selectedIds, select, selectMany, clearSelection };
}
