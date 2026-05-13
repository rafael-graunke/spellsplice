import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import NLEControls from './NLEControls';
import { Track, TrackGroup } from './NLETrack';
import NLERuler from './NLERuler';
import type { NLETrackGroup } from '../types/nle';
import { TrackType } from '../types/nle';
import type { TrackEvent } from '../types/event';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { usePlayhead } from './hooks/usePlayhead';
import { useTimelineSelection } from './hooks/useTimelineSelection';
import { useTimelineKeyboard } from './hooks/useTimelineKeyboard';
import { useNLEEventDrag } from './hooks/useNLEEventDrag';
import type { NLEMoveResult } from './hooks/useNLEEventDrag';
import {
    RULER_HEIGHT,
    TRACK_GROUP_LABEL_WIDTH,
    TRACK_INFO_WIDTH,
    MIN_ZOOM,
    MAX_ZOOM,
} from '../Timeline/constants';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';

const TIMELINE_PADDING_X = 20;

interface NLETimelineProps {
    duration: number;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTimeRef: RefObject<number>;
    setCurrentTime: (t: number) => void;
    trackGroups: NLETrackGroup[];
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onMoveEvent?: (moves: NLEMoveResult[]) => void;
    onUpdateEvent?: (trackId: string, eventId: number, time: number, duration: number) => void;
    onDeleteEvent?: (trackId: string, eventId: number) => void;
    onCopyEvent?: (trackId: string, eventId: number) => void;
    onDuplicateEvent?: (trackId: string, eventId: number) => void;
}

export function NLETimeline({
    duration,
    isPlaying,
    setIsPlaying,
    currentTimeRef,
    setCurrentTime,
    trackGroups,
    onUndo,
    onRedo,
    onMoveEvent,
    onUpdateEvent,
    onDeleteEvent,
    onCopyEvent,
    onDuplicateEvent,
}: NLETimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const scrollBoundaryRef = useRef<HTMLDivElement>(null);
    const trackElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerWidthRef = useRef(0);

    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } =
        useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom();
    const { getViewport } = useTimelineViewport(
        scrollLeftRef,
        zoomRef,
        containerWidthRef
    );
    const { selectedIds, select } = useTimelineSelection();

    // Collect all EVENT tracks in DOM order (top→bottom within each group)
    const eventTracks = useMemo(
        () =>
            trackGroups
                .flatMap((g) => g.tracks)
                .filter((t) => t.type === TrackType.Event),
        [trackGroups],
    );

    const getAllEvents = useCallback((): Map<string, TrackEvent[]> => {
        const map = new Map<string, TrackEvent[]>();
        for (const track of eventTracks) {
            map.set(track.id, track.events);
        }
        return map;
    }, [eventTracks]);

    const handleMoveEvents = useCallback(
        (moves: NLEMoveResult[]) => {
            onMoveEvent?.(moves);
        },
        [onMoveEvent],
    );

    const { ghostsByTrack, draggingIds, handleMoveStart } = useNLEEventDrag(
        zoomRef,
        scrollLeftRef,
        setScroll,
        trackElsRef,
        scrollBoundaryRef,
        eventTracks,
        selectedIds,
        getAllEvents,
        handleMoveEvents,
    );

    const handleTick = useCallback(
        (_cursorAbsPx: number) => {
            void subscribe;
            void getViewport;
        },
        [subscribe, getViewport]
    );

    const zoomPercent = Math.round(
        ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100
    );

    const handleZoomChange = (percent: number) => {
        const clamped = Math.max(0, Math.min(100, percent));
        const pxPerSec = MIN_ZOOM + (clamped / 100) * (MAX_ZOOM - MIN_ZOOM);
        const pivotPx = (contentRef.current?.clientWidth ?? 0) / 2;
        const newScroll = setZoom(pxPerSec, pivotPx, scrollLeftRef.current);
        setScroll(newScroll);
    };

    const { seekTo } = usePlayhead(
        isPlaying,
        duration,
        currentTimeRef,
        zoomRef,
        setCurrentTime,
        handleTick
    );

    useTimelineKeyboard({
        onDelete: () => {
            /* TODO: delete selected events */
        },
        onCopy: () => {
            /* TODO: copy selected events */
        },
        onPaste: () => {
            /* TODO: paste events at playhead */
        },
        onUndo,
        onRedo,
    });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const scrollAreaLeft =
                scrollAreaRef.current?.getBoundingClientRect().left ?? 0;
            const pivotPx = e.clientX - scrollAreaLeft - TIMELINE_PADDING_X;
            const delta = e.deltaY > 0 ? -2 : 2;
            const newScroll = setZoom(
                zoomRef.current + delta,
                pivotPx,
                scrollLeftRef.current
            );
            setScroll(newScroll);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [scrollLeftRef, setScroll, setZoom, zoomRef]);

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-full bg-zinc-950 select-none"
        >
            <NLEControls
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                setCurrentTime={setCurrentTime}
                currentTimeRef={currentTimeRef}
                duration={duration}
                zoom={zoomPercent}
                onZoomChange={handleZoomChange}
            />
            <div
                ref={contentRef}
                className="flex flex-col flex-1 overflow-hidden bg-zinc-950 pl-4 pb-4"
            >
                {/* Ruler row */}
                <div className="flex shrink-0" style={{ height: RULER_HEIGHT }}>
                    <div
                        className="shrink-0"
                        style={{
                            width: TRACK_INFO_WIDTH + TRACK_GROUP_LABEL_WIDTH,
                        }}
                    />
                    <div
                        ref={scrollAreaRef}
                        className="flex-1 border-b border-zinc-600"
                    >
                        <NLERuler
                            duration={duration}
                            zoom={zoom}
                            scrollLeftRef={scrollLeftRef}
                            subscribe={subscribe}
                            onSeek={seekTo}
                            setScroll={setScroll}
                            setMaxScroll={setMaxScroll}
                            paddingX={TIMELINE_PADDING_X}
                        />
                    </div>
                </div>
                <div ref={scrollBoundaryRef} className="flex-1 overflow-hidden">
                    <ResizablePanelGroup orientation="vertical" className="h-full overflow-x-hidden">
                        {trackGroups.flatMap((group, i) => [
                            <ResizablePanel
                                key={group.id}
                                defaultSize={100 / trackGroups.length}
                                className="overflow-y-auto"
                                minSize="106px"
                            >
                                <TrackGroup label={group.label}>
                                    {group.tracks.map((track) => (
                                        <Track
                                            key={track.id}
                                            track={track}
                                            trackId={track.id}
                                            onMount={(el) => {
                                                if (el) trackElsRef.current.set(track.id, el);
                                                else trackElsRef.current.delete(track.id);
                                            }}
                                            duration={duration}
                                            zoom={zoom}
                                            paddingX={TIMELINE_PADDING_X}
                                            scrollLeftRef={scrollLeftRef}
                                            subscribe={subscribe}
                                            onToggleBlocked={() => {}}
                                            onToggleHidden={() => {}}
                                            onToggleMuted={() => {}}
                                            events={track.events}
                                            selectedIds={selectedIds}
                                            draggingIds={draggingIds}
                                            ghosts={ghostsByTrack.get(track.id)}
                                            onSelect={(id, additive) => select(id, additive)}
                                            onMoveStart={(tId, eventId, e, time, dur) =>
                                                handleMoveStart(tId, eventId, e, time, dur)
                                            }
                                            onUpdate={onUpdateEvent}
                                            onDelete={onDeleteEvent}
                                            onDeleteSelected={
                                                onDeleteEvent
                                                    ? (tId) => {
                                                          for (const id of selectedIds) {
                                                              onDeleteEvent(tId, id);
                                                          }
                                                      }
                                                    : undefined
                                            }
                                            onCopy={onCopyEvent}
                                            onDuplicate={onDuplicateEvent}
                                        />
                                    ))}
                                </TrackGroup>
                            </ResizablePanel>,
                            ...(i < trackGroups.length - 1
                                ? [<ResizableHandle key={`handle-${group.id}`} className="aria-[orientation=horizontal]:h-2 bg-zinc-950" />]
                                : []),
                        ])}
                    </ResizablePanelGroup>
                </div>

                {/* TODO: NLECursor, marquee overlay */}
            </div>
        </div>
    );
}
