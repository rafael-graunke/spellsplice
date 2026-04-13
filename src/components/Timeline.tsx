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
    const trackRef = useRef<HTMLDivElement>(null);
    const zoomAnchorRef = useRef<{ time: number; x: number } | null>(null);

    const handleZoomChange = (newZoom: number) => {
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

            const container = containerRef.current;
            const track = trackRef.current;
            if (!container || !track) return;

            const trackRect = track.getBoundingClientRect();
            const trackX = e.clientX - trackRect.left;

            setZoom((oldZoom) => {
                const contentX = container.scrollLeft + trackX;

                const time = contentX / oldZoom;

                const zoomIntensity = 0.001;
                const delta = -e.deltaY;

                const newZoom = Math.min(
                    Math.max(5, oldZoom * (1 + delta * zoomIntensity)),
                    200
                );

                const newContentX = time * newZoom;
                const newScrollLeft = newContentX - trackX;

                requestAnimationFrame(() => {
                    container.scrollLeft = newScrollLeft;
                });

                return newZoom;
            });
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
            const el = trackRef.current; // THIS must be the scroll container
            if (!el) return;

            const rect = el.getBoundingClientRect();

            const x = e.clientX - rect.left + el.scrollLeft;

            const newTime = x / zoom;

            setCurrentTime(Math.max(0, Math.min(duration, newTime)));
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
                    className="relative"
                    minSize={100}
                    defaultSize="80%"
                >
                    <div ref={trackRef} className="pl-4">
                        <TimelineCursor
                            currentPosition={currentTime * zoom}
                            setIsDragging={setIsDragging}
                            setIsPlaying={setIsPlaying}
                        />
                        <TimelineRuler duration={duration} zoom={zoom} />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
