
interface TimelineRulerProps {
    duration: number; // seconds
    zoom: number; // pixels per second
}

function TimelineRuler({ duration, zoom }: TimelineRulerProps) {
    return (
        <div className="relative h-5">
          {Array.from({ length: duration }).map((_, i) => 
          i % 5 === 0 ? (
            <div
              key={i}
              className="absolute top-0 h-full border-l border-zinc-700 text-xs text-zinc-400"
              style={{ left: i * zoom }}
            >
              <span className="ml-1">{i}s</span>
            </div>
          ) : (
          <div
              key={i}
              className="absolute top-0 h-2 border-l border-zinc-700 text-xs text-zinc-400"
              style={{ left: i * zoom }}
            />
          ))}
        </div>
    )
}

export default TimelineRuler;