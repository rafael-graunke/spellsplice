import React from 'react';
import type { TrackEvent, EventMeta } from '../types/event';
import type { Player } from '../types/player';
import { EventFields } from './EventFields';

interface InspectorProps {
    editObject: TrackEvent[] | null;
    onUpdate: (eventId: number, meta: EventMeta) => void;
    player?: Player | null;
    autoFocus?: boolean;
}

function Inspector({ editObject, onUpdate, player, autoFocus }: InspectorProps) {
    const event = editObject?.[0] ?? null;
    const count = editObject?.length ?? 0;

    return (
        <div className="inspector h-full flex flex-col">
            <div className="flex items-center px-3 h-8 border-b border-border shrink-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Inspector
                </span>
            </div>
            {count > 1 ? (
                <div className="flex-1 flex items-center justify-center px-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Multiple events selected. Select a single event.
                    </p>
                </div>
            ) : event ? (
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {event.type.replace(/_/g, ' ')}
                    </p>
                    <EventFields
                        event={event}
                        onUpdate={(meta) => onUpdate(event.id, meta)}
                        player={player}
                        autoFocus={autoFocus}
                    />
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center px-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Select an event to see details.
                    </p>
                </div>
            )}
        </div>
    );
}

const MemoInspector = React.memo(Inspector);
export { MemoInspector as Inspector };
