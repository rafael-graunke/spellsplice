import type { TrackEvent } from '../types/event';
import { EventFields } from './EventFields';

interface InspectorProps {
    editObject: TrackEvent[] | null;
    onUpdate: (eventId: number, meta: Record<string, unknown>) => void;
}

export function Inspector({ editObject, onUpdate }: InspectorProps) {
    const event = editObject?.[0] ?? null;

    return (
        <div className="inspector p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-sm tracking-tight">Inspector</h4>
            {event ? (
                <>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {event.type.replace(/_/g, ' ')}
                    </p>
                    <EventFields
                        event={event}
                        onUpdate={(meta) => onUpdate(event.id, meta)}
                    />
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Select an event to see details
                </p>
            )}
        </div>
    );
}
