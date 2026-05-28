import './App.css';
import { ThemeProvider } from './components/theme-provider';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './components/ui/resizable';
import { NLETimeline } from './components/nle/NLETimeline';
import type { DeleteItem, DuplicateItem, PasteItem } from './components/nle/NLETimeline';
import type { NLEMoveResult } from './components/nle/hooks/nleHookTypes';
import type { Clip } from './components/types/clip';
import { ClipType } from './components/types/clip';
import type { NLETrackGroup, NLETrack } from './components/types/nle';
import { TrackType } from './components/types/nle';
import type { TrackOverrideRow } from './components/Timeline/hooks/usePlayerTracks';
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
const DEFAULT_DURATION = 120;

const initialPlayers: PlayerInit[] = [
    { id: 'player1', name: 'Player 1', handSize: 0, lifeTotal: 20, wins: 0, cards: [], topStack: []},
    { id: 'player2', name: 'Player 2', handSize: 0, lifeTotal: 20, wins: 0, cards: [], topStack: []},
];

const makeFreshPlayers = (): Player[] =>
    initialPlayers.map((p) => ({ ...p, track: { id: p.id, layers: 4, events: [] } }));

type SavedState = {
    players: Player[];
    clipsByTrack: Record<string, import('./components/types/clip').Clip[]>;
    trackOverrides: Record<string, TrackOverrideRow[]>;
};

function loadSavedState(): SavedState | undefined {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { players: parsed, clipsByTrack: {}, trackOverrides: {} };
        return parsed as SavedState;
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
    const [savedStateInit] = useState(loadSavedState);

    const {
        players,
        trackOverrides,
        clipsByTrack,
        handleCreateEvent,
        handleDeleteEvents,
        handleDuplicateEvents,
        handlePasteEvents,
        handleUpdateEvent,
        handleBeginResize,
        handleCommitResize,
        handleMoveEvents,
        handleUpdateMeta,
        recordTrackOverride,
        handleDeleteTrack,
        handleAddClips,
        handleMoveClips,
        handleDeleteClip,
        handleDeleteClips,
        handleDeleteAll,
        resetPlayers,
        undo,
        redo,
        canUndo,
        canRedo,
    } = usePlayerTracks(initialPlayers, currentTimeRef, setSelectedEvents, savedStateInit?.players, savedStateInit?.clipsByTrack, savedStateInit?.trackOverrides);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
            } else {
                localStorage.removeItem(AUTOSAVE_KEY);
            }
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
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ players, clipsByTrack, trackOverrides }));
        }
        if (isDirty) return;
        if (skipDirtyRef.current) { skipDirtyRef.current = false; return; }
        setIsDirty(true);
    }, [players, clipsByTrack, trackOverrides]);

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

    const clipsByTrackRef = useRef(clipsByTrack);
    clipsByTrackRef.current = clipsByTrack;
    const trackOverridesRef = useRef(trackOverrides);
    trackOverridesRef.current = trackOverrides;

    const handleExport = useCallback(async () => {
        await exportProject(playersRef.current, videoRef.current, projectConfigRef.current, clipsByTrackRef.current, trackOverridesRef.current);
        setIsDirty(false);
    }, []);

    const handleImport = useCallback(async (file: File) => {
        const { manifest, config } = await importProject(file);
        skipDirtyRef.current = true;
        clearAutosaveRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(manifest.players, manifest.clipsByTrack ?? {}, manifest.trackOverrides ?? {});

        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        setProjectConfig(config ? { ...DEFAULT_PROJECT_CONFIG, ...config } : DEFAULT_PROJECT_CONFIG);
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
        ...players.map((p) => {
            const override = trackOverrides[p.id];
            const tracks: NLETrack[] = override
                ? override.map((t) => ({
                    ...t,
                    events: p.track.events.filter((e) => e.layer === (t.eventLayer ?? 0)),
                    player: p,
                }))
                : [{ id: p.id, type: TrackType.Event, events: p.track.events, player: p, isBlocked: false, eventLayer: 0 }];
            return { id: p.id, label: p.name, type: TrackType.Event, tracks };
        }),
        {
            id: 'video',
            label: 'Video',
            type: TrackType.Video,
            tracks: (trackOverrides['video'] ?? [{ id: 'video-1', type: TrackType.Video, isBlocked: false }]).map((t) => ({ ...t, events: [], clips: clipsByTrack[t.id] ?? [] })),
        },
        {
            id: 'audio',
            label: 'Audio',
            type: TrackType.Audio,
            tracks: (trackOverrides['audio'] ?? [{ id: 'audio-1', type: TrackType.Audio, isBlocked: false }]).map((t) => ({ ...t, events: [], clips: clipsByTrack[t.id] ?? [] })),
        },
    ], [players, trackOverrides, clipsByTrack]);

    const trackInfoByTrackId = useMemo(() => {
        const map = new Map<string, { groupId: string; eventLayer: number }>();
        for (const group of trackGroups) {
            for (const track of group.tracks) {
                map.set(track.id, { groupId: group.id, eventLayer: track.eventLayer ?? 0 });
            }
        }
        return map;
    }, [trackGroups]);

    const handleAddTrack = useCallback((groupId: string, trackId: string, position: 'above' | 'below') => {
        const group = trackGroups.find((g) => g.id === groupId);
        if (!group) return;
        const maxLayer = Math.max(...group.tracks.map((t) => t.eventLayer ?? 0));
        const newRow: TrackOverrideRow = {
            id: crypto.randomUUID(),
            type: group.type,
            isBlocked: false,
            eventLayer: maxLayer + 1,
        };
        const idx = group.tracks.findIndex((t) => t.id === trackId);
        if (idx === -1) return;
        const currentRows: TrackOverrideRow[] = group.tracks.map((t) => ({
            id: t.id,
            type: t.type,
            isBlocked: t.isBlocked,
            eventLayer: t.eventLayer,
            isHidden: t.isHidden,
            isMuted: t.isMuted,
        }));
        currentRows.splice(position === 'above' ? idx + 1 : idx, 0, newRow);
        recordTrackOverride(groupId, currentRows);
    }, [trackGroups, recordTrackOverride]);

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
        const resolved = trackInfoByTrackId.get(trackId);
        const playerId = resolved?.groupId ?? trackId;
        const layer = resolved?.eventLayer ?? 0;
        const event = handleCreateEvent({ layer, ...partial }, playerId);
        if (event) {
            setNewEventId(event.id);
            onCreated?.(event.id);
        }
    }, [handleCreateEvent, trackInfoByTrackId]);

    const handleNLEDelete = useCallback((items: DeleteItem[]) => {
        const byPlayer = new Map<string, number[]>();
        for (const { trackId, eventId } of items) {
            const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
            const arr = byPlayer.get(groupId) ?? [];
            arr.push(eventId);
            byPlayer.set(groupId, arr);
        }
        for (const [playerId, eventIds] of byPlayer) {
            handleDeleteEvents(playerId, eventIds);
        }
    }, [handleDeleteEvents, trackInfoByTrackId]);

    const handleNLEDeleteSelection = useCallback((
        eventItems: DeleteItem[],
        clipItems: { trackId: string; clipId: string }[],
    ) => {
        const byPlayer = new Map<string, number[]>();
        for (const { trackId, eventId } of eventItems) {
            const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
            const arr = byPlayer.get(groupId) ?? [];
            arr.push(eventId);
            byPlayer.set(groupId, arr);
        }
        handleDeleteAll(
            Array.from(byPlayer, ([playerId, eventIds]) => ({ playerId, eventIds })),
            clipItems,
        );
    }, [handleDeleteAll, trackInfoByTrackId]);

    const handleNLEDuplicate = useCallback((items: DuplicateItem[], onCreated: (newIds: number[]) => void) => {
        const byPlayer = new Map<string, TrackEvent[]>();
        for (const { trackId, eventId } of items) {
            const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
            const player = playersRef.current.find((p) => p.id === groupId);
            const ev = player?.track.events.find((e) => e.id === eventId);
            if (!ev) continue;
            const arr = byPlayer.get(groupId) ?? [];
            arr.push(ev);
            byPlayer.set(groupId, arr);
        }
        const allNewIds: number[] = [];
        for (const [playerId, events] of byPlayer) {
            const newEvents = handleDuplicateEvents(playerId, events);
            allNewIds.push(...newEvents.map((e) => e.id));
        }
        onCreated(allNewIds);
    }, [handleDuplicateEvents, trackInfoByTrackId]);

    const handleNLEPaste = useCallback((items: PasteItem[], pasteTime: number, onCreated: (newIds: number[]) => void) => {
        const byPlayer = new Map<string, TrackEvent[]>();
        for (const { trackId, event } of items) {
            const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
            const arr = byPlayer.get(groupId) ?? [];
            arr.push(event);
            byPlayer.set(groupId, arr);
        }
        const allNewIds: number[] = [];
        for (const [playerId, events] of byPlayer) {
            const newEvents = handlePasteEvents(playerId, events, pasteTime);
            allNewIds.push(...newEvents.map((e) => e.id));
        }
        onCreated(allNewIds);
    }, [handlePasteEvents, trackInfoByTrackId]);

    const handleNLEUpdateEvent = useCallback((trackId: string, eventId: number, time: number, duration: number) => {
        const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
        handleUpdateEvent(groupId, eventId, time, duration);
    }, [handleUpdateEvent, trackInfoByTrackId]);

    const sourcesRef = useRef(sources);
    sourcesRef.current = sources;

    const handleDropSource = useCallback((trackId: string, sourceId: string, time: number) => {
        const source = sourcesRef.current.find((s) => s.id === sourceId);
        if (!source) return;
        const clip: Clip = {
            id: crypto.randomUUID(),
            type: source.type === 'video' ? ClipType.Video : ClipType.Audio,
            time,
            duration: source.duration,
            sourceId,
            sourceOffset: 0,
        };
        const entries: Array<{ trackId: string; clip: Clip }> = [{ trackId, clip }];
        if (source.type === 'video') {
            const audioTrack = trackGroups.find((g) => g.type === TrackType.Audio)?.tracks.find((t) => !t.isBlocked);
            if (audioTrack) {
                entries.push({ trackId: audioTrack.id, clip: { ...clip, id: crypto.randomUUID(), type: ClipType.Audio } });
            }
        }
        handleAddClips(entries);
    }, [trackGroups, handleAddClips]);

    const videoClips = useMemo(
        () => trackGroups.find((g) => g.type === TrackType.Video)?.tracks.flatMap((t) => t.clips ?? []) ?? [],
        [trackGroups],
    );

    const audioClips = useMemo(
        () => trackGroups.find((g) => g.type === TrackType.Audio)?.tracks.flatMap((t) => t.clips ?? []) ?? [],
        [trackGroups],
    );

    const duration = useMemo(() => {
        const clipEnd = Math.max(
            0,
            ...videoClips.map((c) => c.time + c.duration),
            ...audioClips.map((c) => c.time + c.duration),
        );
        return clipEnd > 0 ? clipEnd : (video?.duration ?? DEFAULT_DURATION);
    }, [videoClips, audioClips, video]);

    const handleNLEMove = useCallback((
        moves: NLEMoveResult[],
        newTracksInfo?: Map<string, { groupId: string; eventLayer: number; targetLocalIndex: number }>,
    ) => {
        if (newTracksInfo && newTracksInfo.size > 0) {
            const newByGroup = new Map<string, Array<{ id: string; eventLayer: number; targetLocalIndex: number }>>();
            for (const [trackId, info] of newTracksInfo) {
                const list = newByGroup.get(info.groupId) ?? [];
                list.push({ id: trackId, eventLayer: info.eventLayer, targetLocalIndex: info.targetLocalIndex });
                newByGroup.set(info.groupId, list);
            }
            for (const [groupId, newTracks] of newByGroup) {
                const group = trackGroups.find((g) => g.id === groupId);
                if (!group) continue;
                const currentRows: TrackOverrideRow[] = group.tracks.map((t) => ({
                    id: t.id,
                    type: t.type,
                    isBlocked: t.isBlocked,
                    eventLayer: t.eventLayer,
                    isHidden: t.isHidden,
                    isMuted: t.isMuted,
                }));
                const prepends = newTracks
                    .filter(({ targetLocalIndex }) => targetLocalIndex < 0)
                    .sort((a, b) => a.targetLocalIndex - b.targetLocalIndex);
                const appends = newTracks
                    .filter(({ targetLocalIndex }) => targetLocalIndex >= group.tracks.length)
                    .sort((a, b) => a.targetLocalIndex - b.targetLocalIndex);
                for (let i = 0; i < prepends.length; i++) {
                    currentRows.splice(i, 0, {
                        id: prepends[i].id,
                        type: TrackType.Event,
                        isBlocked: false,
                        eventLayer: prepends[i].eventLayer,
                    });
                }
                for (const { id, eventLayer } of appends) {
                    currentRows.push({ id, type: TrackType.Event, isBlocked: false, eventLayer });
                }
                recordTrackOverride(groupId, currentRows);
            }
        }

        const extendedInfo = new Map(trackInfoByTrackId);
        if (newTracksInfo) {
            for (const [trackId, info] of newTracksInfo) {
                extendedInfo.set(trackId, info);
            }
        }

        handleMoveEvents(moves.map((m) => {
            const from = extendedInfo.get(m.fromTrackId);
            const to = extendedInfo.get(m.toTrackId);
            return {
                fromPlayerId: from?.groupId ?? m.fromTrackId,
                toPlayerId: to?.groupId ?? m.toTrackId,
                eventId: m.eventId,
                newTime: m.newTime,
                newLayer: to?.eventLayer ?? 0,
            };
        }));
    }, [handleMoveEvents, trackGroups, trackInfoByTrackId, recordTrackOverride]);

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
                                    setCurrentTime={setCurrentTime}
                                    setIsPlaying={setIsPlaying}
                                    players={players}
                                    overlayStartHidden={projectConfig.overlayStartHidden}
                                    duration={duration}
                                    videoClips={videoClips}
                                    audioClips={audioClips}
                                    sources={sources}
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
                            duration={duration}
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
                            onUpdateEvent={handleNLEUpdateEvent}
                            onMoveEvent={handleNLEMove}
                            onResizeStart={handleBeginResize}
                            onResizeEnd={handleCommitResize}
                            onSelectionChange={handleSelectionChange}
                            onAddTrack={handleAddTrack}
                            onDeleteTrack={handleDeleteTrack}
                            sources={sources}
                            onDropSource={handleDropSource}
                            onMoveClips={handleMoveClips}
                            onDeleteClip={handleDeleteClip}
                            onDeleteClips={handleDeleteClips}
                            onDeleteSelection={handleNLEDeleteSelection}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
        </ThemeProvider>
    );
}

export default App;
