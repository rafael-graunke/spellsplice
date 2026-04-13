import type { TrackEvent } from './types/event';
import TimelineEvent from './TimelineEvent';

interface TimelineTrackProps {
    width?: number;
    zoom: number;
    events: TrackEvent[];
    onUpdateEvent: (id: number, time: number, duration: number) => void;
}

function TimelineTrack({ width, zoom, events, onUpdateEvent }: TimelineTrackProps) {
    return (
        <div className="h-12 py-1 border-b border-gray-600 border-dashed" style={{ width: `max(100%, ${width}px)` }}>
            <div className="relative h-full" style={{ width }}>
                {events.map((event) => (
                    <TimelineEvent
                        key={event.id}
                        color={event.color}
                        time={event.time}
                        duration={event.duration}
                        zoom={zoom}
                        onUpdate={(time, duration) => onUpdateEvent(event.id, time, duration)}
                    />
                ))}
            </div>
        </div>
    );
}

export default TimelineTrack;
