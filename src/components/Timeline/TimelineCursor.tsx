import { Diamond } from "lucide-react";

interface TimelineCursorProps {
  currentPosition: number;
  setIsDragging: (dragging: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
}

function TimelineCursor({
  currentPosition,
  setIsDragging,
  setIsPlaying,
}: TimelineCursorProps) {
  return (
    <div id="timeline-cursor">
      <Diamond
        style={{ left: currentPosition - 9 }}
        className="top-1 cursor-col-resize absolute left-2 text-red-500 z-101"
        size={20}
        fill="red"
        onMouseDown={() => {
          setIsDragging(true);
          setIsPlaying(false);
        }}
      />
      <div
        style={{ left: currentPosition }}
        className="cursor-col-resize absolute top-0 bottom-0 w-[2px] bg-red-500 z-100"
        onMouseDown={() => {
          setIsDragging(true);
          setIsPlaying(false);
        }}
      />
    </div>
  );
}

export default TimelineCursor;
