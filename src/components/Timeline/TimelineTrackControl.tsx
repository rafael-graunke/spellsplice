import type { Player } from '../types/player';
import type { Track } from '../types/event';

interface TimelineTrackControlProps {
    playerData: Player[];
    tracks: Track[];
}

function TimelineTrackControl({
    playerData,
    tracks,
}: TimelineTrackControlProps) {
    return (
        <div className="flex flex-col">
            {tracks.map((track) => {
                const player = playerData.find((p) => p.id === track.playerId);
                return (
                    <div
                        key={track.id}
                        className="h-12 flex items-center px-3 border-b border-gray-600 border-dashed text-sm text-gray-300 truncate"
                    >
                        {player?.name ?? track.playerId}
                    </div>
                );
            })}
        </div>
    );
}

export default TimelineTrackControl;
