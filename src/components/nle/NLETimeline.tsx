import { useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import NLECursor from './NLECursor';
import type { NLECursorHandle } from './NLECursor';
import type { RefObject } from 'react';
import NLEControls from './NLEControls';
import { Track, TrackGroup } from './NLETrack';
import NLERuler from './NLERuler';
import type { NLETrackGroup } from '../types/nle';
import { TrackType, TrackTypeIconMap } from '../types/nle';
import type { TrackEvent } from '../types/event';
import { EventType } from '../types/event';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { usePlayhead } from './hooks/usePlayhead';
import { useTimelineSelection } from './hooks/useTimelineSelection';
import { useTimelineKeyboard } from './hooks/useTimelineKeyboard';
import { useNLEElementDrag } from './hooks/useNLEElementDrag';
import { useNLEMarqueeDrag } from './hooks/useNLEMarqueeDrag';
import type { NLEMoveResult, ClipMoveResult } from './hooks/nleHookTypes';
import type { MediaSource } from '../types/source';
import { useWaveformPeaks } from '@/hooks/useWaveformPeaks';
import { useVideoThumbnails } from '@/hooks/useVideoThumbnails';
import type { ClipInfo } from '@/hooks/useVideoThumbnails';
import {
    RULER_HEIGHT,
    TRACK_GROUP_LABEL_WIDTH,
    TRACK_INFO_WIDTH,
    MIN_ZOOM,
    MAX_ZOOM,
    TRACK_HEIGHT,
} from '../Timeline/constants';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../ui/command';

const TIMELINE_PADDING_X = 30;

interface NLECreateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    setIsPlaying: (v: boolean) => void;
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
}

function NLECreateDialog({ open, onOpenChange, setIsPlaying, onCreateEvent }: NLECreateDialogProps) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsPlaying(false);
                onOpenChange(!open);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open]);

    const handleSelect = (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => {
        onCreateEvent(partial);
        onOpenChange(false);
    };

    return (
        <CommandDialog open={open} onOpenChange={onOpenChange} onCloseAutoFocus={(e) => e.preventDefault()}>
            <Command>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No actions found.</CommandEmpty>
                    <CommandGroup heading="Player Actions">
                        <CommandItem onSelect={() => handleSelect({ type: EventType.AddToHand, duration: 1 })}>
                            Draw
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.RemoveFromHand })}>
                            Play
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.RemoveFromHand })}>
                            Discard
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.LoseLife, meta: { amount: 1 } })}>
                            Damage
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.GainLife, meta: { amount: 1 } })}>
                            Heal
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.RevealFromHand })}>
                            Reveal
                        </CommandItem>
                    </CommandGroup>
                    <CommandGroup heading="Basic Actions">
                        <CommandItem onSelect={() => handleSelect({ type: EventType.AddToHand, duration: 1 })}>
                            Add to Hand
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.RemoveFromHand })}>
                            Remove from Hand
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.LoseLife, meta: { amount: 1 } })}>
                            Lose Life
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.GainLife, meta: { amount: 1 } })}>
                            Gain Life
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.RevealFromHand })}>
                            Reveal from Hand
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.StackDeck, meta: { cards: [] } })}>
                            Stack Deck
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.UnstackDeck })}>
                            Unstack Deck
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.DisplayCard, duration: 5, resizable: true })}>
                            Display Card
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.Win })}>
                            Win
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.Reset })}>
                            Reset
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.HideUi })}>
                            Hide UI
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.ShowUi })}>
                            Show UI
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        </CommandDialog>
    );
}

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
    onMoveEvent?: (moves: NLEMoveResult[], newTracksInfo?: Map<string, { groupId: string; eventLayer: number; targetLocalIndex: number }>) => void;
    onUpdateEvent?: (trackId: string, eventId: number, time: number, duration: number) => void;
    onDeleteEvents: (items: DeleteItem[]) => void;
    onCopyEvent?: (trackId: string, eventId: number) => void;
    onDuplicateEvents?: (items: DuplicateItem[], onCreated: (newIds: number[]) => void) => void;
    onPasteEvents?: (items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => void;
    onCreateEvent?: (trackId: string, partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>, onCreated?: (id: number) => void) => void;
    onSelectionChange?: (ids: Set<number>) => void;
    onDeleteClips?: (items: { trackId: string; clipId: string }[]) => void;
    onDeleteSelection?: (eventItems: DeleteItem[], clipItems: { trackId: string; clipId: string }[]) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    onAddTrack?: (groupId: string, trackId: string, position: 'above' | 'below') => void;
    onDeleteTrack?: (groupId: string, trackId: string) => void;
    sources?: MediaSource[];
    onDropSource?: (trackId: string, sourceId: string, time: number) => void;
    onMoveClips?: (moves: ClipMoveResult[]) => void;
    onDeleteClip?: (trackId: string, clipId: string) => void;
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
    onCreateEvent,
    onSelectionChange,
    onResizeStart,
    onResizeEnd,
    onAddTrack,
    onDeleteTrack,
    sources,
    onDropSource,
    onMoveClips,
    onDeleteClip,
    onDeleteClips,
    onDeleteSelection,
}: NLETimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<NLECursorHandle>(null);
    const scrollBoundaryRef = useRef<HTMLDivElement>(null);
    const trackElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerWidthRef = useRef(0);

    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } =
        useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom();
    useTimelineViewport(scrollLeftRef, zoomRef, containerWidthRef);
    const { selectedIds, selectedClipIds, select, selectClip, selectMany, clearSelection } = useTimelineSelection();
    // Refs so that callbacks passed through NLEEvent/NLEClip.memo always read fresh values
    // without recreating on every selection/trackGroups change.
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const selectedClipIdsRef = useRef(selectedClipIds);
    selectedClipIdsRef.current = selectedClipIds;

    useEffect(() => {
        onSelectionChange?.(selectedIds);
    }, [selectedIds, onSelectionChange]);

    // Collect tracks by type in DOM order
    const eventTracks = useMemo(
        () => trackGroups.flatMap((g) => g.tracks).filter((t) => t.type === TrackType.Event),
        [trackGroups],
    );
    const eventTrackGroups = useMemo(
        () => trackGroups
            .filter((g) => g.tracks.some((t) => t.type === TrackType.Event))
            .map((g) => ({ id: g.id, tracks: g.tracks.filter((t) => t.type === TrackType.Event) })),
        [trackGroups],
    );
    const videoTracks = useMemo(
        () => trackGroups.flatMap((g) => g.tracks).filter((t) => t.type === TrackType.Video),
        [trackGroups],
    );
    const audioTracks = useMemo(
        () => trackGroups.flatMap((g) => g.tracks).filter((t) => t.type === TrackType.Audio),
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
    const eventTracksRef = useRef(eventTracks);
    eventTracksRef.current = eventTracks;

    // Map clipId → trackId for fast lookup during delete
    const clipTrackByClipId = useMemo(() => {
        const map = new Map<string, string>();
        for (const track of [...videoTracks, ...audioTracks]) {
            for (const clip of track.clips ?? []) {
                map.set(clip.id, track.id);
            }
        }
        return map;
    }, [videoTracks, audioTracks]);
    const clipTrackByClipIdRef = useRef(clipTrackByClipId);
    clipTrackByClipIdRef.current = clipTrackByClipId;

    const handleMoveEvents = useCallback(
        (moves: NLEMoveResult[], newTracksInfo?: Map<string, { groupId: string; eventLayer: number; targetLocalIndex: number }>) => {
            onMoveEvent?.(moves, newTracksInfo);
        },
        [onMoveEvent],
    );

    const handleMoveClips = useCallback(
        (moves: ClipMoveResult[]) => onMoveClips?.(moves),
        [onMoveClips],
    );

    const {
        eventGhostsByTrack,
        clipGhostsByTrack,
        draggingEventIds,
        draggingClipIds,
        handleEventDragStart,
        handleClipDragStart,
    } = useNLEElementDrag(
        zoomRef,
        scrollLeftRef,
        setScroll,
        trackElsRef,
        scrollBoundaryRef,
        eventTracks,
        videoTracks,
        audioTracks,
        eventTrackGroups,
        selectedIds,
        selectedClipIds,
        handleMoveEvents,
        handleMoveClips,
    );

    const sourceNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const s of sources ?? []) map.set(s.id, s.name);
        return map;
    }, [sources]);

    const waveformMap = useWaveformPeaks(sources ?? []);

    const allClips = useMemo<ClipInfo[]>(
        () => [...videoTracks, ...audioTracks].flatMap((t) =>
            (t.clips ?? []).map((c) => ({
                id: c.id,
                sourceId: c.sourceId,
                sourceOffset: c.sourceOffset,
                duration: c.duration,
            })),
        ),
        [videoTracks, audioTracks],
    );
    const thumbnailMap = useVideoThumbnails(sources ?? [], allClips);

    const zoomPercent = Math.round(
        ((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100
    );

    const handleZoomChange = (percent: number) => {
        const clamped = Math.max(0, Math.min(100, percent));
        const pxPerSec = MIN_ZOOM + (clamped / 100) * (MAX_ZOOM - MIN_ZOOM);
        const pivotPx = (contentRef.current?.clientWidth ?? 0) / 2;
        const newScroll = setZoom(pxPerSec, pivotPx, scrollLeftRef.current);
        setScroll(newScroll);
        updateCursorPosition();
    };

    const updateCursorPosition = useCallback(() => {
        cursorRef.current?.setPosition(
            TIMELINE_PADDING_X + currentTimeRef.current * zoomRef.current - scrollLeftRef.current
        );
    }, []); // stable — reads only refs

    const handleSetCurrentTime = useCallback((t: number) => {
        setCurrentTime(t);
        updateCursorPosition();
    }, [setCurrentTime, updateCursorPosition]);

    useEffect(() => subscribe((_x) => updateCursorPosition()), [subscribe, updateCursorPosition]);

    const { seekTo } = usePlayhead(
        isPlaying,
        duration,
        currentTimeRef,
        zoomRef,
        handleSetCurrentTime,
        updateCursorPosition,
    );

    useEffect(() => { updateCursorPosition(); }, [updateCursorPosition]);

    // Target player state — which Event group receives Ctrl+K events
    const [targetGroupId, setTargetGroupId] = useState<string | undefined>(undefined);
    useEffect(() => {
        const first = trackGroups.find((g) => g.type === TrackType.Event);
        if (first && !targetGroupId) setTargetGroupId(first.id);
    }, [trackGroups, targetGroupId]);

    const targetGroupIdRef = useRef(targetGroupId);
    targetGroupIdRef.current = targetGroupId;
    const trackGroupsRef = useRef(trackGroups);
    trackGroupsRef.current = trackGroups;
    const panelHandlesRef = useRef<Map<string, PanelImperativeHandle>>(new Map());

    // Target gets 70% of event-panel space; non-targets share 30% equally.
    // Uses per-panel resize() so no `id` prop needed on panels (avoids library handle mapping bugs).
    const applyFocusLayout = useCallback((newTargetId: string) => {
        const groups = trackGroupsRef.current;
        const handles = panelHandlesRef.current;
        const eventGroups = groups.filter((g) => g.type === TrackType.Event);
        const nonEventGroups = groups.filter((g) => g.type !== TrackType.Event);

        // Measure current non-event sizes to compute remaining event space
        const nonEventTotal = nonEventGroups.reduce((sum, g) => {
            const pct = handles.get(g.id)?.getSize().asPercentage ?? (100 / groups.length);
            return sum + pct;
        }, 0);

        const eventSpace = 100 - nonEventTotal;
        const nonTargetCount = eventGroups.length - 1;
        const targetPct = eventSpace * 1;
        const otherPct = nonTargetCount > 0 ? (eventSpace * 0.3) / nonTargetCount : 0;

        for (const g of eventGroups) {
            handles.get(g.id)?.resize(`${g.id === newTargetId ? targetPct : otherPct}%`);
        }
    }, []);

    // Copy / paste state
    const [copiedItems, setCopiedItems] = useState<PasteItem[]>([]);

    // Create event state
    const [createOpen, setCreateOpen] = useState(false);
    const [createTrackId, setCreateTrackId] = useState<string | undefined>(undefined);
    const createTimeRef = useRef<number | undefined>(undefined);
    const pendingSelectRef = useRef<number[]>([]);

    // TAB cycles target player forward; Shift+TAB backward
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || createOpen) return;
            const active = document.activeElement;
            if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)) return;
            e.preventDefault();
            const eventGroups = trackGroups.filter((g) => g.type === TrackType.Event);
            if (eventGroups.length === 0) return;
            const cur = eventGroups.findIndex((g) => g.id === targetGroupId);
            const next = eventGroups[(cur + (e.shiftKey ? eventGroups.length - 1 : 1)) % eventGroups.length];
            setTargetGroupId(next.id);
            applyFocusLayout(next.id);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [trackGroups, targetGroupId, createOpen]);

    // After a duplicate/paste render, select the newly created events before paint
    useLayoutEffect(() => {
        if (pendingSelectRef.current.length === 0) return;
        const toSelect = pendingSelectRef.current.filter((id) => trackByEventId.has(id));
        pendingSelectRef.current = [];
        if (toSelect.length > 0) selectMany(toSelect, []);
    }, [trackByEventId, selectMany]);

    const handleDelete = useCallback(() => {
        const eventItems: DeleteItem[] = [];
        for (const id of selectedIdsRef.current) {
            const trackId = trackByEventIdRef.current.get(id);
            if (trackId) eventItems.push({ trackId, eventId: id });
        }

        const clipItems: { trackId: string; clipId: string }[] = [];
        for (const clipId of selectedClipIdsRef.current) {
            const trackId = clipTrackByClipIdRef.current.get(clipId);
            if (trackId) clipItems.push({ trackId, clipId });
        }

        if (eventItems.length === 0 && clipItems.length === 0) return;

        if (onDeleteSelection) {
            onDeleteSelection(eventItems, clipItems);
        } else {
            if (eventItems.length > 0) onDeleteEvents(eventItems);
            if (clipItems.length > 0) onDeleteClips?.(clipItems);
        }
        clearSelection();
    }, [onDeleteSelection, onDeleteEvents, onDeleteClips, clearSelection]);

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
        const sel = selectedIdsRef.current;
        const items: DuplicateItem[] = sel.has(eventId)
            ? eventTracksRef.current.flatMap((t) =>
                  t.events
                      .filter((e) => sel.has(e.id))
                      .map((e) => ({ trackId: t.id, eventId: e.id }))
              )
            : [{ trackId, eventId }];
        onDuplicateEvents(items, (newIds) => { pendingSelectRef.current = newIds; });
    }, [onDuplicateEvents]);

    const handlePaste = useCallback((pasteTime: number) => {
        if (copiedItems.length === 0) return;
        onPasteEvents?.(copiedItems, pasteTime, (newIds) => { pendingSelectRef.current = newIds; });
    }, [copiedItems, onPasteEvents, selectMany]);

    const handleCreateOpenChange = useCallback((open: boolean) => {
        if (open) {
            createTimeRef.current = undefined;
            if (!createTrackId) {
                const targetGroup = trackGroupsRef.current.find((g) => g.id === targetGroupIdRef.current);
                setCreateTrackId(targetGroup?.tracks[0]?.id ?? eventTracksRef.current[0]?.id);
            }
        } else {
            createTimeRef.current = undefined;
            setCreateTrackId(undefined);
        }
        setCreateOpen(open);
    }, [createTrackId]);

    const handleOpenCreateDialog = useCallback((trackId: string, time: number) => {
        setCreateTrackId(trackId);
        createTimeRef.current = time;
        setCreateOpen(true);
    }, []);

    const handleCreateEventForTrack = useCallback((partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => {
        if (!createTrackId) return;
        const t = createTimeRef.current;
        const finalPartial = t !== undefined ? { ...partial, time: t } : partial;
        onCreateEvent?.(createTrackId, finalPartial, (id) => { pendingSelectRef.current = [id]; });
    }, [createTrackId, onCreateEvent]);

    useTimelineKeyboard({
        onDelete: handleDelete,
        onCopy: handleCopy,
        onPaste: () => handlePaste(currentTimeRef.current),
        onUndo,
        onRedo,
        onSeek: seekTo,
        currentTimeRef,
        duration,
    });

    const { marqueeRect, handleMarqueeMouseDown } = useNLEMarqueeDrag(
        scrollBoundaryRef,
        trackElsRef,
        eventTracks,
        [...videoTracks, ...audioTracks],
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
            className="flex flex-col h-full bg-background select-none"
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
                className="flex flex-col flex-1 overflow-hidden bg-background pl-4 pb-4"
            >
                <div className="flex flex-col flex-1 relative">
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
                        className="flex-1"
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
                <div
                    ref={scrollBoundaryRef}
                    className="flex-1 overflow-hidden relative"
                    onMouseDown={handleMarqueeMouseDown}
                >
                    <ResizablePanelGroup orientation="vertical" className="h-full overflow-x-hidden">
                        {trackGroups.flatMap((group, i) => [
                            <ResizablePanel
                                key={group.id}
                                defaultSize={100 / trackGroups.length}
                                className="overflow-y-auto"
                                minSize={TRACK_HEIGHT + 2}
                                groupResizeBehavior={group.type === TrackType.Event ? 'preserve-relative-size' : 'preserve-pixel-size'}
                                panelRef={(h) => {
                                    if (h) panelHandlesRef.current.set(group.id, h);
                                    else panelHandlesRef.current.delete(group.id);
                                }}
                            >
                                <TrackGroup
                                    icon={TrackTypeIconMap[group.type]}
                                    label={group.label}
                                    isTarget={group.id === targetGroupId}
                                    onSelect={group.type === TrackType.Event ? () => {
                                        setTargetGroupId(group.id);
                                        applyFocusLayout(group.id);
                                    } : undefined}
                                >
                                    {group.tracks.map((track, i) => {
                                        const index = group.tracks.slice(0, i + 1).length;
                                        return (
                                        <Track
                                            key={track.id}
                                            track={track}
                                            trackId={track.id}
                                            index={index}
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
                                            draggingIds={draggingEventIds}
                                            ghosts={eventGhostsByTrack.get(track.id)}
                                            onSelect={(id, additive) => select(id, additive)}
                                            onDeselect={clearSelection}
                                            onMoveStart={(tId, eventId, e, time, dur) =>
                                                handleEventDragStart(tId, eventId, e, time, dur)
                                            }
                                            onUpdate={onUpdateEvent}
                                            onResizeStart={onResizeStart}
                                            onResizeEnd={onResizeEnd}
                                            onDeleteSelected={() => handleDelete()}
                                            onCopy={(_tId, _eId) => handleCopy()}
                                            onDuplicate={onDuplicateEvents ? handleDuplicateForEvent : undefined}
                                            onOpenCreateDialog={group.type === TrackType.Event
                                                ? (time) => handleOpenCreateDialog(track.id, time)
                                                : undefined}
                                            onPasteAtTime={handlePaste}
                                            canPaste={copiedItems.length > 0}
                                            onUndo={onUndo}
                                            canUndo={canUndo}
                                            onRedo={onRedo}
                                            canRedo={canRedo}
                                            onAddTrackAbove={() => onAddTrack?.(group.id, track.id, 'above')}
                                            onAddTrackBelow={() => onAddTrack?.(group.id, track.id, 'below')}
                                            onDeleteTrack={() => onDeleteTrack?.(group.id, track.id)}
                                            canDeleteTrack={group.tracks.length > 1}
                                            clips={track.clips}
                                            clipGhosts={clipGhostsByTrack.get(track.id)}
                                            draggingClipIds={draggingClipIds}
                                            selectedClipIds={selectedClipIds}
                                            sourceNameMap={sourceNameMap}
                                            onClipMoveStart={(tId, clip, e) => handleClipDragStart(tId, clip, e)}
                                            onSelectClip={(_tId, clipId, additive) => selectClip(clipId, additive)}
                                            onDeleteClip={onDeleteClip}
                                            onDropSource={onDropSource ? (sourceId, time) => onDropSource(track.id, sourceId, time) : undefined}
                                            acceptSourceType={track.type === TrackType.Video ? 'video' : track.type === TrackType.Audio ? 'audio' : undefined}
                                            waveformMap={waveformMap}
                                            thumbnailMap={thumbnailMap}
                                        />
                                        );
                                    })}
                                </TrackGroup>
                            </ResizablePanel>,
                            ...(i < trackGroups.length - 1
                                ? [<ResizableHandle key={`handle-${group.id}`} className="aria-[orientation=horizontal]:h-1 bg-zinc-950" />]
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
                <div
                    className="absolute inset-y-0 pointer-events-none overflow-hidden"
                    style={{ left: TRACK_GROUP_LABEL_WIDTH + TRACK_INFO_WIDTH, right: 0 }}
                >
                    <NLECursor
                        ref={cursorRef}
                        setIsPlaying={setIsPlaying}
                        scrollAreaRef={scrollAreaRef}
                        onSeek={seekTo}
                        zoomRef={zoomRef}
                        scrollLeftRef={scrollLeftRef}
                        paddingX={TIMELINE_PADDING_X}
                        duration={duration}
                    />
                </div>
                </div>
            </div>
            <NLECreateDialog
                open={createOpen}
                onOpenChange={handleCreateOpenChange}
                setIsPlaying={setIsPlaying}
                onCreateEvent={handleCreateEventForTrack}
            />
        </div>
    );
}
