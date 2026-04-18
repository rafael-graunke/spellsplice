import type { TrackEvent } from '../types/event';
import TimelineEvent from './TimelineEvent';

interface TimelineTrackProps {
    width?: number;
    zoom: number;
    events: TrackEvent[];
    selectedEventIds?: Set<number>;
    onSelectEvent?: (event: TrackEvent, additive: boolean) => void;
    onUpdateEvent: (id: number, time: number, duration: number) => void;
    onDeleteEvent?: (id: number) => void;
    onMoveStart?: (
        eventId: number,
        e: React.MouseEvent,
        time: number,
        duration: number
    ) => void;
    draggingEventIds?: Set<number>;
    onBackgroundMouseDown?: (e: React.MouseEvent) => void;
}

function TimelineTrack({
    width,
    zoom,
    events,
    selectedEventIds,
    onSelectEvent,
    onUpdateEvent,
    onDeleteEvent,
    onMoveStart,
    draggingEventIds,
    onBackgroundMouseDown,
}: TimelineTrackProps) {
    return (
        <div
            className="h-12 py-1"
            onMouseDown={(e) => onBackgroundMouseDown?.(e)}
            style={{
                width: `max(100%, ${width}px)`,
                backgroundImage:
                    'repeating-linear-gradient(to right, #4B5563 0px, #4B5563 4px, transparent 4px, transparent 12px)',
                backgroundPosition: 'bottom',
                backgroundSize: '100% 1px',
                backgroundRepeat: 'no-repeat',
            }}
        >
            <div className="relative h-full" style={{ width }}>
                {events.map((event) => (
                    <TimelineEvent
                        key={event.id}
                        color={event.color}
                        time={event.time}
                        type={event.type}
                        duration={event.duration}
                        zoom={zoom}
                        isSelected={selectedEventIds?.has(event.id) ?? false}
                        resizable={event.resizable}
                        onSelect={(additive) => onSelectEvent?.(event, additive)}
                        onUpdate={(time, duration) =>
                            onUpdateEvent(event.id, time, duration)
                        }
                        onDelete={() => onDeleteEvent?.(event.id)}
                        onMoveStart={(e, time, duration) =>
                            onMoveStart?.(event.id, e, time, duration)
                        }
                        isBeingDragged={draggingEventIds?.has(event.id) ?? false}
                    />
                ))}
            </div>
        </div>
    );
}

export default TimelineTrack;
