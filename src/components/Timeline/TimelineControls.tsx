import React, { useState, useEffect } from 'react';
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '../ui/command';
import { EventType, type TrackEvent } from '../types/event';

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
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
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

    const handleSelect = (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => {
        onCreateEvent(partial);
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
                                    handleSelect({
                                        type: EventType.AddToHand,
                                        duration: 1,
                                    })
                                }
                            >
                                Add to Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.RemoveFromHand,
                                        duration: 1,
                                    })
                                }
                            >
                                Remove from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.LoseLife,
                                        duration: 1,
                                    })
                                }
                            >
                                Lose Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.GainLife,
                                        duration: 1,
                                    })
                                }
                            >
                                Gain Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.RevealFromHand,
                                        duration: 1,
                                    })
                                }
                            >
                                Reveal from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.StackTop,
                                        duration: 1,
                                    })
                                }
                            >
                                Stack Top
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.Shuffle,
                                        duration: 1,
                                    })
                                }
                            >
                                Shuffle
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.DisplayCard,
                                        duration: 5,
                                        resizable: true,
                                    })
                                }
                            >
                                Display Card
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
                if (e.repeat) return;
                const target = e.target as HTMLElement;
                if (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable
                )
                    return;

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
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
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
