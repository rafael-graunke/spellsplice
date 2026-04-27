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
import { useState, useEffect, useRef } from 'react';
import { exportProject, importProject } from '@/lib/projectExport';
import VideoPreview from './components/VideoPreview';
import type { VideoState } from './components/types/video';
import { Inspector } from './components/Inspector';
import { usePlayerTracks } from './components/Timeline/hooks/usePlayerTracks';
import AppBar from './components/AppBar';

type PlayerInit = Omit<Player, 'track'>;

const AUTOSAVE_KEY = 'spellsplice-autosave';

const initialPlayers: PlayerInit[] = [
    { id: 'player1', name: 'Player 1', handSize: 0, lifeTotal: 20, cards: [] },
    { id: 'player2', name: 'Player 2', handSize: 0, lifeTotal: 20, cards: [] },
];

const makeFreshPlayers = (): Player[] =>
    initialPlayers.map((p) => ({ ...p, track: { id: p.id, layers: 4, events: [] } }));

function loadSavedPlayers(): Player[] | undefined {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return undefined;
        return JSON.parse(raw) as Player[];
    } catch {
        return undefined;
    }
}

function App() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [video, setVideo] = useState<VideoState | null>(null);
    const [selectedEvents, setSelectedEvents] = useState<TrackEvent[]>([]);
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
        () => initialPlayers[0]?.id ?? null
    );
    const [fileToLoad, setFileToLoad] = useState<File | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const isFirstPlayersRender = useRef(true);
    const skipDirtyRef = useRef(false);
    const [savedPlayersInit] = useState(loadSavedPlayers);

    const {
        players,
        handleCreateEvent,
        handleDeleteEvent,
        handleUpdateEvent,
        handleMoveEvent,
        handleMoveMultipleEvents,
        handleUpdateMeta,
        handleUpdatePlayer,
        resetPlayers,
    } = usePlayerTracks(initialPlayers, currentTime, setSelectedEvents, savedPlayersInit);

    useEffect(() => {
        if (isFirstPlayersRender.current) {
            isFirstPlayersRender.current = false;
            return;
        }
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(players));
        if (isDirty) return;
        if (skipDirtyRef.current) { skipDirtyRef.current = false; return; }
        setIsDirty(true);
    }, [players]);

    const handleExport = async () => {
        await exportProject(players, video);
        setIsDirty(false);
    };

    const handleImport = async (file: File) => {
        const { manifest, videoFile } = await importProject(file);
        skipDirtyRef.current = true;
        resetPlayers(manifest.players);
        setSelectedPlayerId(manifest.players[0]?.id ?? null);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        if (videoFile) setFileToLoad(videoFile);
    };

    const handleNew = () => {
        skipDirtyRef.current = true;
        resetPlayers(makeFreshPlayers());
        localStorage.removeItem(AUTOSAVE_KEY);
        setVideo(null);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setFileToLoad(null);
        setIsDirty(false);
    };

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
            <section className="h-screen flex flex-col">
                <AppBar
                    isDirty={isDirty}
                    onNew={handleNew}
                    onExport={handleExport}
                    onImport={handleImport}
                />
                <ResizablePanelGroup orientation="vertical" className="flex-1">
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
                                    fileToLoad={fileToLoad}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize={100} defaultSize="25%">
                                <Inspector editObject={selectedEvents} onUpdate={handleInspectorUpdate} player={selectedPlayer} />
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
                            handleUpdatePlayer={handleUpdatePlayer}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
