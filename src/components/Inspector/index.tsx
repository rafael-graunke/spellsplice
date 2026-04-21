import type { TrackEvent, EventMeta } from '../types/event';
import { EventFields } from './EventFields';

interface InspectorProps {
    editObject: TrackEvent[] | null;
    onUpdate: (eventId: number, meta: EventMeta) => void;
}

export function Inspector({ editObject, onUpdate }: InspectorProps) {
    const event = editObject?.[0] ?? null;
    const count = editObject?.length ?? 0;

    return (
        <div className="inspector p-4 flex flex-col gap-3">
            <h4 className="font-semibold text-sm tracking-tight">Inspector</h4>
            {count > 1 ? (
                <p className="text-sm text-muted-foreground">
                    Multiple events selected. Select a single event.
                </p>
            ) : event ? (
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
                    Select an event to see details.
                </p>
            )}
        </div>
    );
}
