import React, { useRef } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '../ui/resizable';
import { TimelineControls } from './TimelineControls';
import type { Player } from '../types/player';
import type { Track, TrackEvent } from '../types/event';
import { cn } from '@/lib/utils';
import TimelineTrackControl from './TimelineTrackControl';
import TimelineRuler from './TimelineRuler';
import TimelineCursor from './TimelineCursor';
import TimelineTrack from './TimelineTrack';
import TimelineEventIcon from './TimelineEventIcon';
import { useZoom } from './hooks/useZoom';
import { useSeekDrag } from './hooks/useSeekDrag';
import { useEventMoveDrag } from './hooks/useEventMoveDrag';
import { useMarqueeDrag } from './hooks/useMarqueeDrag';
import { TRACK_HEIGHT } from './constants';

interface TimelineProps {
    playerData: Player[];
    duration: number;
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: (state: React.SetStateAction<number>) => void;
    setIsPlaying: (playing: boolean) => void;
    selectedEvents: TrackEvent[];
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>;
    tracks: Track[];
    handleCreateEvent: (partial: Partial<TrackEvent>) => void;
    handleDeleteEvent: (trackId: string, eventId: number) => void;
    handleUpdateEvent: (
        trackId: string,
        eventId: number,
        time: number,
        duration: number
    ) => void;
    handleMoveEvent: (
        fromTrackId: string,
        toTrackId: string,
        eventId: number,
        newTime: number
    ) => void;
    handleMoveMultipleEvents: (
        moves: Array<{
            fromTrackId: string;
            toTrackId: string;
            eventId: number;
            newTime: number;
        }>
    ) => void;
}

export function Timeline({
    playerData,
    duration,
    isPlaying,
    currentTime,
    setCurrentTime,
    setIsPlaying,
    selectedEvents,
    setSelectedEvents,
    tracks,
    handleCreateEvent,
    handleDeleteEvent,
    handleUpdateEvent,
    handleMoveEvent,
    handleMoveMultipleEvents,
}: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);

    const { zoom, zoomPercent, zoomRef, handleZoomChange } = useZoom(
        containerRef,
        trackRef,
        innerRef
    );
    const { setIsDragging } = useSeekDrag(
        innerRef,
        zoom,
        duration,
        setCurrentTime
    );
    const { ghostPositions, moveDragRef, handleMoveStart } = useEventMoveDrag(
        innerRef,
        zoomRef,
        tracks,
        selectedEvents,
        handleMoveEvent,
        handleMoveMultipleEvents
    );

    const selectedEventIds = new Set(selectedEvents.map((e) => e.id));

    const draggingEventIds =
        ghostPositions.length > 0
            ? new Set<number>(
                  [
                      moveDragRef.current?.primary.eventId,
                      ...(moveDragRef.current?.companions.map((c) => c.eventId) ??
                          []),
                  ].filter((id): id is number => id !== undefined)
              )
            : new Set<number>();

    const { marqueeRect, handleTrackMouseDown } = useMarqueeDrag(
        innerRef,
        tracks,
        zoomRef,
        (events) => setSelectedEvents(events),
        () => setSelectedEvents([])
    );

    const handleSelectEvent = (event: TrackEvent, additive: boolean) => {
        if (additive) {
            setSelectedEvents((prev) =>
                prev.some((e) => e.id === event.id)
                    ? prev.filter((e) => e.id !== event.id)
                    : [...prev, event]
            );
        } else {
            setSelectedEvents([event]);
        }
    };

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls
                zoom={Math.round(zoomPercent)}
                onZoomChange={handleZoomChange}
                isPlaying={isPlaying}
                setCurrentTime={setCurrentTime}
                setIsPlaying={setIsPlaying}
                onCreateEvent={handleCreateEvent}
            />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl
                        playerData={playerData}
                        tracks={tracks}
                    />
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
                                    if (trackRef.current)
                                        trackRef.current.scrollLeft -= delta;
                                }}
                            />
                            {tracks.map((track) => (
                                <TimelineTrack
                                    key={track.id}
                                    width={duration * zoom}
                                    zoom={zoom}
                                    events={track.events}
                                    selectedEventIds={selectedEventIds}
                                    onSelectEvent={handleSelectEvent}
                                    draggingEventIds={draggingEventIds}
                                    onUpdateEvent={(eventId, time, dur) =>
                                        handleUpdateEvent(
                                            track.id,
                                            eventId,
                                            time,
                                            dur
                                        )
                                    }
                                    onDeleteEvent={(eventId) =>
                                        handleDeleteEvent(track.id, eventId)
                                    }
                                    onMoveStart={(eventId, e, time, dur) =>
                                        handleMoveStart(
                                            track.id,
                                            eventId,
                                            e,
                                            time,
                                            dur
                                        )
                                    }
                                    onBackgroundMouseDown={handleTrackMouseDown}
                                />
                            ))}
                            {marqueeRect && (
                                <div
                                    className="absolute pointer-events-none border border-blue-400 bg-blue-400/10 z-40"
                                    style={{
                                        left: marqueeRect.x,
                                        top: marqueeRect.y,
                                        width: marqueeRect.w,
                                        height: marqueeRect.h,
                                    }}
                                />
                            )}
                            {ghostPositions.map((ghost, i) =>
                                ghost.isWaypoint ? (
                                    <TimelineEventIcon
                                        key={i}
                                        type={ghost.type}
                                        className="size-11 absolute pointer-events-none opacity-75 z-50"
                                        style={{
                                            left: ghost.left,
                                            top: ghost.top,
                                        }}
                                    />
                                ) : (
                                    <div
                                        key={i}
                                        className={cn(
                                            'absolute pointer-events-none rounded-sm opacity-75 z-50',
                                            ghost.color
                                        )}
                                        style={{
                                            left: ghost.left,
                                            top: ghost.top,
                                            width: ghost.width,
                                            height: TRACK_HEIGHT - 8,
                                        }}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
