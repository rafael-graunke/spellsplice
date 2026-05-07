import React, { useCallback } from 'react';
import { EventColorMap, type TrackEvent } from '../types/event';
import TimelineEvent from './TimelineEvent';

interface TimelineTrackProps {
    playerId: string;
    layerIndex: number;
    width?: number;
    zoom: number;
    events: TrackEvent[];
    selectedEventIds?: Set<number>;
    onSelectEvent?: (event: TrackEvent, additive: boolean) => void;
    onUpdateEvent: (playerId: string, eventId: number, time: number, duration: number) => void;
    onDeleteEvent?: (playerId: string, eventIds: number[]) => void;
    onDeleteSelected?: () => void;
    onCopy?: () => void;
    onDuplicate?: () => void;
    onMoveStart?: (
        playerId: string,
        layerIndex: number,
        eventId: number,
        e: React.MouseEvent,
        time: number,
        duration: number
    ) => void;
    draggingEventIds?: Set<number>;
    onBackgroundMouseDown?: (e: React.MouseEvent) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

function TimelineTrack({
    playerId,
    layerIndex,
    width,
    zoom,
    events,
    selectedEventIds,
    onSelectEvent,
    onUpdateEvent,
    onDeleteEvent,
    onDeleteSelected,
    onCopy,
    onDuplicate,
    onMoveStart,
    draggingEventIds,
    onBackgroundMouseDown,
    onResizeStart,
    onResizeEnd,
}: TimelineTrackProps) {
    const boundUpdate = useCallback(
        (id: number, time: number, dur: number) => onUpdateEvent(playerId, id, time, dur),
        [onUpdateEvent, playerId]
    );
    const boundDelete = useCallback(
        (id: number) => onDeleteEvent?.(playerId, [id]),
        [onDeleteEvent, playerId]
    );
    const boundMoveStart = useCallback(
        (eventId: number, e: React.MouseEvent, time: number, dur: number) =>
            onMoveStart?.(playerId, layerIndex, eventId, e, time, dur),
        [onMoveStart, playerId, layerIndex]
    );

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
                        color={EventColorMap[event.type].bg}
                        time={event.time}
                        type={event.type}
                        duration={event.duration}
                        zoom={zoom}
                        isSelected={selectedEventIds?.has(event.id) ?? false}
                        resizable={event.resizable}
                        onSelect={(additive) => onSelectEvent?.(event, additive)}
                        onUpdate={(time, duration) => boundUpdate(event.id, time, duration)}
                        onDelete={() => boundDelete(event.id)}
                        onDeleteSelected={onDeleteSelected}
                        onCopy={onCopy}
                        onDuplicate={onDuplicate}
                        onMoveStart={(e, time, duration) => boundMoveStart(event.id, e, time, duration)}
                        isBeingDragged={draggingEventIds?.has(event.id) ?? false}
                        onResizeStart={onResizeStart}
                        onResizeEnd={onResizeEnd}
                    />
                ))}
            </div>
        </div>
    );
}

export default React.memo(TimelineTrack);
