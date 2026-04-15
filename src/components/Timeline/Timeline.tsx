import React, { useRef } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '../ui/resizable';
import { TimelineControls } from './TimelineControls';
import type { Player } from '../types/player';
import type { TrackEvent } from '../types/event';
import { cn } from '@/lib/utils';
import TimelineTrackControl from './TimelineTrackControl';
import TimelineRuler from './TimelineRuler';
import TimelineCursor from './TimelineCursor';
import TimelineTrack from './TimelineTrack';
import { useTrackEvents } from './hooks/useTrackEvents';
import { useZoom } from './hooks/useZoom';
import { useSeekDrag } from './hooks/useSeekDrag';
import { useEventMoveDrag } from './hooks/useEventMoveDrag';
import { TRACK_HEIGHT } from './constants';

interface TimelineProps {
    playerData: Player[];
    duration: number;
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: (state: React.SetStateAction<number>) => void;
    setIsPlaying: (playing: boolean) => void;
    selectedEvent: TrackEvent | null;
    setSelectedEvent: React.Dispatch<React.SetStateAction<TrackEvent | null>>;
}

export function Timeline({
    playerData,
    duration,
    isPlaying,
    currentTime,
    setCurrentTime,
    setIsPlaying,
    selectedEvent,
    setSelectedEvent,
}: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    const { tracks, handleCreateEvent, handleDeleteEvent, handleUpdateEvent, handleMoveEvent } =
        useTrackEvents(playerData, currentTime);
    const { zoom, zoomRef, handleZoomChange } = useZoom(containerRef, trackRef, innerRef);
    const { setIsDragging } = useSeekDrag(innerRef, zoom, duration, setCurrentTime);
    const { ghostPos, moveDragRef, handleMoveStart } = useEventMoveDrag(innerRef, zoomRef, tracks, handleMoveEvent);

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls
                zoom={zoom}
                onZoomChange={handleZoomChange}
                isPlaying={isPlaying}
                setCurrentTime={setCurrentTime}
                setIsPlaying={setIsPlaying}
                onCreateEvent={handleCreateEvent}
            />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl playerData={playerData} tracks={tracks} />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel minSize={100} defaultSize="80%">
                    <div ref={trackRef} className="pl-4 overflow-x-auto h-full">
                        <div ref={innerRef} className="relative h-full w-full">
                            <TimelineCursor
                                currentPosition={currentTime * zoom}
                                setIsDragging={setIsDragging}
                                setIsPlaying={setIsPlaying}
                            />
                            <TimelineRuler
                                duration={duration}
                                zoom={zoom}
                                onSeek={setCurrentTime}
                                onScrollDelta={(delta) => {
                                    if (trackRef.current) trackRef.current.scrollLeft -= delta;
                                }}
                            />
                            {tracks.map((track) => (
                                <TimelineTrack
                                    key={track.id}
                                    width={duration * zoom}
                                    zoom={zoom}
                                    events={track.events}
                                    selectedEventId={selectedEvent?.id ?? null}
                                    onSelectEvent={setSelectedEvent}
                                    draggingEventId={
                                        ghostPos && moveDragRef.current?.sourceTrackId === track.id
                                            ? moveDragRef.current.eventId
                                            : null
                                    }
                                    onUpdateEvent={(eventId, time, dur) =>
                                        handleUpdateEvent(track.id, eventId, time, dur)
                                    }
                                    onDeleteEvent={(eventId) => handleDeleteEvent(track.id, eventId)}
                                    onMoveStart={(eventId, e, time, dur) =>
                                        handleMoveStart(track.id, eventId, e, time, dur)
                                    }
                                />
                            ))}
                            {ghostPos && (
                                <div
                                    className={cn(
                                        'absolute pointer-events-none rounded-sm opacity-75 z-50',
                                        ghostPos.color
                                    )}
                                    style={{
                                        left: ghostPos.left,
                                        top: ghostPos.top,
                                        width: ghostPos.width,
                                        height: TRACK_HEIGHT - 8,
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
