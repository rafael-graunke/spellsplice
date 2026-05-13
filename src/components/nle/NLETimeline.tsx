import { useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import NLEControls from './NLEControls';
import { Track, TrackGroup } from './NLETrack';
import NLERuler from './NLERuler';
import type { NLETrackGroup } from '../types/nle';
import { useTimelineScroll } from './hooks/useTimelineScroll';
import { useTimelineZoom } from './hooks/useTimelineZoom';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { usePlayhead } from './hooks/usePlayhead';
import { useTimelineSelection } from './hooks/useTimelineSelection';
import { useTimelineKeyboard } from './hooks/useTimelineKeyboard';
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
}: NLETimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const containerWidthRef = useRef(0);

    const { scrollLeftRef, setScroll, setMaxScroll, subscribe } =
        useTimelineScroll();
    const { zoom, zoomRef, setZoom } = useTimelineZoom();
    const { getViewport } = useTimelineViewport(
        scrollLeftRef,
        zoomRef,
        containerWidthRef
    );
    const {
        selectedIds: _selectedIds,
        select: _select,
        clearSelection: _clearSelection,
    } = useTimelineSelection();

    const handleTick = useCallback(
        (_cursorAbsPx: number) => {
            // TODO: update cursor DOM position, auto-scroll during playback
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
                <ResizablePanelGroup orientation="vertical" className="flex-1 overflow-x-hidden">
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
                                        duration={duration}
                                        zoom={zoom}
                                        paddingX={TIMELINE_PADDING_X}
                                        scrollLeftRef={scrollLeftRef}
                                        subscribe={subscribe}
                                        onToggleBlocked={() => {}}
                                        onToggleHidden={() => {}}
                                        onToggleMuted={() => {}}
                                    />
                                ))}
                            </TrackGroup>
                        </ResizablePanel>,
                        ...(i < trackGroups.length - 1
                            ? [<ResizableHandle key={`handle-${group.id}`} className="aria-[orientation=horizontal]:h-2 bg-zinc-950" />]
                            : []),
                    ])}
                </ResizablePanelGroup>

                {/* TODO: NLECursor, marquee overlay */}
            </div>
        </div>
    );
}
