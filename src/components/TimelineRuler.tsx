interface TimelineRulerProps {
  duration: number; // seconds
  zoom: number; // pixels per second
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TimelineRuler({ duration, zoom, onSeek }: TimelineRulerProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const parent = e.currentTarget.parentElement!;
    // parent is innerRef which moves with scroll, so rect.left already encodes scroll offset
    const x = e.clientX - parent.getBoundingClientRect().left;
    const time = Math.max(0, Math.min(duration, x / zoom));
    onSeek(time);
  };

  return (
    <div className="relative h-10 cursor-pointer" style={{ width: duration * zoom }} onClick={handleClick}>
      {Array.from({ length: duration }).map((_, i) =>
        i % 5 === 0 ? (
          <div
            key={i}
            className="absolute top-0 h-5 border-l border-zinc-700 text-xs text-zinc-400"
            style={{ left: i * zoom }}
          >
            <span className="absolute top-5 left-1/2 transform -translate-x-1/2">
              {formatTime(i)}
            </span>
          </div>
        ) : (
          <div
            key={i}
            className="absolute top-0 h-3 border-l border-zinc-700 text-xs text-zinc-400"
            style={{ left: i * zoom }}
          />
        ),
      )}
    </div>
  );
}

export default TimelineRuler;
