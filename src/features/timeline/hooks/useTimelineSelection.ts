import { useState, useCallback } from 'react';

export function useTimelineSelection() {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());

    const select = useCallback((id: number, additive = false) => {
        if (!additive) setSelectedClipIds(new Set());
        setSelectedIds((prev) => {
            if (additive) {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            }
            return new Set([id]);
        });
    }, []);

    const selectClip = useCallback((id: string, additive = false) => {
        if (!additive) setSelectedIds(new Set());
        setSelectedClipIds((prev) => {
            if (additive) {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
            }
            return new Set([id]);
        });
    }, []);

    const selectMany = useCallback((eventIds: number[], clipIds: string[]) => {
        setSelectedIds(new Set(eventIds));
        setSelectedClipIds(new Set(clipIds));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
        setSelectedClipIds(new Set());
    }, []);

    return { selectedIds, selectedClipIds, select, selectClip, selectMany, clearSelection };
}
