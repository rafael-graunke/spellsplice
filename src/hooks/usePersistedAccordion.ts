import { useCallback, useState } from 'react';

// Controlled-accordion state that survives the settings dialog unmounting on
// close. Defaults to every item open; persists the open set to localStorage
// under `storageKey` so a reopen restores exactly what was expanded/collapsed.
export function usePersistedAccordion(storageKey: string, allValues: string[]) {
    const [value, setValue] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) return JSON.parse(raw) as string[];
        } catch {
            /* fall through to default */
        }
        return allValues;
    });

    const onValueChange = useCallback(
        (next: string[]) => {
            setValue(next);
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                /* ignore write failure (e.g. storage full/blocked) */
            }
        },
        [storageKey]
    );

    return [value, onValueChange] as const;
}
