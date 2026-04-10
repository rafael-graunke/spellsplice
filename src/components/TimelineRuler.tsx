interface TimelineRulerProps {
  duration: number; // seconds
  zoom: number; // pixels per second
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TimelineRuler({ duration, zoom }: TimelineRulerProps) {
  return (
    <div className="overflow-x-auto">
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
