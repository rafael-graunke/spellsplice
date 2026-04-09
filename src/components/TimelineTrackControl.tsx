import type { Player } from "./types/player";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

interface PlayerTabProps {
    players: Player[],
    currentPlayer: Player,
    onPlayerChange: (player: Player) => void,
}

function PlayerTab({ players, currentPlayer, onPlayerChange }: PlayerTabProps) {
    return (
        <Tabs
            value={currentPlayer.name}
            onValueChange={
                (name) => onPlayerChange(players.find((p) => p.name === name) || players[0])
            }
        >
            <TabsList variant="line">
                {players.map((player) => (
                    <TabsTrigger key={player.name} value={player.name}>
                        {player.name}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}


interface TimelineTrackControlProps {
    playerData: Player[],
    currentPlayer: Player,
    onPlayerChange: (player: Player) => void,
}

function TimelineTrackControl({ playerData, currentPlayer, onPlayerChange }: TimelineTrackControlProps) {

    return (
        <div className="flex flex-col">
            <PlayerTab players={playerData} currentPlayer={currentPlayer} onPlayerChange={onPlayerChange} />
        </div>
    )
}

export default TimelineTrackControl;