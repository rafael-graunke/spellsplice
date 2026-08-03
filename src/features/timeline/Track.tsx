import { useRef, useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { WaveformData } from '@/hooks/useWaveformPeaks';
import type { ClipThumbnails } from '@/hooks/useVideoThumbnails';
import { ChevronDown, ChevronRight, Eye, EyeOff, Link, Link2Off, Lock, Volume2, VolumeOff } from 'lucide-react';
import type { TimelineTrack } from './types';
import { TrackType, TrackTypeColorMap } from './types';
import type { TrackEvent } from '../../types/event';
import type { Clip } from '../../types/clip';
import type { TrimEdge } from './editOps';
import type { GhostPos, ClipGhostPos } from './hooks/hookTypes';
import TimelineEvent from './TimelineEvent';
import { TimelineClip } from './TimelineClip';
import EventIcon, { type SvgIcon } from './EventIcon';
import {
    COLLAPSED_GROUP_HEIGHT,
    MAX_TRACK_HEIGHT,
    MIN_TRACK_HEIGHT,
    TRACK_HEIGHT,
    TRACK_HEIGHT_PRESETS,
    TRACK_INFO_WIDTH,
    TRACK_GROUP_LABEL_WIDTH,
} from './constants';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../../components/ui/tooltip';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '../../components/ui/context-menu';
import { modKey } from '@/lib/platform';

interface TrackGroupProps {
    children: ReactNode;
    label: string;
    icon?: SvgIcon;
    isTarget?: boolean;
    collapsed?: boolean;
    onSelect?: () => void;
    onToggleCollapse?: () => void;
}

export function TrackGroup({ children, label, icon, isTarget, collapsed, onSelect, onToggleCollapse }: TrackGroupProps) {
    const innerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLParagraphElement>(null);
    const [overflows, setOverflows] = useState(false);
    const Icon = icon;

    useEffect(() => {
        const inner = innerRef.current;
        const measure = measureRef.current;
        if (!inner || !measure) return;
        const obs = new ResizeObserver(() => {
            setOverflows(measure.clientHeight > inner.clientHeight);
        });
        obs.observe(inner);
        obs.observe(measure);
        return () => obs.disconnect();
    }, []);

    if (collapsed) {
        return (
            <div
                className="flex flex-row items-center gap-1.5 bg-zinc-800 border-y border-zinc-600 px-1 text-zinc-400"
                style={{ height: COLLAPSED_GROUP_HEIGHT }}
            >
                <button
                    className="hover:text-zinc-200 transition-colors"
                    aria-label={`Expand ${label}`}
                    onClick={onToggleCollapse}
                >
                    <ChevronRight className="size-3.5" />
                </button>
                {Icon && <Icon className="size-3.5 shrink-0" />}
                <span className="truncate text-xs">{label}</span>
            </div>
        );
    }

    return (
            <div className="flex flex-row overflow-hidden">
                <div
                    style={{ width: TRACK_GROUP_LABEL_WIDTH }}
                    className={cn(
                        "bg-zinc-800 text-zinc-300 relative flex flex-col items-center justify-center gap-1 text-sm py-1",
                        "rounded-l-md border",
                        isTarget && "bg-zinc-700 border-zinc-500",
                        onSelect && "cursor-pointer",
                    )}
                    onClick={onSelect}
                >
                    {onToggleCollapse && (
                        <button
                            className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors"
                            aria-label={`Collapse ${label}`}
                            onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
                        >
                            <ChevronDown className="size-3.5" />
                        </button>
                    )}
                    {/* measurement element — outside overflow:hidden so clientHeight is unclamped */}
                    <p ref={measureRef} aria-hidden className={
                        cn(
                            "absolute invisible whitespace-nowrap [writing-mode:sideways-lr]",
                        )}
                    >{label}</p>
                    {/* inner wrapper lives inside the padding area; clientHeight = usable space */}
                    {/* flex-1, not h-full: the collapse chevron above it now
                        takes part of the strip, so 100% would overflow. */}
                    <div ref={innerRef} className="flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center">
                        {overflows ? (
                            Icon ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center justify-center">
                                                <Icon className={cn("size-4", isTarget ? "stroke-3" : "")} />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">{label}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <></>
                            )
                        ) : (
                            <p className={
                                cn(
                            "whitespace-nowrap [writing-mode:sideways-lr]",
                        )
                            }>{label}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col-reverse flex-1 bg-zinc-800 border-y border-zinc-600">
                    {children}
                </div>
            </div>
    );
}

const TRACK_TYPE_PREFIX: Record<string, string> = {
    [TrackType.Event]: 'E',
    [TrackType.Video]: 'V',
    [TrackType.Audio]: 'A',
};

interface TrackInfoProps {
    type: TimelineTrack['type'];
    index: number;
    height: number;
    onResizeHeight?: (height: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
    syncLock?: boolean;
    onToggleBlocked: () => void;
    onToggleHidden?: () => void;
    onToggleMuted?: () => void;
    onToggleSyncLock?: () => void;
}

export function TrackInfo({
    type,
    index,
    height,
    onResizeHeight,
    onResizeStart,
    onResizeEnd,
    isBlocked,
    isHidden,
    isMuted,
    syncLock,
    onToggleBlocked,
    onToggleHidden,
    onToggleMuted,
    onToggleSyncLock,
}: TrackInfoProps) {
    const showVisibility = type === TrackType.Video;
    const showMute = type === TrackType.Audio;

    // Dragging the bottom edge of the header resizes the track, which is where
    // Premiere and Resolve put it.
    const startHeightDrag = (e: React.MouseEvent) => {
        if (!onResizeHeight) return;
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startHeight = height;
        onResizeStart?.();
        const onMove = (ev: MouseEvent) => {
            onResizeHeight(
                Math.round(Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, startHeight + (ev.clientY - startY)))),
            );
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            onResizeEnd?.();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };
    // Undefined means "never configured", which is locked — ripple edits move
    // every track unless one is explicitly opted out.
    const locked = syncLock !== false;

    return (
        <div
            className="relative shrink-0 flex items-center justify-between bg-zinc-900"
            style={{ width: TRACK_INFO_WIDTH, height }}
        >
            <span
                className={cn(
                    'text-sm font-bold text-zinc-200 w-10 h-full flex items-center justify-center',
                    TrackTypeColorMap[type]
                )}
            >
                {`${TRACK_TYPE_PREFIX[type] ?? '?'}${index}`}
            </span>
            <div className="h-full w-full border-t border-zinc-600 flex items-center justify-end">
                <div className="flex items-center gap-1 px-2">
                    {onToggleSyncLock && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                        onClick={onToggleSyncLock}
                                    >
                                        {locked ? <Link size={14} /> : <Link2Off size={14} className="text-zinc-600" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    {locked ? 'Sync lock on — ripple edits move this track' : 'Sync lock off'}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    {showVisibility && (
                        <button
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            onClick={onToggleHidden}
                        >
                            {isHidden ? (
                                <EyeOff size={14} />
                            ) : (
                                <Eye size={14} />
                            )}
                        </button>
                    )}
                    {showMute && (
                        <button
                            className="text-zinc-500 hover:text-zinc-300 transition-colors"
                            onClick={onToggleMuted}
                        >
                            {isMuted ? (
                                <VolumeOff size={14} />
                            ) : (
                                <Volume2 size={14} />
                            )}
                        </button>
                    )}
                    <button
                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        onClick={onToggleBlocked}
                    >
                        <Lock
                            size={14}
                            className={isBlocked ? 'text-amber-400' : ''}
                        />
                    </button>
                </div>
            </div>
            {onResizeHeight && (
                <div
                    className="absolute inset-x-0 bottom-0 h-1 cursor-ns-resize hover:bg-white/30"
                    onMouseDown={startHeightDrag}
                />
            )}
        </div>
    );
}

interface TrackContentProps {
    children?: ReactNode;
    height: number;
    duration: number;
    zoom: number;
    paddingX?: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
    ghosts?: GhostPos[];
    clipGhosts?: ClipGhostPos[];
    isBlocked?: boolean;
    onDeselect?: () => void;
    onOpenCreateDialog?: (time: number) => void;
    onPasteAtTime?: (time: number) => void;
    canPaste?: boolean;
    onUndo?: () => void;
    canUndo?: boolean;
    onRedo?: () => void;
    canRedo?: boolean;
    onAddTrackAbove?: () => void;
    onAddTrackBelow?: () => void;
    onDeleteTrack?: () => void;
    canDeleteTrack?: boolean;
    onDropSource?: (sourceId: string, time: number) => void;
    acceptSourceType?: 'video' | 'audio';
    onCloseGapAtTime?: (time: number) => void;
    onCloseAllGaps?: () => void;
    onSetGroupHeight?: (height: number) => void;
}

export function TrackContent({
    children,
    height,
    duration,
    zoom,
    paddingX = 0,
    scrollLeftRef,
    subscribe,
    ghosts,
    clipGhosts,
    isBlocked,
    onDeselect,
    onOpenCreateDialog,
    onPasteAtTime,
    canPaste,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
    onAddTrackAbove,
    onAddTrackBelow,
    onDeleteTrack,
    canDeleteTrack,
    onDropSource,
    acceptSourceType,
    onCloseGapAtTime,
    onCloseAllGaps,
    onSetGroupHeight,
}: TrackContentProps) {
    const innerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickTimeRef = useRef(0);
    const [isDragOver, setIsDragOver] = useState(false);
    // Tracks whether the mousedown came from this background (not from a child TimelineEvent,
    // which calls stopPropagation). Also stores position so we can suppress deselect if
    // the user dragged (marquee) rather than clicked.
    const bgDownRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        return subscribe((x) => {
            if (innerRef.current)
                innerRef.current.style.transform = `translateX(${-x}px)`;
        });
    }, [subscribe]);

    const getTimeFromClientX = (clientX: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return 0;
        return Math.max(0, (clientX - rect.left + (scrollLeftRef.current ?? 0) - paddingX) / zoom);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    ref={containerRef}
                    className={cn(
                        'flex-1 overflow-hidden border-t border-zinc-600 relative',
                        isDragOver && acceptSourceType && 'ring-2 ring-inset ring-white/40',
                    )}
                    style={{ height }}
                    onMouseDown={onDeselect ? (e) => { bgDownRef.current = { x: e.clientX, y: e.clientY }; } : undefined}
                    onClick={onDeselect ? (e) => {
                        const down = bgDownRef.current;
                        bgDownRef.current = null;
                        if (!down) return; // mousedown was on TimelineEvent (stopPropagation)
                        const dx = e.clientX - down.x;
                        const dy = e.clientY - down.y;
                        if (dx * dx + dy * dy > 25) return; // drag — marquee or event move
                        if (!e.currentTarget.contains(e.target as Node)) return; // portal click
                        onDeselect();
                    } : undefined}
                    onContextMenu={(e) => {
                        clickTimeRef.current = getTimeFromClientX(e.clientX);
                    }}
                    onDragOver={onDropSource && acceptSourceType && !isBlocked ? (e) => {
                        if (e.dataTransfer.types.includes('application/x-spellsplice-source')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                            setIsDragOver(true);
                        }
                    } : undefined}
                    onDragLeave={onDropSource && !isBlocked ? () => setIsDragOver(false) : undefined}
                    onDrop={onDropSource && acceptSourceType && !isBlocked ? (e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        try {
                            const data = JSON.parse(e.dataTransfer.getData('application/x-spellsplice-source'));
                            // Video tracks accept visual sources (video + image); audio accepts audio.
                            const compatible =
                                data.sourceType === acceptSourceType ||
                                (acceptSourceType === 'video' && data.sourceType === 'image');
                            if (!compatible) return;
                            onDropSource(data.sourceId, getTimeFromClientX(e.clientX));
                        } catch {
                            // ignore malformed drag data
                        }
                    } : undefined}
                >
                    <div
                        ref={innerRef}
                        className="absolute inset-y-0"
                        style={{
                            left: paddingX,
                            width: duration * zoom,
                            transform: `translateX(${-(scrollLeftRef.current ?? 0)}px)`,
                        }}
                    >
                        {children}
                        {ghosts?.map((ghost, i) =>
                            ghost.isWaypoint ? (
                                <EventIcon
                                    key={i}
                                    type={ghost.type}
                                    position={ghost.left}
                                    className="opacity-50 pointer-events-none"
                                />
                            ) : (
                                <div
                                    key={i}
                                    className="absolute h-[calc(100%-6px)] top-1/2 -translate-y-1/2 rounded-sm opacity-50 pointer-events-none bg-white/20"
                                    style={{ left: ghost.left, width: ghost.width }}
                                />
                            )
                        )}
                        {clipGhosts?.map((ghost, i) => (
                            <div
                                key={`cg-${i}`}
                                className={`absolute h-full opacity-50 pointer-events-none ${ghost.color}`}
                                style={{ left: ghost.left, width: ghost.width }}
                            />
                        ))}
                    </div>
                    {isBlocked && (
                        <div className="absolute inset-0 z-10 cursor-not-allowed" />
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                {onOpenCreateDialog && !isBlocked && (
                    <>
                        <ContextMenuItem onClick={() => onOpenCreateDialog(clickTimeRef.current)}>
                            Create event
                            <ContextMenuShortcut>{modKey}+K</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                    </>
                )}
                <ContextMenuItem disabled={!canPaste || isBlocked} onClick={() => onPasteAtTime?.(clickTimeRef.current)}>
                    Paste
                    <ContextMenuShortcut>{modKey}+V</ContextMenuShortcut>
                </ContextMenuItem>
                {onCloseGapAtTime && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuItem disabled={isBlocked} onClick={() => onCloseGapAtTime(clickTimeRef.current)}>
                            Close gap
                        </ContextMenuItem>
                        <ContextMenuItem disabled={isBlocked} onClick={onCloseAllGaps}>
                            Close all gaps
                        </ContextMenuItem>
                    </>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem disabled={!canUndo} onClick={onUndo}>
                    Undo
                    <ContextMenuShortcut>{modKey}+Z</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem disabled={!canRedo} onClick={onRedo}>
                    Redo
                    <ContextMenuShortcut>{modKey}+Shift+Z</ContextMenuShortcut>
                </ContextMenuItem>
                {onSetGroupHeight && (
                    <>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                            <ContextMenuSubTrigger>Track height</ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                                {Object.entries(TRACK_HEIGHT_PRESETS).map(([label, value]) => (
                                    <ContextMenuItem key={label} onClick={() => onSetGroupHeight(value)}>
                                        {label}
                                    </ContextMenuItem>
                                ))}
                            </ContextMenuSubContent>
                        </ContextMenuSub>
                    </>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem onClick={onAddTrackAbove}>Add track above</ContextMenuItem>
                <ContextMenuItem onClick={onAddTrackBelow}>Add track below</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                    disabled={!canDeleteTrack}
                    onClick={onDeleteTrack}
                    className="text-destructive focus:text-destructive"
                >
                    Delete track
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

interface TrackProps {
    track: TimelineTrack;
    trackId: string;
    index: number;
    duration: number;
    onResizeHeight?: (height: number) => void;
    onHeightResizeStart?: () => void;
    onHeightResizeEnd?: () => void;
    zoom: number;
    paddingX?: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
    onToggleBlocked: () => void;
    onToggleHidden?: () => void;
    onToggleMuted?: () => void;
    // event track props
    events?: TrackEvent[];
    selectedIds?: Set<number>;
    draggingIds?: Set<number>;
    ghosts?: GhostPos[];
    onSelect?: (id: number, additive: boolean) => void;
    onMoveStart?: (trackId: string, eventId: number, e: React.MouseEvent, time: number, duration: number) => void;
    onUpdate?: (trackId: string, eventId: number, time: number, duration: number) => void;
    onDeleteSelected?: (trackId: string) => void;
    onCopy?: (trackId: string, eventId: number) => void;
    onDuplicate?: (trackId: string, eventId: number) => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
    onMount?: (el: HTMLDivElement | null) => void;
    onDeselect?: () => void;
    onOpenCreateDialog?: (time: number) => void;
    onPasteAtTime?: (time: number) => void;
    canPaste?: boolean;
    onUndo?: () => void;
    canUndo?: boolean;
    onRedo?: () => void;
    canRedo?: boolean;
    onAddTrackAbove?: () => void;
    onAddTrackBelow?: () => void;
    onDeleteTrack?: () => void;
    canDeleteTrack?: boolean;
    // clip track props
    clips?: Clip[];
    clipGhosts?: ClipGhostPos[];
    draggingClipIds?: Set<string>;
    selectedClipIds?: Set<string>;
    sourceNameMap?: Map<string, string>;
    sourceOfflineIds?: Set<string>;
    onClipMoveStart?: (trackId: string, clip: Clip, e: React.MouseEvent) => void;
    onSelectClip?: (trackId: string, clipId: string, additive: boolean) => void;
    onDeleteClip?: (trackId: string, clipId: string) => void;
    onDropSource?: (sourceId: string, time: number) => void;
    acceptSourceType?: 'video' | 'audio';
    waveformMap?: Map<string, WaveformData>;
    thumbnailMap?: Map<string, ClipThumbnails>;
    onToggleSyncLock?: () => void;
    onTrimStart?: (trackId: string, clip: Clip, edge: TrimEdge, e: React.MouseEvent) => void;
    onRazorCut?: (clipId: string, time: number) => void;
    onSplitClip?: (clipId: string) => void;
    onUnlinkClip?: (clipId: string) => void;
    onClipGainChange?: (trackId: string, clipId: string, gain: number) => void;
    onCloseGapAtTime?: (time: number) => void;
    onCloseAllGaps?: () => void;
    onSetGroupHeight?: (height: number) => void;
}

export function Track({
    track,
    trackId,
    index,
    duration,
    zoom,
    paddingX = 0,
    scrollLeftRef,
    subscribe,
    onToggleBlocked,
    onToggleHidden,
    onToggleMuted,
    events,
    selectedIds,
    draggingIds,
    ghosts,
    onSelect,
    onMoveStart,
    onUpdate,
    onDeleteSelected,
    onCopy,
    onDuplicate,
    onResizeStart,
    onResizeEnd,
    onMount,
    onDeselect,
    onOpenCreateDialog,
    onPasteAtTime,
    canPaste,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
    onAddTrackAbove,
    onAddTrackBelow,
    onDeleteTrack,
    canDeleteTrack,
    clips,
    clipGhosts,
    draggingClipIds,
    selectedClipIds,
    sourceNameMap,
    sourceOfflineIds,
    onClipMoveStart,
    onSelectClip,
    onDeleteClip,
    onDropSource,
    acceptSourceType,
    waveformMap,
    thumbnailMap,
    onToggleSyncLock,
    onTrimStart,
    onRazorCut,
    onSplitClip,
    onUnlinkClip,
    onClipGainChange,
    onCloseGapAtTime,
    onCloseAllGaps,
    onResizeHeight,
    onHeightResizeStart,
    onHeightResizeEnd,
    onSetGroupHeight,
}: TrackProps) {
    const height = track.height ?? TRACK_HEIGHT;
    const isEventTrack = track.type === TrackType.Event;
    const showEvents = isEventTrack && !track.isHidden && events && events.length > 0;
    const showClips = !isEventTrack && clips && clips.length > 0;

    return (
        <div ref={onMount} className="flex flex-row w-full">
            <TrackInfo
                type={track.type}
                index={index}
                height={height}
                onResizeHeight={onResizeHeight}
                onResizeStart={onHeightResizeStart}
                onResizeEnd={onHeightResizeEnd}
                isBlocked={track.isBlocked}
                isHidden={track.isHidden}
                isMuted={track.isMuted}
                syncLock={track.syncLock}
                onToggleBlocked={onToggleBlocked}
                onToggleHidden={onToggleHidden}
                onToggleMuted={onToggleMuted}
                onToggleSyncLock={onToggleSyncLock}
            />
            <TrackContent
                height={height}
                duration={duration}
                zoom={zoom}
                paddingX={paddingX}
                scrollLeftRef={scrollLeftRef}
                subscribe={subscribe}
                ghosts={ghosts}
                clipGhosts={clipGhosts}
                isBlocked={track.isBlocked}
                onDeselect={onDeselect}
                onOpenCreateDialog={onOpenCreateDialog}
                onPasteAtTime={onPasteAtTime}
                canPaste={canPaste}
                onUndo={onUndo}
                canUndo={canUndo}
                onRedo={onRedo}
                canRedo={canRedo}
                onAddTrackAbove={onAddTrackAbove}
                onAddTrackBelow={onAddTrackBelow}
                onDeleteTrack={onDeleteTrack}
                canDeleteTrack={canDeleteTrack}
                onDropSource={onDropSource}
                acceptSourceType={acceptSourceType}
                onCloseGapAtTime={onCloseGapAtTime}
                onCloseAllGaps={onCloseAllGaps}
                onSetGroupHeight={onSetGroupHeight}
            >
                {showEvents && events.map((event) => (
                    <TimelineEvent
                        key={event.id}
                        event={event}
                        zoom={zoom}
                        isSelected={selectedIds?.has(event.id) ?? false}
                        isBeingDragged={draggingIds?.has(event.id) ?? false}
                        onSelect={(additive) => onSelect?.(event.id, additive)}
                        onMoveStart={(e, time, dur) => onMoveStart?.(trackId, event.id, e, time, dur)}
                        onUpdate={(time, dur) => onUpdate?.(trackId, event.id, time, dur)}
                        onDeleteSelected={onDeleteSelected ? () => onDeleteSelected(trackId) : undefined}
                        onCopy={onCopy ? () => onCopy(trackId, event.id) : undefined}
                        onDuplicate={onDuplicate ? () => onDuplicate(trackId, event.id) : undefined}
                        onResizeStart={onResizeStart}
                        onResizeEnd={onResizeEnd}
                    />
                ))}
                {showClips && clips.map((clip) => (
                    <TimelineClip
                        key={clip.id}
                        clip={clip}
                        sourceName={sourceNameMap?.get(clip.sourceId) ?? clip.sourceId}
                        sourceMissing={sourceNameMap !== undefined && !sourceNameMap.has(clip.sourceId)}
                        sourceOffline={sourceOfflineIds?.has(clip.sourceId) ?? false}
                        zoom={zoom}
                        isSelected={selectedClipIds?.has(clip.id) ?? false}
                        isBeingDragged={draggingClipIds?.has(clip.id) ?? false}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onClipMoveStart?.(trackId, clip, e);
                        }}
                        onSelect={onSelectClip ? (additive) => onSelectClip(trackId, clip.id, additive) : undefined}
                        onDelete={onDeleteClip ? () => onDeleteClip(trackId, clip.id) : undefined}
                        onTrimStart={onTrimStart && !track.isBlocked ? (edge, e) => onTrimStart(trackId, clip, edge, e) : undefined}
                        onRazorCut={onRazorCut && !track.isBlocked ? (time) => onRazorCut(clip.id, time) : undefined}
                        onSplit={onSplitClip && !track.isBlocked ? () => onSplitClip(clip.id) : undefined}
                        onUnlink={onUnlinkClip && !track.isBlocked ? () => onUnlinkClip(clip.id) : undefined}
                        onGainChange={onClipGainChange && !track.isBlocked ? (gain) => onClipGainChange(trackId, clip.id, gain) : undefined}
                        trackHeight={height}
                        waveformData={waveformMap?.get(clip.sourceId)}
                        thumbnails={thumbnailMap?.get(clip.id)}
                    />
                ))}
            </TrackContent>
        </div>
    );
}
