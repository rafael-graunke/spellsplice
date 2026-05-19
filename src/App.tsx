import './App.css';
import { ThemeProvider } from './components/theme-provider';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './components/ui/resizable';
import { NLETimeline } from './components/nle/NLETimeline';
import type { DeleteItem, DuplicateItem, PasteItem } from './components/nle/NLETimeline';
import type { NLEMoveResult } from './components/nle/hooks/useNLEEventDrag';
import type { NLETrackGroup } from './components/types/nle';
import { TrackType } from './components/types/nle';
import type { Player } from './components/types/player';
import type { TrackEvent, EventMeta } from './components/types/event';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { exportProject, importProject } from '@/lib/projectExport';
import VideoPreview from './components/VideoPreview';
import type { VideoState } from './components/types/video';
import { Inspector } from './components/Inspector';
import { usePlayerTracks } from './components/Timeline/hooks/usePlayerTracks';
import AppBar from './components/AppBar';
import { ExportDialog } from './components/ExportDialog';
import SettingsDialog from './components/Settings/SettingsDialog';
import type { ProjectConfig } from './components/types/config';
import { DEFAULT_PROJECT_CONFIG } from './components/types/config';
import { Sources } from './components/Sources';
import type { MediaSource } from './components/types/source';

type PlayerInit = Omit<Player, 'track'>;

const AUTOSAVE_KEY = 'spellsplice-autosave';

const initialPlayers: PlayerInit[] = [
    { id: 'player1', name: 'Player 1', handSize: 0, lifeTotal: 20, wins: 0, cards: [], topStack: []},
    { id: 'player2', name: 'Player 2', handSize: 0, lifeTotal: 20, wins: 0, cards: [], topStack: []},
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
    const [sources, setSources] = useState<MediaSource[]>([]);
    const [selectedEvents, setSelectedEvents] = useState<TrackEvent[]>([]);

    const [fileToLoad, setFileToLoad] = useState<File | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [projectConfig, setProjectConfig] = useState<ProjectConfig>(DEFAULT_PROJECT_CONFIG);
    const [newEventId, setNewEventId] = useState<number | null>(null);
    const isFirstPlayersRender = useRef(true);
    const skipDirtyRef = useRef(false);
    const clearAutosaveRef = useRef(false);
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
        if (clearAutosaveRef.current) {
            clearAutosaveRef.current = false;
            localStorage.removeItem(AUTOSAVE_KEY);
        } else {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(players));
        }
        if (isDirty) return;
        if (skipDirtyRef.current) { skipDirtyRef.current = false; return; }
        setIsDirty(true);
    }, [players]);

    const isFirstConfigRender = useRef(true);
    useEffect(() => {
        if (isFirstConfigRender.current) { isFirstConfigRender.current = false; return; }
        setIsDirty(true);
    }, [projectConfig]);

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

    const projectConfigRef = useRef(projectConfig);
    projectConfigRef.current = projectConfig;

    const handleExport = useCallback(async () => {
        await exportProject(playersRef.current, videoRef.current, projectConfigRef.current);
        setIsDirty(false);
    }, []);

    const handleImport = useCallback(async (file: File) => {
        const { manifest, videoFile, config } = await importProject(file);
        skipDirtyRef.current = true;
        clearAutosaveRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(manifest.players);

        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        setProjectConfig(config ? { ...DEFAULT_PROJECT_CONFIG, ...config } : DEFAULT_PROJECT_CONFIG);
        if (videoFile) setFileToLoad(videoFile);
    }, [resetPlayers]);

    const handleNew = useCallback(() => {
        skipDirtyRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(makeFreshPlayers());
        localStorage.removeItem(AUTOSAVE_KEY);
        setVideo(null);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setFileToLoad(null);
        setIsDirty(false);
        setProjectConfig(DEFAULT_PROJECT_CONFIG);
    }, [resetPlayers]);

    const handleOpenExportDialog = useCallback(() => setExportDialogOpen(true), []);
    const handleCloseExportDialog = useCallback(() => setExportDialogOpen(false), []);
    const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);

    const inspectorPlayer = selectedEvents[0]
        ? players.find((p) => p.track.events.some((e) => e.id === selectedEvents[0].id)) ?? null
        : null;

    const playersRef = useRef(players);
    playersRef.current = players;

    const videoRef = useRef(video);
    videoRef.current = video;

    const trackGroups = useMemo((): NLETrackGroup[] => [
        ...players.map((p) => ({
            id: p.id,
            label: p.name,
            type: TrackType.Event,
            tracks: [{
                id: p.id,
                type: TrackType.Event,
                events: p.track.events,
                player: p,
                isBlocked: false,
            }],
        })),
        {
            id: 'video',
            label: 'Video',
            type: TrackType.Video,
            tracks: [{ id: 'video-1', type: TrackType.Video, events: [], isBlocked: false }],
        },
        {
            id: 'audio',
            label: 'Audio',
            type: TrackType.Audio,
            tracks: [{ id: 'audio-1', type: TrackType.Audio, events: [], isBlocked: false }],
        },
    ], [players]);

    const handleSelectionChange = useCallback((ids: Set<number>) => {
        if (ids.size === 0) {
            setSelectedEvents([]);
            return;
        }
        const events: TrackEvent[] = [];
        for (const player of playersRef.current) {
            for (const ev of player.track.events) {
                if (ids.has(ev.id)) events.push(ev);
            }
        }
        setSelectedEvents(events);
    }, []);

    const handleNLECreate = useCallback((
        trackId: string,
        partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>,
        onCreated?: (id: number) => void,
    ) => {
        const event = handleCreateEvent(partial, trackId);
        if (event) {
            setNewEventId(event.id);
            onCreated?.(event.id);
        }
    }, [handleCreateEvent]);

    const handleNLEDelete = useCallback((items: DeleteItem[]) => {
        const byPlayer = new Map<string, number[]>();
        for (const { trackId, eventId } of items) {
            const arr = byPlayer.get(trackId) ?? [];
            arr.push(eventId);
            byPlayer.set(trackId, arr);
        }
        for (const [playerId, eventIds] of byPlayer) {
            handleDeleteEvents(playerId, eventIds);
        }
    }, [handleDeleteEvents]);

    const handleNLEDuplicate = useCallback((items: DuplicateItem[], onCreated: (newIds: number[]) => void) => {
        const byPlayer = new Map<string, TrackEvent[]>();
        for (const { trackId, eventId } of items) {
            const player = playersRef.current.find((p) => p.id === trackId);
            const ev = player?.track.events.find((e) => e.id === eventId);
            if (!ev) continue;
            const arr = byPlayer.get(trackId) ?? [];
            arr.push(ev);
            byPlayer.set(trackId, arr);
        }
        const allNewIds: number[] = [];
        for (const [playerId, events] of byPlayer) {
            const newEvents = handleDuplicateEvents(playerId, events);
            allNewIds.push(...newEvents.map((e) => e.id));
        }
        onCreated(allNewIds);
    }, [handleDuplicateEvents]);

    const handleNLEPaste = useCallback((items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => {
        const byPlayer = new Map<string, TrackEvent[]>();
        for (const { trackId, event } of items) {
            const arr = byPlayer.get(trackId) ?? [];
            arr.push(event);
            byPlayer.set(trackId, arr);
        }
        const allNewIds: number[] = [];
        for (const [playerId, events] of byPlayer) {
            const newEvents = handlePasteEvents(playerId, events, pasteTime);
            allNewIds.push(...newEvents.map((e) => e.id));
        }
        onCreated(allNewIds);
    }, [handlePasteEvents]);

    const handleNLEMove = useCallback((moves: NLEMoveResult[]) => {
        handleMoveEvents(moves.map((m) => ({
            fromPlayerId: m.fromTrackId,
            toPlayerId: m.toTrackId,
            eventId: m.eventId,
            newTime: m.newTime,
            newLayer: 0,
        })));
    }, [handleMoveEvents]);

    useEffect(() => {
        if (newEventId !== null && selectedEvents[0]?.id !== newEventId) {
            setNewEventId(null);
        }
    }, [selectedEvents, newEventId]);

    const handleInspectorUpdate = useCallback((eventId: number, meta: EventMeta) => {
        const player = playersRef.current.find((p) => p.track.events.some((e) => e.id === eventId));
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
                    onOpenSettings={handleOpenSettings}
                />
                <SettingsDialog
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    config={projectConfig}
                    onConfigChange={setProjectConfig}
                />
                <ExportDialog
                    open={exportDialogOpen}
                    onClose={handleCloseExportDialog}
                    video={video}
                    players={players}
                />
                <ResizablePanelGroup orientation="vertical" className="flex-1">
                    <ResizablePanel minSize={100} defaultSize="60%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel minSize="150px" defaultSize="15%">
                                <Sources sources={sources} setSources={setSources} />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel
                                minSize={100}
                                defaultSize="70%"
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
                                    overlayStartHidden={projectConfig.overlayStartHidden}
                                    duration={video?.duration ?? 120}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize="400px" defaultSize="15%">
                                <Inspector editObject={selectedEvents} onUpdate={handleInspectorUpdate} player={inspectorPlayer} autoFocus={selectedEvents[0]?.id === newEventId} />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize="280px" defaultSize="40%">
                        <NLETimeline
                            duration={video ? video.duration || 120 : 120}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            currentTimeRef={currentTimeRef}
                            setCurrentTime={setCurrentTime}
                            trackGroups={trackGroups}
                            onUndo={undo}
                            onRedo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onCreateEvent={handleNLECreate}
                            onDeleteEvents={handleNLEDelete}
                            onDuplicateEvents={handleNLEDuplicate}
                            onPasteEvents={handleNLEPaste}
                            onUpdateEvent={handleUpdateEvent}
                            onMoveEvent={handleNLEMove}
                            onResizeStart={handleBeginResize}
                            onResizeEnd={handleCommitResize}
                            onSelectionChange={handleSelectionChange}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
