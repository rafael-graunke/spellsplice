import type { TrackEvent } from '../types/event';
import TimelineEvent from './TimelineEvent';

interface TimelineTrackProps {
    width?: number;
    zoom: number;
    events: TrackEvent[];
    selectedEventId?: number | null;
    onSelectEvent?: (event: TrackEvent) => void;
    onUpdateEvent: (id: number, time: number, duration: number) => void;
    onDeleteEvent?: (id: number) => void;
    onMoveStart?: (eventId: number, e: React.MouseEvent, time: number, duration: number) => void;
    draggingEventId?: number | null;
}

function TimelineTrack({ width, zoom, events, selectedEventId, onSelectEvent, onUpdateEvent, onDeleteEvent, onMoveStart, draggingEventId }: TimelineTrackProps) {
    return (
        <div
            className="h-12 py-1"
            style={{
                width: `max(100%, ${width}px)`,
                backgroundImage: 'repeating-linear-gradient(to right, #4B5563 0px, #4B5563 4px, transparent 4px, transparent 12px)',
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
                        duration={event.duration}
                        zoom={zoom}
                        isSelected={selectedEventId === event.id}
                        resizable={event.resizable}
                        onSelect={() => onSelectEvent?.(event)}
                        onUpdate={(time, duration) => onUpdateEvent(event.id, time, duration)}
                        onDelete={() => onDeleteEvent?.(event.id)}
                        onMoveStart={(e, time, duration) => onMoveStart?.(event.id, e, time, duration)}
                        isBeingDragged={draggingEventId === event.id}
                    />
                ))}
            </div>
        </div>
    );
}

export default TimelineTrack;
