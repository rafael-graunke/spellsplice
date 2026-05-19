import { useRef, useEffect, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Eye, EyeOff, Lock, Volume2, VolumeOff } from 'lucide-react';
import type { NLETrack as NLETrackType } from '../types/nle';
import { TrackType, TrackTypeColorMap } from '../types/nle';
import type { TrackEvent } from '../types/event';
import type { Clip } from '../types/clip';
import type { NLEGhostPos } from './hooks/useNLEEventDrag';
import type { NLEClipGhostPos } from './hooks/useNLEClipDrag';
import NLEEvent from './NLEEvent';
import { NLEClip } from './NLEClip';
import NLEEventIcon, { type SvgIcon } from './NLEEventIcon';
import {
    TRACK_HEIGHT,
    TRACK_INFO_WIDTH,
    TRACK_GROUP_LABEL_WIDTH,
} from '../Timeline/constants';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../ui/tooltip';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from '../ui/context-menu';
import { modKey } from '@/lib/platform';

interface TrackGroupProps {
    children: ReactNode;
    label: string;
    icon?: SvgIcon;
}

export function TrackGroup({ children, label, icon}: TrackGroupProps) {
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

    return (
            <div className="flex flex-row h-full overflow-hidden">
                <div
                    style={{ width: TRACK_GROUP_LABEL_WIDTH }}
                    className={cn(
                        "bg-zinc-800 text-zinc-300 relative flex items-center justify-center text-sm py-2",
                        "rounded-l-md border-l border-y border-zinc-600"
                    )}
                >
                    {/* measurement element — outside overflow:hidden so clientHeight is unclamped */}
                    <p ref={measureRef} aria-hidden className="absolute invisible whitespace-nowrap [writing-mode:sideways-lr]">{label}</p>
                    {/* inner wrapper lives inside the padding area; clientHeight = usable space */}
                    <div ref={innerRef} className="h-full w-full overflow-hidden flex items-center justify-center">
                        {overflows ? (
                            Icon ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center justify-center">
                                                <Icon className="size-4" />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">{label}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <></>
                            )
                        ) : (
                            <p className="whitespace-nowrap [writing-mode:sideways-lr] h-full text-center">{label}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-col-reverse flex-1 bg-zinc-800 overflow-y-auto scrollbar-thin border-y border-l border-zinc-600">
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
    type: NLETrackType['type'];
    index: number;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
    onToggleBlocked: () => void;
    onToggleHidden?: () => void;
    onToggleMuted?: () => void;
}

export function TrackInfo({
    type,
    index,
    isBlocked,
    isHidden,
    isMuted,
    onToggleBlocked,
    onToggleHidden,
    onToggleMuted,
}: TrackInfoProps) {
    const showVisibility = type === TrackType.Event || type === TrackType.Video;
    const showMute = type === TrackType.Audio;

    return (
        <div
            className="shrink-0 flex items-center justify-between bg-zinc-900"
            style={{ width: TRACK_INFO_WIDTH, height: TRACK_HEIGHT }}
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
        </div>
    );
}

interface TrackContentProps {
    children?: ReactNode;
    duration: number;
    zoom: number;
    paddingX?: number;
    scrollLeftRef: RefObject<number>;
    subscribe: (fn: (x: number) => void) => () => void;
    ghosts?: NLEGhostPos[];
    clipGhosts?: NLEClipGhostPos[];
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
}

export function TrackContent({
    children,
    duration,
    zoom,
    paddingX = 0,
    scrollLeftRef,
    subscribe,
    ghosts,
    clipGhosts,
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
}: TrackContentProps) {
    const innerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const clickTimeRef = useRef(0);
    const [isDragOver, setIsDragOver] = useState(false);
    // Tracks whether the mousedown came from this background (not from a child NLEEvent,
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
                    style={{ height: TRACK_HEIGHT }}
                    onMouseDown={onDeselect ? (e) => { bgDownRef.current = { x: e.clientX, y: e.clientY }; } : undefined}
                    onClick={onDeselect ? (e) => {
                        const down = bgDownRef.current;
                        bgDownRef.current = null;
                        if (!down) return; // mousedown was on NLEEvent (stopPropagation)
                        const dx = e.clientX - down.x;
                        const dy = e.clientY - down.y;
                        if (dx * dx + dy * dy > 25) return; // drag — marquee or event move
                        if (!e.currentTarget.contains(e.target as Node)) return; // portal click
                        onDeselect();
                    } : undefined}
                    onContextMenu={(e) => {
                        clickTimeRef.current = getTimeFromClientX(e.clientX);
                    }}
                    onDragOver={onDropSource && acceptSourceType ? (e) => {
                        if (e.dataTransfer.types.includes('application/x-spellsplice-source')) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                            setIsDragOver(true);
                        }
                    } : undefined}
                    onDragLeave={onDropSource ? () => setIsDragOver(false) : undefined}
                    onDrop={onDropSource && acceptSourceType ? (e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        try {
                            const data = JSON.parse(e.dataTransfer.getData('application/x-spellsplice-source'));
                            if (data.sourceType !== acceptSourceType) return;
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
                                <NLEEventIcon
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
                                className={`absolute h-[calc(100%-6px)] top-1/2 -translate-y-1/2 rounded-sm opacity-50 pointer-events-none ${ghost.color}`}
                                style={{ left: ghost.left, width: ghost.width }}
                            />
                        ))}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                {onOpenCreateDialog && (
                    <>
                        <ContextMenuItem onClick={() => onOpenCreateDialog(clickTimeRef.current)}>
                            Create event
                            <ContextMenuShortcut>{modKey}+K</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                    </>
                )}
                <ContextMenuItem disabled={!canPaste} onClick={() => onPasteAtTime?.(clickTimeRef.current)}>
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
    track: NLETrackType;
    trackId: string;
    index: number;
    duration: number;
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
    ghosts?: NLEGhostPos[];
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
    clipGhosts?: NLEClipGhostPos[];
    draggingClipIds?: Set<string>;
    sourceNameMap?: Map<string, string>;
    onClipMoveStart?: (trackId: string, clip: Clip, e: React.MouseEvent) => void;
    onDeleteClip?: (trackId: string, clipId: string) => void;
    onDropSource?: (sourceId: string, time: number) => void;
    acceptSourceType?: 'video' | 'audio';
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
    sourceNameMap,
    onClipMoveStart,
    onDeleteClip,
    onDropSource,
    acceptSourceType,
}: TrackProps) {
    const isEventTrack = track.type === TrackType.Event;
    const showEvents = isEventTrack && !track.isBlocked && !track.isHidden && events && events.length > 0;
    const showClips = !isEventTrack && !track.isBlocked && clips && clips.length > 0;

    return (
        <div ref={onMount} className="flex flex-row w-full">
            <TrackInfo
                type={track.type}
                index={index}
                isBlocked={track.isBlocked}
                isHidden={track.isHidden}
                isMuted={track.isMuted}
                onToggleBlocked={onToggleBlocked}
                onToggleHidden={onToggleHidden}
                onToggleMuted={onToggleMuted}
            />
            <TrackContent
                duration={duration}
                zoom={zoom}
                paddingX={paddingX}
                scrollLeftRef={scrollLeftRef}
                subscribe={subscribe}
                ghosts={ghosts}
                clipGhosts={clipGhosts}
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
            >
                {showEvents && events.map((event) => (
                    <NLEEvent
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
                    <NLEClip
                        key={clip.id}
                        clip={clip}
                        sourceName={sourceNameMap?.get(clip.sourceId) ?? clip.sourceId}
                        zoom={zoom}
                        isBeingDragged={draggingClipIds?.has(clip.id) ?? false}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            onClipMoveStart?.(trackId, clip, e);
                        }}
                        onDelete={onDeleteClip ? () => onDeleteClip(trackId, clip.id) : undefined}
                    />
                ))}
            </TrackContent>
        </div>
    );
}
