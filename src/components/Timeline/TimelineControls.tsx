import React, { useEffect } from 'react';
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '../ui/slider';
import { Input } from '../ui/input';
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
import type { Player } from '../types/player';

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
    open: boolean;
    onOpenChange: (open: boolean) => void;
    setIsPlaying: (playing: React.SetStateAction<boolean>) => void;
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
    selectedPlayer: Player;
}

function CreateControls({ open, onOpenChange, setIsPlaying, onCreateEvent, selectedPlayer}: CreateControlsProps) {
    useEffect(() => {
        const downHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsPlaying(false);
                onOpenChange(!open);
            }
        };

        window.addEventListener('keydown', downHandler);
        return () => window.removeEventListener('keydown', downHandler);
    }, [open]);

    const handleSelect = (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => {
        onCreateEvent(partial);
        onOpenChange(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <CommandDialog open={open} onOpenChange={onOpenChange}>
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
                                    })
                                }
                            >
                                Remove from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.LoseLife,
                                        meta: {
                                            amount: 1,
                                        }
                                    })
                                }
                            >
                                Lose Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.GainLife,
                                        meta: {
                                            amount: 1,
                                        }
                                    })
                                }
                            >
                                Gain Life
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.RevealFromHand,
                                    })
                                }
                            >
                                Reveal from Hand
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.StackDeck,
                                        meta: {
                                            cards: selectedPlayer.topStack,
                                        }
                                    })
                                }
                            >
                                Stack Deck
                            </CommandItem>
                            <CommandItem
                                onSelect={() =>
                                    handleSelect({
                                        type: EventType.UnstackDeck,
                                    })
                                }
                            >
                                Unstack Deck
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
    createOpen: boolean;
    onCreateOpenChange: (open: boolean) => void;
    onCreateEvent: (partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>) => void;
    selectedPlayer: Player;
}

function TimelineControls({
    setIsPlaying,
    setCurrentTime,
    zoom,
    onZoomChange: handleZoomChange,
    isPlaying,
    createOpen,
    onCreateOpenChange,
    onCreateEvent,
    selectedPlayer,
}: TimelineControlsProps) {
    return (
        <div className="border-b timeline w-full flex flex-row justify-between gap-4 p-2 px-4">
            <div className="w-250 flex flex-row justify-start">
                <CreateControls
                    open={createOpen}
                    onOpenChange={onCreateOpenChange}
                    setIsPlaying={setIsPlaying}
                    selectedPlayer={selectedPlayer}
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

const MemoTimelineControls = React.memo(TimelineControls);
export { MemoTimelineControls as TimelineControls };
