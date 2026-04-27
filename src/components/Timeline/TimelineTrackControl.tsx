import { cn } from '@/lib/utils';
import type { Player } from '../types/player';

interface TimelineTrackControlProps {
    players: Player[];
    selectedPlayer: Player | null;
    onSelectPlayer: (player: Player) => void;
}

function TimelineTrackControl({
    players,
    selectedPlayer,
    onSelectPlayer,
}: TimelineTrackControlProps) {
    return (
        <div className="flex flex-col">
            {players.map((player) => (
                <div
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className={cn(
                        'h-12 flex items-center px-3 border-b border-gray-600 border-solid text-sm truncate cursor-pointer select-none',
                        player.id === selectedPlayer?.id
                            ? 'text-white bg-white/10'
                            : 'text-gray-400 hover:text-gray-200'
                    )}
                >
                    {player.name}
                </div>
            ))}
        </div>
    );
}

export default TimelineTrackControl;
