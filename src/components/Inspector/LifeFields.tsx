import { Input } from '@/components/ui/input';
import type { TrackEvent, EventMeta } from '../types/event';

interface LifeFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
}

export function LifeFields({ event, onUpdate }: LifeFieldsProps) {
    const amount = (event.meta?.amount as number) ?? '';

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Amount</label>
            <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => onUpdate({ amount: Number(e.target.value) })}
                className="h-8"
            />
        </div>
    );
}
