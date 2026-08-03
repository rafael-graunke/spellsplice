import { memo, useRef, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import Cursor from './Cursor';
import type { CursorHandle } from './Cursor';
import type { RefObject } from 'react';
import Controls from './Controls';
import { Track, TrackGroup } from './Track';
import Ruler from './Ruler';
import type { TimelineTrackGroup } from './types';
import { TrackType, TrackTypeIconMap } from './types';
import type { TrackEvent } from '../../types/event';
import { EventType } from '../../types/event';
import { DEFAULT_ANNOTATION_SLOT_ID } from '../../types/config';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { usePlayhead } from './hooks/usePlayhead';
import { useTimelineSelection } from './hooks/useTimelineSelection';
import { useTimelineKeyboard } from './hooks/useTimelineKeyboard';
import { useElementDrag } from './hooks/useElementDrag';
import { useMarqueeDrag } from './hooks/useMarqueeDrag';
import type { MoveResult, ClipMoveResult } from './hooks/hookTypes';
import type { MediaSource } from '../../types/source';
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
} from './constants';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../components/ui/resizable';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../../components/ui/command';

const TIMELINE_PADDING_X = 30;

export type ViewMode = 'full' | 'event' | 'video';

interface CreateEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    setIsPlaying: (v: boolean) => void;
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
    displayCardDuration: number;
}

function CreateEventDialog({ open, onOpenChange, setIsPlaying, onCreateEvent, displayCardDuration }: CreateEventDialogProps) {
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
                        <CommandItem onSelect={() => handleSelect({ type: EventType.AnnotateCard, meta: { annotationId: DEFAULT_ANNOTATION_SLOT_ID, cards: [] } })}>
                            Annotate Card
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.UnannotateCard, meta: { annotationId: DEFAULT_ANNOTATION_SLOT_ID, cards: [] } })}>
                            Clear Annotation
                        </CommandItem>
                        <CommandItem onSelect={() => handleSelect({ type: EventType.DisplayCard, duration: displayCardDuration, resizable: true })}>
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

interface TimelineProps {
    duration: number;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    currentTimeRef: RefObject<number>;
    onSeek: (t: number) => void;
    trackGroups: TimelineTrackGroup[];
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onMoveEvent?: (moves: MoveResult[], newTracksInfo?: Map<string, { groupId: string; eventLayer: number; targetLocalIndex: number }>) => void;
    onUpdateEvent?: (trackId: string, eventId: number, time: number, duration: number) => void;
    onDeleteEvents: (items: DeleteItem[]) => void;
    onCopyEvent?: (trackId: string, eventId: number) => void;
    onDuplicateEvents?: (items: DuplicateItem[], onCreated: (newIds: number[]) => void) => void;
    onPasteEvents?: (items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => void;
    onCreateEvent?: (trackId: string, partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>, onCreated?: (id: number) => void) => void;
    onSelectionChange?: (ids: Set<number>) => void;
    onClipSelectionChange?: (ids: Set<string>) => void;
    // External (preview-click) selection request; nonce re-fires the same id.
    clipSelectionRequest?: { clipId: string | null; nonce: number } | null;
    onDeleteClips?: (items: { trackId: string; clipId: string }[]) => void;
    onDeleteSelection?: (eventItems: DeleteItem[], clipItems: { trackId: string; clipId: string }[]) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    onAddTrack?: (groupId: string, trackId: string, position: 'above' | 'below') => void;
    onDeleteTrack?: (groupId: string, trackId: string) => void;
    onUpdateTrack?: (trackId: string, field: 'isHidden' | 'isMuted' | 'isBlocked') => void;
    sources?: MediaSource[];
    onDropSource?: (trackId: string, sourceId: string, time: number) => void;
    onMoveClips?: (moves: ClipMoveResult[]) => void;
    onDeleteClip?: (trackId: string, clipId: string) => void;
    initialZoom?: number;
    onZoomChange?: (zoom: number) => void;
    initialViewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    displayCardDuration?: number;
}

function TimelineInner({
    duration,
    isPlaying,
    setIsPlaying,
    currentTimeRef,
    onSeek,
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
    onClipSelectionChange,
    clipSelectionRequest,
    onResizeStart,
    onResizeEnd,
    onAddTrack,
    onDeleteTrack,
    onUpdateTrack,
    sources,
    onDropSource,
    onMoveClips,
    onDeleteClip,
    onDeleteClips,
    onDeleteSelection,
    initialZoom,
    onZoomChange,
    initialViewMode,
    onViewModeChange,
    displayCardDuration = 5,
}: TimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<CursorHandle>(null);
    const scrollBoundaryRef = useRef<HTMLDivElement>(null);
    const trackElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const containerWidthRef = useRef(0);

    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } =
        useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom(initialZoom ?? 20);
    useEffect(() => { onZoomChange?.(zoom); }, [zoom, onZoomChange]);
    useTimelineViewport(scrollLeftRef, zoomRef, containerWidthRef);

    const [containerWidth, setContainerWidth] = useState(0);
    useEffect(() => {
        const el = scrollAreaRef.current;
        if (!el) return;
        const apply = (w: number) => {
            containerWidthRef.current = w;
            setContainerWidth(w);
        };
        apply(el.clientWidth);
        const ro = new ResizeObserver(([entry]) => apply(entry.contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Content plus one screenful of runway to drag into. `duration` (content)
    // still drives playback stop and skip-to-end.
    const viewExtent = useMemo(
        () => duration + (containerWidth > 0 ? containerWidth / zoom : 0),
        [duration, containerWidth, zoom],
    );
    const { selectedIds, selectedClipIds, select, selectClip, selectMany, clearSelection } = useTimelineSelection();
    // Refs so that callbacks passed through TimelineEvent/TimelineClip.memo always read fresh values
    // without recreating on every selection/trackGroups change.
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const selectedClipIdsRef = useRef(selectedClipIds);
    selectedClipIdsRef.current = selectedClipIds;

    useEffect(() => {
        onSelectionChange?.(selectedIds);
    }, [selectedIds, onSelectionChange]);

    useEffect(() => {
        onClipSelectionChange?.(selectedClipIds);
    }, [selectedClipIds, onClipSelectionChange]);

    // Apply a preview-click selection request (App -> Timeline direction).
    useEffect(() => {
        if (!clipSelectionRequest) return;
        if (clipSelectionRequest.clipId) selectClip(clipSelectionRequest.clipId);
        else clearSelection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clipSelectionRequest?.nonce]);

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

    const blockedTrackIds = useMemo(
        () => new Set(trackGroups.flatMap((g) => g.tracks).filter((t) => t.isBlocked).map((t) => t.id)),
        [trackGroups],
    );
    const blockedTrackIdsRef = useRef(blockedTrackIds);
    blockedTrackIdsRef.current = blockedTrackIds;

    const blockedTrackIdsKey = useMemo(
        () => [...blockedTrackIds].sort().join(','),
        [blockedTrackIds],
    );
    useEffect(() => {
        clearSelection();
    }, [blockedTrackIdsKey, clearSelection]);

    const handleMoveEvents = useCallback(
        (moves: MoveResult[], newTracksInfo?: Map<string, { groupId: string; eventLayer: number; targetLocalIndex: number }>) => {
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
    } = useElementDrag(
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

    const sourceOfflineIds = useMemo(() => {
        const set = new Set<string>();
        for (const s of sources ?? []) {
            if (!s.file && !s.loading) set.add(s.id);
        }
        return set;
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
        onSeek(t);
        updateCursorPosition();
    }, [onSeek, updateCursorPosition]);

    useEffect(() => subscribe((_x) => updateCursorPosition()), [subscribe, updateCursorPosition]);

    const { seekTo } = usePlayhead(
        isPlaying,
        viewExtent,
        currentTimeRef,
        zoomRef,
        handleSetCurrentTime,
        updateCursorPosition,
    );

    useEffect(() => { updateCursorPosition(); }, [updateCursorPosition]);

    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode ?? 'full');
    useEffect(() => {
        onViewModeChange?.(viewMode);
    }, [viewMode, onViewModeChange]);
    const visibleGroups = useMemo(() => {
        if (viewMode === 'event') return trackGroups.filter((g) => g.type === TrackType.Event);
        if (viewMode === 'video') return trackGroups.filter((g) => g.type === TrackType.Video || g.type === TrackType.Audio);
        return trackGroups;
    }, [trackGroups, viewMode]);

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
            if (trackId && !blockedTrackIdsRef.current.has(trackId)) eventItems.push({ trackId, eventId: id });
        }

        const clipItems: { trackId: string; clipId: string }[] = [];
        for (const clipId of selectedClipIdsRef.current) {
            const trackId = clipTrackByClipIdRef.current.get(clipId);
            if (trackId && !blockedTrackIdsRef.current.has(trackId)) clipItems.push({ trackId, clipId });
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
        duration: viewExtent,
    });

    const { marqueeRect, handleMarqueeMouseDown } = useMarqueeDrag(
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
            <Controls
                zoom={zoomPercent}
                onZoomChange={handleZoomChange}
                viewMode={viewMode}
                setViewMode={setViewMode}
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
                        <Ruler
                            duration={viewExtent}
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
                        {visibleGroups.flatMap((group, i) => [
                            <ResizablePanel
                                key={group.id}
                                defaultSize={100 / visibleGroups.length}
                                className="overflow-y-auto"
                                minSize={TRACK_HEIGHT + 2}
                                groupResizeBehavior={group.type === TrackType.Event ? 'preserve-relative-size' : 'preserve-pixel-size'}
                            >
                                <TrackGroup
                                    icon={TrackTypeIconMap[group.type]}
                                    label={group.label}
                                    isTarget={group.id === targetGroupId}
                                    onSelect={group.type === TrackType.Event ? () => setTargetGroupId(group.id) : undefined}
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
                                            duration={viewExtent}
                                            zoom={zoom}
                                            paddingX={TIMELINE_PADDING_X}
                                            scrollLeftRef={scrollLeftRef}
                                            subscribe={subscribe}
                                            onToggleBlocked={() => onUpdateTrack?.(track.id, 'isBlocked')}
                                            onToggleHidden={() => onUpdateTrack?.(track.id, 'isHidden')}
                                            onToggleMuted={() => onUpdateTrack?.(track.id, 'isMuted')}
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
                                            sourceOfflineIds={sourceOfflineIds}
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
                    <Cursor
                        ref={cursorRef}
                        setIsPlaying={setIsPlaying}
                        scrollAreaRef={scrollAreaRef}
                        onSeek={seekTo}
                        zoomRef={zoomRef}
                        scrollLeftRef={scrollLeftRef}
                        paddingX={TIMELINE_PADDING_X}
                        duration={viewExtent}
                    />
                </div>
                </div>
            </div>
            <CreateEventDialog
                open={createOpen}
                onOpenChange={handleCreateOpenChange}
                setIsPlaying={setIsPlaying}
                onCreateEvent={handleCreateEventForTrack}
                displayCardDuration={displayCardDuration}
            />
        </div>
    );
}

// Memoized: App re-renders ~10Hz during playback (currentTime state), but this
// tree takes currentTimeRef (imperative playhead), not currentTime, so its props
// are stable across ticks. Without memo the whole timeline (every track + each
// event's Radix menu stack) reconciled on every tick. See usePlayerTracks for
// the useCallback-stable handlers this relies on.
export const Timeline = memo(TimelineInner);
