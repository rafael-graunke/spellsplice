import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";

interface TimelineProps {
  duration: number; // seconds
  zoom: number; // pixels per second
  cursorTime?: number; // current cursor position in seconds
  tracks: [];
}

type DragState = null | {
  type: "move" | "resize-left" | "resize-right";
  clipId: string;
  startX: number;
  originalStart: number;
  originalDuration: number;
};

export function Timeline({
  duration,
  zoom,
  cursorTime = 0,
  tracks = [],
}: TimelineProps) {
  const totalWidth = duration * zoom;

  const seconds = Array.from({ length: duration + 1 }, (_, i) => i);

  const containerRef = useRef<HTMLDivElement>(null);

  const [drag, setDrag] = useState<DragState>(null);
  const [localTracks, setLocalTracks] = useState(tracks);

  return (
    <div ref={containerRef} className="overflow-x-auto">
      {/* ruler */}
      <div className="relative h-10 border-b border-zinc-800">
        {Array.from({ length: duration }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full border-l border-zinc-700 text-xs text-zinc-400"
            style={{ left: i * zoom }}
          >
            <span className="ml-1">{i}s</span>
          </div>
        ))}
      </div>

      {/* tracks */}
      {localTracks.map((track, index) => (
        <div
          key={index}
          className="relative h-16 border-b border-zinc-800"
        ></div>
      ))}
    </div>
  );
}
