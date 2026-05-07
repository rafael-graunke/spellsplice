import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
import { modKey } from '@/lib/platform';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from '../ui/context-menu';

interface TimelineProps {
    duration: number;
    isPlaying: boolean;
    setCurrentTime: (state: React.SetStateAction<number>) => void;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    selectedEvents: TrackEvent[];
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>;
    players: Player[];
    selectedPlayer: Player;
    setSelectedPlayerId: (id: string) => void;
    handleCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>, playerId?: string) => void;
    handleDeleteEvents: (playerId: string, eventIds: number[]) => void;
    handleDuplicateEvents: (playerId: string, events: TrackEvent[]) => void;
    handlePasteEvents: (playerId: string, events: TrackEvent[], pasteTime: number) => void;
    handleUpdateEvent: (playerId: string, eventId: number, time: number, duration: number) => void;
    handleMoveEvents: (
        moves: Array<{ playerId: string; eventId: number; newTime: number; newLayer: number }>
    ) => void;
    handleUpdatePlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: import('../types/player').Decklist }) => void;
    handleBeginResize: () => void;
    handleCommitResize: () => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    currentTimeRef: React.MutableRefObject<number>;
}

function Timeline({
    duration,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    selectedEvents,
    setSelectedEvents,
    players,
    selectedPlayer,
    setSelectedPlayerId,
    handleCreateEvent,
    handleDeleteEvents,
    handleDuplicateEvents,
    handlePasteEvents,
    handleUpdateEvent,
    handleMoveEvents,
    handleUpdatePlayer,
    handleBeginResize,
    handleCommitResize,
    undo,
    redo,
    canUndo,
    canRedo,
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

    const seekTo = useCallback((time: number) => {
        setCurrentTime(time);
        updateCursorPosition(time, trackScrollLeftRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCurrentTime]);

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

    // Snap cursor on zoom change while paused (seek updates cursor inline via seekTo)
    useEffect(() => {
        updateCursorPosition(currentTimeRef.current, trackScrollLeftRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

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
        seekTo
    );

    const effectivePlayer = selectedPlayer ?? players[0] ?? null;

    const { ghostPositions, moveDragRef, handleMoveStart } = useEventMoveDrag(
        innerRef,
        zoomRef,
        effectivePlayer,
        selectedEvents,
        handleMoveEvents
    );

    const selectedEventIds = useMemo(
        () => new Set(selectedEvents.map((e) => e.id)),
        [selectedEvents]
    );

    const draggingEventIds = useMemo(
        () => ghostPositions.length > 0
            ? new Set<number>(
                  [
                      moveDragRef.current?.primary.eventId,
                      ...(moveDragRef.current?.companions.map((c) => c.eventId) ?? []),
                  ].filter((id): id is number => id !== undefined)
              )
            : new Set<number>(),
        [ghostPositions]
    );

    const { marqueeRect, handleTrackMouseDown } = useMarqueeDrag(
        innerRef,
        effectivePlayer,
        zoomRef,
        (events) => setSelectedEvents(events),
        () => setSelectedEvents([])
    );

    const [copiedEvents, setCopiedEvents] = useState<TrackEvent[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const pasteTimeRef = useRef(0);

    const layerCount = effectivePlayer?.track.layers ?? 0;

    const eventsByLayer = useMemo(
        () => Array.from({ length: layerCount }, (_, i) =>
            (effectivePlayer?.track.events ?? []).filter((e) => e.layer === i)
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [effectivePlayer?.track.events, layerCount]
    );

    const handleDeleteSelected = useCallback(() => {
        if (!effectivePlayer || selectedEvents.length === 0) return;
        handleDeleteEvents(effectivePlayer.id, selectedEvents.map((e) => e.id));
        setSelectedEvents([]);
    }, [effectivePlayer, selectedEvents, handleDeleteEvents, setSelectedEvents]);

    const handleDuplicateSelected = useCallback(() => {
        if (!effectivePlayer || selectedEvents.length === 0) return;
        handleDuplicateEvents(effectivePlayer.id, selectedEvents);
    }, [effectivePlayer, selectedEvents, handleDuplicateEvents]);

    const handleCopy = useCallback(() => {
        if (selectedEvents.length === 0) return;
        setCopiedEvents(selectedEvents);
    }, [selectedEvents]);

    const handlePaste = (pasteTime: number) => {
        if (!effectivePlayer || copiedEvents.length === 0) return;
        handlePasteEvents(effectivePlayer.id, copiedEvents, pasteTime);
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                handleDeleteSelected();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                handleCopy();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                handlePaste(currentTimeRef.current);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedEvents, effectivePlayer, copiedEvents, undo, redo]);

    const handleCreateEventWrapped = useCallback(
        (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) =>
            handleCreateEvent(partial, effectivePlayer?.id),
        [handleCreateEvent, effectivePlayer?.id]
    );

    const handleSelectPlayer = useCallback((p: Player) => {
        setSelectedPlayerId(p.id);
        setSelectedEvents([]);
    }, [setSelectedPlayerId, setSelectedEvents]);

    const handleScrollDelta = useCallback((delta: number) => {
        if (trackRef.current) trackRef.current.scrollLeft -= delta;
    }, []);

    const handleSelectEvent = useCallback((event: TrackEvent, additive: boolean) => {
        if (additive) {
            setSelectedEvents((prev) =>
                prev.some((e) => e.id === event.id)
                    ? prev.filter((e) => e.id !== event.id)
                    : [...prev, event]
            );
        } else {
            setSelectedEvents([event]);
        }
    }, [setSelectedEvents]);

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls
                zoom={Math.round(zoomPercent)}
                onZoomChange={handleZoomChange}
                isPlaying={isPlaying}
                setCurrentTime={seekTo}
                setIsPlaying={setIsPlaying}
                selectedPlayer={selectedPlayer}
                createOpen={createOpen}
                onCreateOpenChange={setCreateOpen}
                onCreateEvent={handleCreateEventWrapped}
            />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl
                        players={players}
                        selectedPlayer={effectivePlayer}
                        onSelectPlayer={handleSelectPlayer}
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
                                    onSeek={seekTo}
                                    onScrollDelta={handleScrollDelta}
                                />
                            </div>
                        </div>
                    <div ref={trackRef} className="pl-4 overflow-auto flex-1 scrollbar-thin">
                        <ContextMenu>
                        <ContextMenuTrigger asChild>
                        <div
                            ref={innerRef}
                            className="relative"
                            onContextMenu={(e) => {
                                const rect = innerRef.current!.getBoundingClientRect();
                                pasteTimeRef.current = Math.max(0, (e.clientX - rect.left) / zoomRef.current);
                            }}
                        >
                            {Array.from({ length: layerCount }, (_, layerIndex) => (
                                <TimelineTrack
                                    key={layerIndex}
                                    playerId={effectivePlayer!.id}
                                    layerIndex={layerIndex}
                                    width={duration * zoom}
                                    zoom={zoom}
                                    events={eventsByLayer[layerIndex] ?? []}
                                    selectedEventIds={selectedEventIds}
                                    onSelectEvent={handleSelectEvent}
                                    draggingEventIds={draggingEventIds}
                                    onUpdateEvent={handleUpdateEvent}
                                    onDeleteEvent={handleDeleteEvents}
                                    onDeleteSelected={handleDeleteSelected}
                                    onCopy={handleCopy}
                                    onDuplicate={handleDuplicateSelected}
                                    onMoveStart={handleMoveStart}
                                    onBackgroundMouseDown={handleTrackMouseDown}
                                    onResizeStart={handleBeginResize}
                                    onResizeEnd={handleCommitResize}
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
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem onClick={() => setCreateOpen(true)}>
                                Create event
                                <ContextMenuShortcut>{modKey}+K</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem
                                disabled={copiedEvents.length === 0}
                                onClick={() => handlePaste(pasteTimeRef.current)}
                            >
                                Paste
                                <ContextMenuShortcut>{modKey}+V</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem disabled={!canUndo} onClick={undo}>
                                Undo
                                <ContextMenuShortcut>{modKey}+Z</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem disabled={!canRedo} onClick={redo}>
                                Redo
                                <ContextMenuShortcut>{modKey}+Shift+Z</ContextMenuShortcut>
                            </ContextMenuItem>
                        </ContextMenuContent>
                        </ContextMenu>
                    </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

const MemoTimeline = React.memo(Timeline);
export { MemoTimeline as Timeline };
