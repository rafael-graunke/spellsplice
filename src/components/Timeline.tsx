import { useEffect, useRef, useState } from 'react';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './ui/resizable';
import { TimelineControls } from './TimelineControls';
import type { Player } from './types/player';
import TimelineTrackControl from './TimelineTrackControl';
import TimelineRuler from './TimelineRuler';
import TimelineCursor from './TimelineCursor';
import TimelineTrack from './TimelineTrack';

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
    const [selectedPlayer, setSelectedPlayer] = useState<Player>(playerData[0]);
    const [isDragging, setIsDragging] = useState(false);

    const lastTimeRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);  // scroll container
    const innerRef = useRef<HTMLDivElement>(null);  // positioning context
    const zoomRef = useRef(zoom);

    const handleZoomChange = (newZoom: number) => {
        zoomRef.current = newZoom;
        setZoom(newZoom);
    };

    const handlePlayerChange = (player: Player) => {
        setSelectedPlayer(player);
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

            // padding offset between scroll container and positioning context
            const padding = innerRect.left - trackRect.left + scrollLeft;

            const contentX = scrollLeft + trackX - padding;
            const time = contentX / oldZoom;

            const zoomIntensity = 0.001;
            const delta = -e.deltaY;
            const newZoom = Math.min(
                Math.max(5, oldZoom * (1 + delta * zoomIntensity)),
                200
            );

            const newScrollLeft = time * newZoom + padding - trackX;

            zoomRef.current = newZoom;
            setZoom(newZoom);
            track.scrollLeft = newScrollLeft;
        };

        el.addEventListener('wheel', handler, { passive: false });

        return () => {
            el.removeEventListener('wheel', handler);
        };
    }, []);

    // Handle running
    useEffect(() => {
        if (!isPlaying) {
            lastTimeRef.current = null;
            return;
        }

        let rafId: number;

        const tick = (now: number) => {
            if (lastTimeRef.current === null) {
                lastTimeRef.current = now;
            }

            const delta = (now - lastTimeRef.current) / 1000; // ms → seconds
            lastTimeRef.current = now;

            setCurrentTime((prev) => {
                const next = prev + delta;
                if (next >= duration) {
                    setIsPlaying(false);
                    return duration;
                }
                return next;
            });

            rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [isPlaying, duration]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const inner = innerRef.current;
            if (!inner) return;

            // innerRef moves with scroll, so rect.left already encodes scroll offset
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

    return (
        <div className="timeline flex flex-col h-full" ref={containerRef}>
            <TimelineControls
                duration={duration}
                zoom={zoom}
                onZoomChange={handleZoomChange}
                isPlaying={isPlaying}
                setCurrentTime={setCurrentTime}
                setIsPlaying={setIsPlaying}
            />
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize={100} defaultSize="20%">
                    <TimelineTrackControl
                        playerData={playerData}
                        currentPlayer={selectedPlayer}
                        onPlayerChange={handlePlayerChange}
                    />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel
                    minSize={100}
                    defaultSize="80%"
                >
                    <div ref={trackRef} className="pl-4 overflow-x-auto h-full">
                        <div ref={innerRef} className="relative h-full">
                            <TimelineCursor
                                currentPosition={currentTime * zoom}
                                setIsDragging={setIsDragging}
                                setIsPlaying={setIsPlaying}
                            />
                            <TimelineRuler duration={duration} zoom={zoom} onSeek={setCurrentTime} />
                            <TimelineTrack />
                        </div>
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
