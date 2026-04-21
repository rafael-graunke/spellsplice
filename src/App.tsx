import './App.css';
import { ThemeProvider } from './components/theme-provider';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './components/ui/resizable';
import { Timeline } from './components/Timeline';
import type { Player } from './components/types/player';
import type { TrackEvent, EventMeta } from './components/types/event';
import { useState } from 'react';
import VideoPreview from './components/VideoPreview';
import type { VideoState } from './components/types/video';
import { Inspector } from './components/Inspector';
import { usePlayerTracks } from './components/Timeline/hooks/usePlayerTracks';

type PlayerInit = Omit<Player, 'track'>;

const initialPlayers: PlayerInit[] = [
    { id: 'player1', name: 'Player 1', handSize: 0, lifeTotal: 20, cards: [] },
    { id: 'player2', name: 'Player 2', handSize: 0, lifeTotal: 20, cards: [] },
];

function App() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [video, setVideo] = useState<VideoState | null>(null);
    const [selectedEvents, setSelectedEvents] = useState<TrackEvent[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
        () => initialPlayers[0]?.id ?? null
    );

    const {
        players,
        handleCreateEvent,
        handleDeleteEvent,
        handleUpdateEvent,
        handleMoveEvent,
        handleMoveMultipleEvents,
        handleUpdateMeta,
    } = usePlayerTracks(initialPlayers, currentTime, setSelectedEvents);

    const selectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? players[0] ?? null;

    const handleInspectorUpdate = (eventId: number, meta: EventMeta) => {
        if (!selectedPlayer) return;
        handleUpdateMeta(selectedPlayer.id, eventId, meta);
        setSelectedEvents((prev) =>
            prev.map((e) => (e.id === eventId ? { ...e, meta } : e))
        );
    };

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <section className="h-screen">
                <ResizablePanelGroup orientation="vertical">
                    <ResizablePanel minSize={100} defaultSize="70%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel
                                minSize={100}
                                defaultSize="75%"
                                className="bg-muted/20"
                            >
                                <VideoPreview
                                    isPlaying={isPlaying}
                                    currentTime={currentTime}
                                    video={video}
                                    setVideo={setVideo}
                                    setCurrentTime={setCurrentTime}
                                    setIsPlaying={setIsPlaying}
                                    players={players}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize={100} defaultSize="25%">
                                <Inspector editObject={selectedEvents} onUpdate={handleInspectorUpdate} />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize={100} defaultSize="30%">
                        <Timeline
                            setCurrentTime={setCurrentTime}
                            currentTime={currentTime}
                            duration={video ? video.duration || 120 : 120}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            selectedEvents={selectedEvents}
                            setSelectedEvents={setSelectedEvents}
                            players={players}
                            selectedPlayer={selectedPlayer}
                            setSelectedPlayerId={setSelectedPlayerId}
                            handleCreateEvent={handleCreateEvent}
                            handleDeleteEvent={handleDeleteEvent}
                            handleUpdateEvent={handleUpdateEvent}
                            handleMoveEvent={handleMoveEvent}
                            handleMoveMultipleEvents={handleMoveMultipleEvents}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
