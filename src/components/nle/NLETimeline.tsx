import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { useNLEMarqueeDrag } from './hooks/useNLEMarqueeDrag';
import type { NLEMoveResult } from './hooks/useNLEEventDrag';
import {
    RULER_HEIGHT,
    TRACK_GROUP_LABEL_WIDTH,
    TRACK_INFO_WIDTH,
    MIN_ZOOM,
    MAX_ZOOM,
} from '../Timeline/constants';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from '../ui/context-menu';
import { modKey } from '@/lib/platform';

const TIMELINE_PADDING_X = 30;

export interface PasteItem {
    trackId: string;
    event: TrackEvent;
}

export interface DuplicateItem {
    trackId: string;
    eventId: number;
}

export interface DeleteItem {
    trackId: string;
    eventId: number;
}

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
    onDeleteEvents: (items: DeleteItem[]) => void;
    onCopyEvent?: (trackId: string, eventId: number) => void;
    onDuplicateEvents?: (items: DuplicateItem[], onCreated: (newIds: number[]) => void) => void;
    onPasteEvents?: (items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => void;
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
    canUndo,
    canRedo,
    onMoveEvent,
    onUpdateEvent,
    onDeleteEvents,
    onDuplicateEvents,
    onPasteEvents,
}: NLETimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const scrollBoundaryRef = useRef<HTMLDivElement>(null);
    const trackElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerWidthRef = useRef(0);
    const pasteTimeRef = useRef(0);

    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } =
        useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom();
    useTimelineViewport(scrollLeftRef, zoomRef, containerWidthRef);
    const { selectedIds, select, selectMany, clearSelection } = useTimelineSelection();
    // Refs so that callbacks passed through NLEEvent.memo always read fresh values
    // without recreating on every selection/trackGroups change.
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    // Collect all EVENT tracks in DOM order (top→bottom within each group)
    const eventTracks = useMemo(
        () =>
            trackGroups
                .flatMap((g) => g.tracks)
                .filter((t) => t.type === TrackType.Event),
        [trackGroups],
    );

    // Map eventId → trackId for fast lookup
    const trackByEventId = useMemo(() => {
        const map = new Map<number, string>();
        for (const track of eventTracks) {
            for (const ev of track.events) {
                map.set(ev.id, track.id);
            }
        }
        return map;
    }, [eventTracks]);
    const trackByEventIdRef = useRef(trackByEventId);
    trackByEventIdRef.current = trackByEventId;

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
    );

    // Copy / paste state
    const [copiedItems, setCopiedItems] = useState<PasteItem[]>([]);
    const pendingSelectRef = useRef<number[]>([]);

    // After a duplicate/paste render, select the newly created events before paint
    useLayoutEffect(() => {
        if (pendingSelectRef.current.length === 0) return;
        const toSelect = pendingSelectRef.current.filter((id) => trackByEventId.has(id));
        pendingSelectRef.current = [];
        if (toSelect.length > 0) selectMany(toSelect);
    }, [trackByEventId, selectMany]);

    const handleDelete = useCallback(() => {
        const items: DeleteItem[] = [];
        for (const id of selectedIdsRef.current) {
            const trackId = trackByEventIdRef.current.get(id);
            if (trackId) items.push({ trackId, eventId: id });
        }
        if (items.length === 0) return;
        onDeleteEvents(items);
        clearSelection();
    }, [onDeleteEvents, clearSelection]);

    const handleCopy = useCallback(() => {
        if (selectedIdsRef.current.size === 0) return;
        const items: PasteItem[] = [];
        for (const track of eventTracks) {
            for (const ev of track.events) {
                if (selectedIdsRef.current.has(ev.id)) items.push({ trackId: track.id, event: ev });
            }
        }
        setCopiedItems(items);
    }, [eventTracks]);

    const handleDuplicateForEvent = useCallback((trackId: string, eventId: number) => {
        if (!onDuplicateEvents) return;
        const items: DuplicateItem[] = selectedIds.has(eventId)
            ? eventTracks.flatMap((t) =>
                  t.events
                      .filter((e) => selectedIds.has(e.id))
                      .map((e) => ({ trackId: t.id, eventId: e.id }))
              )
            : [{ trackId, eventId }];
        onDuplicateEvents(items, (newIds) => { pendingSelectRef.current = newIds; });
    }, [selectedIds, eventTracks, onDuplicateEvents, selectMany]);

    const handlePaste = useCallback((pasteTime: number) => {
        if (copiedItems.length === 0) return;
        onPasteEvents?.(copiedItems, pasteTime, (newIds) => { pendingSelectRef.current = newIds; });
    }, [copiedItems, onPasteEvents, selectMany]);

    useTimelineKeyboard({
        onDelete: handleDelete,
        onCopy: handleCopy,
        onPaste: () => handlePaste(currentTimeRef.current),
        onUndo,
        onRedo,
    });

    const { marqueeRect, handleMarqueeMouseDown } = useNLEMarqueeDrag(
        scrollBoundaryRef,
        trackElsRef,
        eventTracks,
        zoomRef,
        scrollLeftRef,
        selectMany,
        clearSelection,
        TRACK_GROUP_LABEL_WIDTH + TRACK_INFO_WIDTH,
        TIMELINE_PADDING_X,
    );

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
                <ContextMenu>
                <ContextMenuTrigger asChild>
                <div
                    ref={scrollBoundaryRef}
                    className="flex-1 overflow-hidden relative"
                    onMouseDown={handleMarqueeMouseDown}
                    onContextMenu={(e) => {
                        const contentLeft = (scrollAreaRef.current?.getBoundingClientRect().left ?? 0) + TIMELINE_PADDING_X;
                        pasteTimeRef.current = Math.max(0, (e.clientX - contentLeft + scrollLeftRef.current) / zoomRef.current);
                    }}
                >
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
                                            onDeselect={clearSelection}
                                            onMoveStart={(tId, eventId, e, time, dur) =>
                                                handleMoveStart(tId, eventId, e, time, dur)
                                            }
                                            onUpdate={onUpdateEvent}
                                            onDeleteSelected={() => handleDelete()}
                                            onCopy={(_tId, _eId) => handleCopy()}
                                            onDuplicate={onDuplicateEvents ? handleDuplicateForEvent : undefined}
                                        />
                                    ))}
                                </TrackGroup>
                            </ResizablePanel>,
                            ...(i < trackGroups.length - 1
                                ? [<ResizableHandle key={`handle-${group.id}`} className="aria-[orientation=horizontal]:h-2 bg-zinc-950" />]
                                : []),
                        ])}
                    </ResizablePanelGroup>
                    {marqueeRect && (
                        <div
                            className="absolute pointer-events-none border rounded-sm border-violet-500 bg-violet-500/20 z-40"
                            style={{
                                left: marqueeRect.x,
                                top: marqueeRect.y,
                                width: marqueeRect.w,
                                height: marqueeRect.h,
                            }}
                        />
                    )}
                </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem
                        disabled={copiedItems.length === 0}
                        onClick={() => handlePaste(pasteTimeRef.current)}
                    >
                        Paste
                        <ContextMenuShortcut>{modKey}+V</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem disabled={!canUndo} onClick={onUndo}>
                        Undo
                        <ContextMenuShortcut>{modKey}+Z</ContextMenuShortcut>
                    </ContextMenuItem>
                    <ContextMenuItem disabled={!canRedo} onClick={onRedo}>
                        Redo
                        <ContextMenuShortcut>{modKey}+Shift+Z</ContextMenuShortcut>
                    </ContextMenuItem>
                </ContextMenuContent>
                </ContextMenu>
            </div>
        </div>
    );
}
