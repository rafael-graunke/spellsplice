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
import { useState, useEffect, useRef, useCallback } from 'react';
import { exportProject, importProject } from '@/lib/projectExport';
import VideoPreview from './components/VideoPreview';
import type { VideoState } from './components/types/video';
import { Inspector } from './components/Inspector';
import { usePlayerTracks } from './components/Timeline/hooks/usePlayerTracks';
import AppBar from './components/AppBar';
import { ExportDialog } from './components/ExportDialog';

type PlayerInit = Omit<Player, 'track'>;

const AUTOSAVE_KEY = 'spellsplice-autosave';

const initialPlayers: PlayerInit[] = [
    { id: 'player1', name: 'Player 1', handSize: 0, lifeTotal: 20, cards: [], topStack: []},
    { id: 'player2', name: 'Player 2', handSize: 0, lifeTotal: 20, cards: [], topStack: []},
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
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const isFirstPlayersRender = useRef(true);
    const skipDirtyRef = useRef(false);
    const currentTimeRef = useRef(0);

    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
    const [savedPlayersInit] = useState(loadSavedPlayers);

    const {
        players,
        handleCreateEvent,
        handleDeleteEvents,
        handleDuplicateEvents,
        handlePasteEvents,
        handleUpdateEvent,
        handleBeginResize,
        handleCommitResize,
        handleMoveEvents,
        handleUpdateMeta,
        handleUpdatePlayer,
        resetPlayers,
        undo,
        redo,
        canUndo,
        canRedo,
    } = usePlayerTracks(initialPlayers, currentTimeRef, setSelectedEvents, savedPlayersInit);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
            localStorage.removeItem(AUTOSAVE_KEY);
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

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

    // Keep selectedEvents in sync with players state (handles undo/redo restoring event data).
    useEffect(() => {
        setSelectedEvents((prev) => {
            if (prev.length === 0) return prev;
            const allEvents = players.flatMap((p) => p.track.events);
            const next = prev
                .map((e) => allEvents.find((ev) => ev.id === e.id))
                .filter((e): e is TrackEvent => e !== undefined);
            return next.length === prev.length && next.every((e, i) => e === prev[i]) ? prev : next;
        });
    }, [players]);

    const handleExport = useCallback(async () => {
        await exportProject(playersRef.current, videoRef.current);
        setIsDirty(false);
    }, []);

    const handleImport = useCallback(async (file: File) => {
        const { manifest, videoFile } = await importProject(file);
        skipDirtyRef.current = true;
        resetPlayers(manifest.players);
        setSelectedPlayerId(manifest.players[0]?.id ?? null);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        if (videoFile) setFileToLoad(videoFile);
    }, [resetPlayers]);

    const handleNew = useCallback(() => {
        skipDirtyRef.current = true;
        resetPlayers(makeFreshPlayers());
        localStorage.removeItem(AUTOSAVE_KEY);
        setVideo(null);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setFileToLoad(null);
        setIsDirty(false);
    }, [resetPlayers]);

    const handleOpenExportDialog = useCallback(() => setExportDialogOpen(true), []);
    const handleCloseExportDialog = useCallback(() => setExportDialogOpen(false), []);

    const rawSelectedPlayer = players.find((p) => p.id === selectedPlayerId) ?? players[0];

    const rawSelectedPlayerRef = useRef(rawSelectedPlayer);
    rawSelectedPlayerRef.current = rawSelectedPlayer;

    const playersRef = useRef(players);
    playersRef.current = players;

    const videoRef = useRef(video);
    videoRef.current = video;

    const handleInspectorUpdate = useCallback((eventId: number, meta: EventMeta) => {
        const player = rawSelectedPlayerRef.current;
        if (!player) return;
        handleUpdateMeta(player.id, eventId, meta);
        setSelectedEvents((prev) =>
            prev.map((e) => (e.id === eventId ? { ...e, meta } : e))
        );
    }, [handleUpdateMeta, setSelectedEvents]);

    return (
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <section className="h-screen flex flex-col">
                <AppBar
                    isDirty={isDirty}
                    onNew={handleNew}
                    onExport={handleExport}
                    onImport={handleImport}
                    onExportVideo={handleOpenExportDialog}
                />
                <ExportDialog
                    open={exportDialogOpen}
                    onClose={handleCloseExportDialog}
                    video={video}
                    players={players}
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
                                    currentTimeRef={currentTimeRef}
                                    video={video}
                                    setVideo={setVideo}
                                    setCurrentTime={setCurrentTime}
                                    setIsPlaying={setIsPlaying}
                                    players={players}
                                    fileToLoad={fileToLoad}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize="400px" defaultSize="25%">
                                <Inspector editObject={selectedEvents} onUpdate={handleInspectorUpdate} player={rawSelectedPlayer} />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize={100} defaultSize="30%">
                        <Timeline
                            setCurrentTime={setCurrentTime}
                            duration={video ? video.duration || 120 : 120}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            selectedEvents={selectedEvents}
                            setSelectedEvents={setSelectedEvents}
                            players={players}
                            selectedPlayer={rawSelectedPlayer}
                            setSelectedPlayerId={setSelectedPlayerId}
                            handleCreateEvent={handleCreateEvent}
                            handleDeleteEvents={handleDeleteEvents}
                            handleDuplicateEvents={handleDuplicateEvents}
                            handlePasteEvents={handlePasteEvents}
                            handleUpdateEvent={handleUpdateEvent}
                            handleBeginResize={handleBeginResize}
                            handleCommitResize={handleCommitResize}
                            handleMoveEvents={handleMoveEvents}
                            handleUpdatePlayer={handleUpdatePlayer}
                            undo={undo}
                            redo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            currentTimeRef={currentTimeRef}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
