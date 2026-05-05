import React, { useRef, useEffect } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '../ui/resizable';
import { TimelineControls } from './TimelineControls';
import { EventColorMap, type TrackEvent } from '../types/event';
import type { Player } from '../types/player';
import { cn } from '@/lib/utils';
import TimelineTrackControl from './TimelineTrackControl';
import TimelineRuler from './TimelineRuler';
import TimelineCursor, { type TimelineCursorHandle } from './TimelineCursor';
import TimelineTrack from './TimelineTrack';
import TimelineEventIcon from './TimelineEventIcon';
import { useZoom } from './hooks/useZoom';
import { useSeekDrag } from './hooks/useSeekDrag';
import { useEventMoveDrag } from './hooks/useEventMoveDrag';
import { useMarqueeDrag } from './hooks/useMarqueeDrag';
import { TRACK_HEIGHT } from './constants';

interface TimelineProps {
    duration: number;
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: (state: React.SetStateAction<number>) => void;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    selectedEvents: TrackEvent[];
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>;
    players: Player[];
    selectedPlayer: Player;
    setSelectedPlayerId: (id: string) => void;
    handleCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>, playerId?: string) => void;
    handleDeleteEvent: (playerId: string, eventId: number) => void;
    handleUpdateEvent: (playerId: string, eventId: number, time: number, duration: number) => void;
    handleMoveEvent: (playerId: string, eventId: number, newTime: number, newLayer: number) => void;
    handleMoveMultipleEvents: (
        moves: Array<{ playerId: string; eventId: number; newTime: number; newLayer: number }>
    ) => void;
    handleUpdatePlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: import('../types/player').Decklist }) => void;
    currentTimeRef: React.MutableRefObject<number>;
}

export function Timeline({
    duration,
    isPlaying,
    currentTime,
    setCurrentTime,
    setIsPlaying,
    selectedEvents,
    setSelectedEvents,
    players,
    selectedPlayer,
    setSelectedPlayerId,
    handleCreateEvent,
    handleDeleteEvent,
    handleUpdateEvent,
    handleMoveEvent,
    handleMoveMultipleEvents,
    handleUpdatePlayer,
    currentTimeRef,
}: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<TimelineCursorHandle>(null);
    const rulerScrollRef = useRef<HTMLDivElement>(null);
    const trackScrollLeftRef = useRef(0);

    const { zoom, zoomPercent, zoomRef, handleZoomChange } = useZoom(
        containerRef,
        trackRef,
        innerRef
    );

    const updateCursorPosition = (time: number, scrollLeft: number) => {
        cursorRef.current?.setPosition(time * zoomRef.current - scrollLeft + 16);
    };

    // 60fps cursor during playback via direct DOM mutation
    useEffect(() => {
        let raf: number;
        const tick = () => {
            updateCursorPosition(currentTimeRef.current, trackScrollLeftRef.current);
            raf = requestAnimationFrame(tick);
        };
        if (isPlaying) {
            raf = requestAnimationFrame(tick);
        }
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    // Snap cursor on seek or zoom change while paused
    useEffect(() => {
        if (!isPlaying) {
            updateCursorPosition(currentTime, trackScrollLeftRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, zoom]);

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        const onScroll = () => {
            trackScrollLeftRef.current = el.scrollLeft;
            if (rulerScrollRef.current) rulerScrollRef.current.style.transform = `translateX(-${el.scrollLeft}px)`;
            updateCursorPosition(currentTimeRef.current, el.scrollLeft);
        };
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { setIsDragging } = useSeekDrag(
        innerRef,
        zoom,
        duration,
        setCurrentTime
    );

    const effectivePlayer = selectedPlayer ?? players[0] ?? null;

    const { ghostPositions, moveDragRef, handleMoveStart } = useEventMoveDrag(
        innerRef,
        zoomRef,
        effectivePlayer,
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
        effectivePlayer,
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

    const layerCount = effectivePlayer?.track.layers ?? 0;

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls
                zoom={Math.round(zoomPercent)}
                onZoomChange={handleZoomChange}
                isPlaying={isPlaying}
                setCurrentTime={setCurrentTime}
                setIsPlaying={setIsPlaying}
                selectedPlayer={selectedPlayer}
                onCreateEvent={(partial) =>
                    handleCreateEvent(partial, effectivePlayer?.id)
                }
            />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl
                        players={players}
                        selectedPlayer={effectivePlayer}
                        onSelectPlayer={(p) => {
                            setSelectedPlayerId(p.id);
                            setSelectedEvents([]);
                        }}
                        onEditPlayer={handleUpdatePlayer}
                    />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel minSize={100} defaultSize="80%">
                    <div className="relative flex flex-col h-full overflow-x-hidden">
                        <TimelineCursor
                            ref={cursorRef}
                            setIsDragging={setIsDragging}
                            setIsPlaying={setIsPlaying}
                        />
                        <div className="shrink-0 pl-4 overflow-x-hidden">
                            <div ref={rulerScrollRef}>
                                <TimelineRuler
                                    duration={duration}
                                    zoom={zoom}
                                    onSeek={setCurrentTime}
                                    onScrollDelta={(delta) => {
                                        if (trackRef.current)
                                            trackRef.current.scrollLeft -= delta;
                                    }}
                                />
                            </div>
                        </div>
                    <div ref={trackRef} className="pl-4 overflow-auto flex-1 scrollbar-thin">
                        <div ref={innerRef} className="relative">
                            {Array.from({ length: layerCount }, (_, layerIndex) => (
                                <TimelineTrack
                                    key={layerIndex}
                                    width={duration * zoom}
                                    zoom={zoom}
                                    events={(effectivePlayer?.track.events ?? []).filter(
                                        (e) => e.layer === layerIndex
                                    )}
                                    selectedEventIds={selectedEventIds}
                                    onSelectEvent={handleSelectEvent}
                                    draggingEventIds={draggingEventIds}
                                    onUpdateEvent={(eventId, time, dur) =>
                                        handleUpdateEvent(
                                            effectivePlayer!.id,
                                            eventId,
                                            time,
                                            dur
                                        )
                                    }
                                    onDeleteEvent={(eventId) =>
                                        handleDeleteEvent(effectivePlayer!.id, eventId)
                                    }
                                    onMoveStart={(eventId, e, time, dur) =>
                                        handleMoveStart(
                                            effectivePlayer!.id,
                                            layerIndex,
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
                                            EventColorMap[ghost.type].bg
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
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
