import React, { useEffect } from 'react';
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Input } from '../ui/input';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import type { RefObject } from 'react';
import type { ViewMode } from './NLETimeline';

interface ZoomControlsProps {
    zoom: number;
    onZoomChange: (zoom: number) => void;
}

function ZoomControls({ zoom, onZoomChange }: ZoomControlsProps) {
    return (
        <div className="flex flex-row gap-2 items-center">
            <Minus className="cursor-pointer" onClick={() => onZoomChange(zoom - 10)} />
            <Slider
                max={100}
                step={1}
                className="w-24"
                value={[zoom]}
                onValueChange={(value) => onZoomChange(value[0])}
            />
            <Plus className="cursor-pointer" onClick={() => onZoomChange(zoom + 10)} />
            <Input
                type="number"
                className="w-12"
                max={100}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
            />
        </div>
    );
}


interface PlaybackControlsProps {
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    onSeek: (time: number) => void;
    currentTimeRef: RefObject<number>;
    duration: number;
}

function PlaybackControls({ isPlaying, setIsPlaying, onSeek, currentTimeRef, duration }: PlaybackControlsProps) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if (e.code === 'Space') {
                if (e.repeat) return;
                e.preventDefault();
                setIsPlaying(!isPlaying);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPlaying, duration, setIsPlaying, onSeek, currentTimeRef]);

    return (
        <div className="flex flex-row gap-6 items-center">
            <SkipBack className="cursor-pointer" onClick={() => onSeek(0)} />
            {isPlaying
                ? <Pause size={28} className="cursor-pointer" onClick={() => setIsPlaying(false)} />
                : <Play size={28} className="cursor-pointer" onClick={() => setIsPlaying(true)} />
            }
            <SkipForward className="cursor-pointer" onClick={() => onSeek(duration)} />
        </div>
    );
}

interface NLEControlsProps extends ZoomControlsProps, PlaybackControlsProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

function NLEControls({
    isPlaying,
    setIsPlaying,
    onSeek,
    currentTimeRef,
    duration,
    zoom,
    onZoomChange,
    viewMode,
    setViewMode,
}: NLEControlsProps) {
    return (
        <div className="border-b w-full flex flex-row justify-between gap-4 p-2 px-4">
            <div id="timeline-view">
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <TabsList>
                        <TabsTrigger value="full">Full View</TabsTrigger>
                        <TabsTrigger value="event">Event Editing</TabsTrigger>
                        <TabsTrigger value="video">Video Editing</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div className="flex flex-row justify-center">
                <PlaybackControls
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    onSeek={onSeek}
                    currentTimeRef={currentTimeRef}
                    duration={duration}
                />
            </div>
            <div className="w-64 flex flex-row justify-end">
                <ZoomControls zoom={zoom} onZoomChange={onZoomChange} />
            </div>
        </div>
    );
}

export default React.memo(NLEControls);
