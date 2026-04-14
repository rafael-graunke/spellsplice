import { useEffect, useRef, useState } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './ui/resizable';
import { TimelineControls } from './TimelineControls';
import type { Player } from './types/player';
import { EventColorMap, type EventType, type Track } from './types/event';
import { cn } from '@/lib/utils';

import TimelineTrackControl from './TimelineTrackControl';
import TimelineRuler from './TimelineRuler';
import TimelineCursor from './TimelineCursor';
import TimelineTrack from './TimelineTrack';

const RULER_HEIGHT = 40;
const TRACK_HEIGHT = 48;

interface TimelineProps {
    playerData: Player[];
    duration: number;
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: (state: React.SetStateAction<number>) => void;
    setIsPlaying: (playing: boolean) => void;
}

export function Timeline({
    playerData,
    duration,
    isPlaying,
    currentTime,
    setCurrentTime,
    setIsPlaying,
}: TimelineProps) {
    const [zoom, setZoom] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const [tracks, setTracks] = useState<Track[]>(() =>
        playerData.map((player) => ({ id: player.id, playerId: player.id, events: [] }))
    );
    const [ghostPos, setGhostPos] = useState<{
        left: number;
        top: number;
        width: number;
        color: string;
    } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(zoom);
    const nextEventId = useRef(1);
    const moveDragRef = useRef<{
        eventId: number;
        sourceTrackId: string;
        startX: number;
        startTime: number;
        startDuration: number;
        color: string;
    } | null>(null);

    const handleZoomChange = (newZoom: number) => {
        zoomRef.current = newZoom;
        setZoom(newZoom);
    };

    const handleCreateEvent = (eventType: EventType) => {
        setTracks((prev) => {
            if (prev.length === 0) return prev;
            const [first, ...rest] = prev;
            const newEvent = {
                id: nextEventId.current++,
                time: currentTime,
                duration: 2,
                color: EventColorMap[eventType],
                type: eventType,
            };
            return [{ ...first, events: [...first.events, newEvent] }, ...rest];
        });
    };

    const handleDeleteEvent = (trackId: string, eventId: number) => {
        setTracks((prev) =>
            prev.map((track) =>
                track.id === trackId
                    ? { ...track, events: track.events.filter((e) => e.id !== eventId) }
                    : track
            )
        );
    };

    const handleUpdateEvent = (trackId: string, eventId: number, time: number, duration: number) => {
        setTracks((prev) =>
            prev.map((track) =>
                track.id === trackId
                    ? { ...track, events: track.events.map((e) => (e.id === eventId ? { ...e, time, duration } : e)) }
                    : track
            )
        );
    };

    const handleMoveEvent = (fromTrackId: string, toTrackId: string, eventId: number, newTime: number) => {
        setTracks((prev) => {
            const sourceTrack = prev.find((t) => t.id === fromTrackId);
            const event = sourceTrack?.events.find((e) => e.id === eventId);
            if (!event) return prev;
            const updatedEvent = { ...event, time: newTime };

            return prev.map((track) => {
                if (fromTrackId === toTrackId && track.id === fromTrackId) {
                    return { ...track, events: track.events.map((e) => (e.id === eventId ? updatedEvent : e)) };
                }
                if (track.id === fromTrackId) {
                    return { ...track, events: track.events.filter((e) => e.id !== eventId) };
                }
                if (track.id === toTrackId) {
                    return { ...track, events: [...track.events, updatedEvent] };
                }
                return track;
            });
        });
    };

    const handleMoveStart = (
        trackId: string,
        eventId: number,
        e: React.MouseEvent,
        time: number,
        duration: number
    ) => {
        const inner = innerRef.current;
        if (!inner) return;

        const sourceTrack = tracks.find((t) => t.id === trackId);
        const event = sourceTrack?.events.find((ev) => ev.id === eventId);
        if (!event) return;

        const trackIndex = tracks.findIndex((t) => t.id === trackId);

        moveDragRef.current = {
            eventId,
            sourceTrackId: trackId,
            startX: e.clientX,
            startTime: time,
            startDuration: duration,
            color: event.color,
        };

        setGhostPos({
            left: time * zoomRef.current,
            top: RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 4,
            width: duration * zoomRef.current,
            color: event.color,
        });
    };

    // Handle Zoom
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handler = (e: WheelEvent) => {
            e.preventDefault();

            const track = trackRef.current;
            const inner = innerRef.current;
            if (!track || !inner) return;

            const trackRect = track.getBoundingClientRect();
            const innerRect = inner.getBoundingClientRect();
            const trackX = e.clientX - trackRect.left;
            const scrollLeft = track.scrollLeft;
            const oldZoom = zoomRef.current;

            const padding = innerRect.left - trackRect.left + scrollLeft;
            const contentX = scrollLeft + trackX - padding;
            const time = contentX / oldZoom;

            const zoomIntensity = 0.001;
            const delta = -e.deltaY;
            const newZoom = Math.min(Math.max(5, oldZoom * (1 + delta * zoomIntensity)), 200);
            const newScrollLeft = time * newZoom + padding - trackX;

            zoomRef.current = newZoom;
            setZoom(newZoom);
            track.scrollLeft = newScrollLeft;
        };

        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);


    // Handle cursor drag (seek)
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const inner = innerRef.current;
            if (!inner) return;
            const x = e.clientX - inner.getBoundingClientRect().left;
            setCurrentTime(Math.max(0, Math.min(duration, x / zoom)));
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            document.body.style.userSelect = '';
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, zoom, duration]);

    // Handle cross-track event move drag
    useEffect(() => {
        if (!ghostPos) return;

        const onMouseMove = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) return;

            const rect = inner.getBoundingClientRect();
            const deltaX = e.clientX - drag.startX;
            const newTime = Math.max(0, drag.startTime + deltaX / zoomRef.current);

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor((yInInner - RULER_HEIGHT) / TRACK_HEIGHT);
            const trackIndex = Math.max(0, Math.min(tracks.length - 1, rawIndex));

            setGhostPos({
                left: newTime * zoomRef.current,
                top: RULER_HEIGHT + trackIndex * TRACK_HEIGHT + 4,
                width: drag.startDuration * zoomRef.current,
                color: drag.color,
            });
        };

        const onMouseUp = (e: MouseEvent) => {
            const drag = moveDragRef.current;
            const inner = innerRef.current;
            if (!drag || !inner) {
                setGhostPos(null);
                return;
            }

            const rect = inner.getBoundingClientRect();
            const deltaX = e.clientX - drag.startX;
            const newTime = Math.max(0, drag.startTime + deltaX / zoomRef.current);

            const yInInner = e.clientY - rect.top;
            const rawIndex = Math.floor((yInInner - RULER_HEIGHT) / TRACK_HEIGHT);
            const targetIndex = Math.max(0, Math.min(tracks.length - 1, rawIndex));
            const targetTrackId = tracks[targetIndex].id;

            handleMoveEvent(drag.sourceTrackId, targetTrackId, drag.eventId, newTime);
            moveDragRef.current = null;
            setGhostPos(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [ghostPos, tracks]);

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
                                    draggingEventId={
                                        ghostPos && moveDragRef.current?.sourceTrackId === track.id
                                            ? moveDragRef.current.eventId
                                            : null
                                    }
                                    onUpdateEvent={(eventId, time, dur) =>
                                        handleUpdateEvent(track.id, eventId, time, dur)
                                    }
                                    onDeleteEvent={(eventId) =>
                                        handleDeleteEvent(track.id, eventId)
                                    }
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
