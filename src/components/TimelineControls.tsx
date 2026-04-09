import { useState, useEffect } from "react"
import { Minus, Play, Plus, SkipBack, SkipForward } from "lucide-react"
import { Slider } from "./ui/slider"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "./ui/command"


interface ZoomControlsProps {
    zoom: number,
    onZoomChange: (zoom: number) => void,
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
                onChange={(e) => onZoomChange(Number(e.target.value))}
                value={zoom}
            />
        </div>
    )
}


function CreateControls() {

    const [open, setOpen] = useState(false);

    useEffect(() => {
        const downHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };

        window.addEventListener("keydown", downHandler);
        return () => window.removeEventListener("keydown", downHandler);
    }, []);

    return (
        <div className="flex flex-col gap-4">
            <Button onClick={() => setOpen(true)} variant="outline" className="w-fit">
                Open Menu
            </Button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <Command>
                    <CommandInput placeholder="Type a command or search..." />
                    <CommandList>
                        <CommandEmpty>No actions found.</CommandEmpty>
                        <CommandGroup heading="Draw">
                            <CommandItem>
                                Draw
                            </CommandItem>
                            <CommandItem>
                                Opening Hand
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Hand Disruption">
                            <CommandItem>
                                Discard
                            </CommandItem>
                            <CommandItem>
                                Discard Hand
                            </CommandItem>
                            <CommandItem>
                                Reveal
                            </CommandItem>
                            <CommandItem>
                                Reveal Hand
                            </CommandItem>
                            <CommandItem>
                                Reveal and Discard
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Life">
                            <CommandItem>
                                Gain Life
                            </CommandItem>
                            <CommandItem>
                                Lose Life
                            </CommandItem>
                            <CommandItem>
                                Infinite Life
                            </CommandItem>
                            <CommandItem>
                                Death
                            </CommandItem>
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup heading="Special Events">
                            <CommandItem>
                                Brainstorm
                            </CommandItem>
                            <CommandItem>
                                Ponder
                            </CommandItem>
                            <CommandItem>
                                Thoughtseize
                            </CommandItem>
                            <CommandItem>
                                Fetch
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </CommandDialog>
        </div>
    )
}

function PlaybackControls() {
    return (
        <div className="flex flex-row gap-6 items-center">
            <SkipBack className="cursor-pointer"/>
            <Play size={28} className="cursor-pointer"/>
            <SkipForward className="cursor-pointer"/>
        </div>
    )
}


interface TimelineControlsProps extends ZoomControlsProps {
    duration: number,
}

export function TimelineControls({ duration, zoom, onZoomChange: handleZoomChange }: TimelineControlsProps) {

    return (
        <div className="border-b timeline w-full flex flex-row justify-between gap-4 p-2 px-4">
            <div className="w-250 flex flex-row justify-start">
                <CreateControls />
            </div>
            <div className="w-250 flex flex-row justify-center">
                <PlaybackControls />
            </div>
            <div className="w-250 flex flex-row justify-end">
                <ZoomControls zoom={zoom} onZoomChange={handleZoomChange} />
            </div>
        </div>
    )
}