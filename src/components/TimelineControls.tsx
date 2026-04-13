import React, { useState, useEffect } from "react";
import { Minus, Pause, Play, Plus, SkipBack, SkipForward } from "lucide-react";
import { Slider } from "./ui/slider";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./ui/command";

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
  onCreateEvent: () => void;
}

function CreateControls({ setIsPlaying, onCreateEvent }: CreateControlsProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPlaying(false);
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", downHandler);
    return () => window.removeEventListener("keydown", downHandler);
  }, []);

  const handleSelect = () => {
    onCreateEvent();
    setOpen(false);
  };

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
              <CommandItem onSelect={handleSelect}>Draw</CommandItem>
              <CommandItem onSelect={handleSelect}>Opening Hand</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Hand Disruption">
              <CommandItem onSelect={handleSelect}>Discard</CommandItem>
              <CommandItem onSelect={handleSelect}>Discard Hand</CommandItem>
              <CommandItem onSelect={handleSelect}>Reveal</CommandItem>
              <CommandItem onSelect={handleSelect}>Reveal Hand</CommandItem>
              <CommandItem onSelect={handleSelect}>Reveal and Discard</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Life">
              <CommandItem onSelect={handleSelect}>Gain Life</CommandItem>
              <CommandItem onSelect={handleSelect}>Lose Life</CommandItem>
              <CommandItem onSelect={handleSelect}>Infinite Life</CommandItem>
              <CommandItem onSelect={handleSelect}>Death</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Special Events">
              <CommandItem onSelect={handleSelect}>Brainstorm</CommandItem>
              <CommandItem onSelect={handleSelect}>Ponder</CommandItem>
              <CommandItem onSelect={handleSelect}>Thoughtseize</CommandItem>
              <CommandItem onSelect={handleSelect}>Fetch</CommandItem>
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
      if (e.code === "Space") {
        if (e.repeat) return; // 🧠 THIS FIXES IT

        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener("keydown", downHandler);
    return () => window.removeEventListener("keydown", downHandler);
  }, []);

  return (
    <div className="flex flex-row gap-6 items-center">
      <SkipBack className="cursor-pointer" onClick={() => setCurrentTime(0)} />
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
  duration: number;
  onCreateEvent: () => void;
}

export function TimelineControls({
  duration,
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
        <CreateControls setIsPlaying={setIsPlaying} onCreateEvent={onCreateEvent} />
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
