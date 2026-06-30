import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import type { TrackEvent, EventMeta } from '../types/event';

interface LifeFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    autoFocus?: boolean;
}

export function LifeFields({ event, onUpdate, autoFocus }: LifeFieldsProps) {
    const committed = (event.meta?.amount as number) ?? 1;
    const [raw, setRaw] = useState(String(committed));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setRaw(String(committed));
    }, [event.id]);

    useEffect(() => {
        if (!autoFocus) return;
        const id = setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 0);
        return () => clearTimeout(id);
    }, [event.id, autoFocus]);

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
                ref={inputRef}
                type="number"
                min={1}
                value={raw}
                onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}
                onChange={(e) => {
                    const s = e.target.value;
                    setRaw(s);
                    const n = parseInt(s, 10);
                    if (!isNaN(n) && n >= 1) onUpdate({ amount: n });
                }}
                onBlur={() => {
                    const n = parseInt(raw, 10);
                    const valid = !isNaN(n) && n >= 1 ? n : committed;
                    setRaw(String(valid));
                    onUpdate({ amount: valid });
                }}
                className="h-8"
            />
        </div>
    );
}
