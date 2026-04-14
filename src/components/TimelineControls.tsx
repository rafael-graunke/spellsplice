import React, { useState, useEffect } from 'react';
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from './ui/command';
import { EventType } from './types/event';

interface ZoomControlsProps {
    zoom: number;
    onZoomChange: (zoom: number) => void;
}

function ZoomControls({ zoom, onZoomChange }: ZoomControlsProps) {
    return (
        <div className="flex flex-row gap-2 items-center">
            <Minus
                className="cursor-pointer"
                onClick={() => onZoomChange(zoom - 10)}
            />
            <Slider
                max={100}
                step={1}
                className="w-24"
                value={[zoom]}
                onValueChange={(value) => onZoomChange(value[0])}
            />
            <Plus
                className="cursor-pointer"
                onClick={() => onZoomChange(zoom + 10)}
            />
            <Input
                type="number"
                className="w-12"
                max={100}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                value={zoom}
            />
        </div>
    );
}

interface CreateControlsProps {
    setIsPlaying: (playing: React.SetStateAction<boolean>) => void;
    onCreateEvent: (eventType: EventType) => void;
}

function CreateControls({ setIsPlaying, onCreateEvent }: CreateControlsProps) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const downHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsPlaying(false);
                setOpen((prev) => !prev);
            }
        };

        window.addEventListener('keydown', downHandler);
        return () => window.removeEventListener('keydown', downHandler);
    }, []);

    const handleSelect = (eventType: EventType) => {
        onCreateEvent(eventType);
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <Button
                onClick={() => setOpen(true)}
                variant="outline"
                className="w-fit"
            >
                Open Menu
            </Button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <Command>
                    <CommandInput placeholder="Type a command or search..." />
                    <CommandList>
                        <CommandEmpty>No actions found.</CommandEmpty>
                        <CommandGroup heading="Basic Actions">
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.AddToHand)
                                }
                            >
                                Add to Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.RemoveFromHand)
                                }
                            >
                                Remove from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.LoseLife)
                                }
                            >
                                Lose Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.GainLife)
                                }
                            >
                                Gain Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.RevealFromHand)
                                }
                            >
                                Reveal from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect(EventType.StackTop)
                                }
                            >
                                Stack Top
                            </CommandItem>
                            <CommandItem
                                onSelect={() => handleSelect(EventType.Shuffle)}
                            >
                                Shuffle
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
              </Command>
            </CommandDialog>
        </div>
    );
}

interface PlaybackControlsProps {
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: React.SetStateAction<boolean>) => void;
    isPlaying: boolean;
}

function PlaybackControls({
    isPlaying,
    setCurrentTime,
    setIsPlaying,
}: PlaybackControlsProps) {
    useEffect(() => {
        const downHandler = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                if (e.repeat) return; // 🧠 THIS FIXES IT

                e.preventDefault();
                setIsPlaying((prev) => !prev);
            }
        };

        window.addEventListener('keydown', downHandler);
        return () => window.removeEventListener('keydown', downHandler);
    }, []);

    return (
        <div className="flex flex-row gap-6 items-center">
            <SkipBack
                className="cursor-pointer"
                onClick={() => setCurrentTime(0)}
            />
            {isPlaying ? (
                <Pause
                    size={28}
                    className="cursor-pointer"
                    onClick={() => setIsPlaying(false)}
                />
            ) : (
                <Play
                    size={28}
                    className="cursor-pointer"
                    onClick={() => setIsPlaying(true)}
                />
            )}
            <SkipForward className="cursor-pointer" />
        </div>
    );
}

interface TimelineControlsProps
    extends ZoomControlsProps, PlaybackControlsProps {
    onCreateEvent: (eventType: EventType) => void;
}

export function TimelineControls({
    setIsPlaying,
    setCurrentTime,
    zoom,
    onZoomChange: handleZoomChange,
    isPlaying,
    onCreateEvent,
}: TimelineControlsProps) {
    return (
        <div className="border-b timeline w-full flex flex-row justify-between gap-4 p-2 px-4">
            <div className="w-250 flex flex-row justify-start">
                <CreateControls
                    setIsPlaying={setIsPlaying}
                    onCreateEvent={onCreateEvent}
                />
            </div>
            <div className="w-250 flex flex-row justify-center">
                <PlaybackControls
                    setCurrentTime={setCurrentTime}
                    setIsPlaying={setIsPlaying}
                    isPlaying={isPlaying}
                />
            </div>
            <div className="w-250 flex flex-row justify-end">
                <ZoomControls zoom={zoom} onZoomChange={handleZoomChange} />
            </div>
        </div>
    );
}
