import React, { useEffect } from 'react';
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Input } from '../ui/input';
import type { RefObject } from 'react';

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
    setCurrentTime: (time: number) => void;
    currentTimeRef: RefObject<number>;
    duration: number;
}

function PlaybackControls({ isPlaying, setIsPlaying, setCurrentTime, currentTimeRef, duration }: PlaybackControlsProps) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
            if (e.code === 'Space') {
                if (e.repeat) return;
                e.preventDefault();
                setIsPlaying(!isPlaying);
            } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                e.preventDefault();
                const step = e.ctrlKey || e.metaKey ? 1 / 30 : 1;
                const delta = e.code === 'ArrowLeft' ? -step : step;
                setCurrentTime(Math.max(0, Math.min(duration, currentTimeRef.current + delta)));
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isPlaying, duration, setIsPlaying, setCurrentTime, currentTimeRef]);

    return (
        <div className="flex flex-row gap-6 items-center">
            <SkipBack className="cursor-pointer" onClick={() => setCurrentTime(0)} />
            {isPlaying
                ? <Pause size={28} className="cursor-pointer" onClick={() => setIsPlaying(false)} />
                : <Play size={28} className="cursor-pointer" onClick={() => setIsPlaying(true)} />
            }
            <SkipForward className="cursor-pointer" onClick={() => setCurrentTime(duration)} />
        </div>
    );
}

interface NLEControlsProps extends ZoomControlsProps, PlaybackControlsProps {}

function NLEControls({
    isPlaying,
    setIsPlaying,
    setCurrentTime,
    currentTimeRef,
    duration,
    zoom,
    onZoomChange,
}: NLEControlsProps) {
    return (
        <div className="border-b w-full flex flex-row justify-between gap-4 p-2 px-4">
            <div className="w-64" />
            {/* TODO: CreateControls — moved to track right-click context menu */}
            <div className="flex flex-row justify-center">
                <PlaybackControls
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    setCurrentTime={setCurrentTime}
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
