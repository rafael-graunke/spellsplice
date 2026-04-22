import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import type { TrackEvent, EventMeta } from '../types/event';

interface LifeFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
}

export function LifeFields({ event, onUpdate }: LifeFieldsProps) {
    const committed = (event.meta?.amount as number) ?? 1;
    const [raw, setRaw] = useState(String(committed));

    useEffect(() => {
        setRaw(String(committed));
    }, [event.id]);

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
                type="number"
                min={1}
                value={raw}
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
