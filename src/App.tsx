import './App.css';
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
import { RelinkDialog } from './components/Sources/RelinkDialog';
import { getFileDuration, generateThumbnail } from '@/lib/generateThumbnail';
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

const PROJECT_KEY = 'spellsplice-project';
const EDITOR_KEY = 'spellsplice-editor';
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
    sources?: Array<{ id: string; name: string; type: 'video' | 'audio'; duration?: number; thumbnailUrl?: string }>;
    config?: ProjectConfig;
};

type EditorConfig = { volume: number; zoom: number };

function loadEditorConfig(): EditorConfig {
    try {
        const raw = localStorage.getItem(EDITOR_KEY);
        if (!raw) return { volume: 100, zoom: 20 };
        return { volume: 100, zoom: 20, ...JSON.parse(raw) };
    } catch {
        return { volume: 100, zoom: 20 };
    }
}

function loadSavedState(): SavedState | undefined {
    try {
        const raw = localStorage.getItem(PROJECT_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { players: parsed, clipsByTrack: {}, trackOverrides: {} };
        return parsed as SavedState;
    } catch {
        return undefined;
    }
}

function App() {
const [savedStateInit] = useState(loadSavedState);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [video, setVideo] = useState<VideoState | null>(null);
    const [sources, setSources] = useState<MediaSource[]>(
        () => savedStateInit?.sources?.map((s) => ({ ...s, duration: s.duration ?? 0 })) ?? [],
    );
    const [selectedEvents, setSelectedEvents] = useState<TrackEvent[]>([]);

    const [volume, setVolume] = useState(() => loadEditorConfig().volume);
    const [zoom, setZoom] = useState(() => loadEditorConfig().zoom);

    const [isDirty, setIsDirty] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [relinkDialogOpen, setRelinkDialogOpen] = useState(
        () => (savedStateInit?.sources?.length ?? 0) > 0,
    );
    const [deletedSourceNames, setDeletedSourceNames] = useState<Record<string, string>>({});
    const [projectConfig, setProjectConfig] = useState<ProjectConfig>(
        savedStateInit?.config ? { ...DEFAULT_PROJECT_CONFIG, ...savedStateInit.config } : DEFAULT_PROJECT_CONFIG,
    );
    const [newEventId, setNewEventId] = useState<number | null>(null);
    const isFirstPlayersRender = useRef(true);
    const skipDirtyRef = useRef(false);
    const clearAutosaveRef = useRef(false);
    const currentTimeRef = useRef(0);

    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

    const {
        players,
        trackOverrides,
        clipsByTrack,
        handleCreateEventAutoLayer,
        handleDeleteEvents,
        handleDuplicateEvents,
        handlePasteEvents,
        handleUpdateEvent,
        handleBeginResize,
        handleCommitResize,
        handleMoveEvents,
        handleUpdateMeta,
        handleUpdatePlayer,
        recordTrackOverride,
        handleDeleteTrack,
        handleAddClipsWithOverride,
        handleMoveClips,
        handleDeleteClip,
        handleDeleteClips,
        handleDeleteAll,
        relinkClips,
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
                localStorage.removeItem(PROJECT_KEY);
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
            localStorage.removeItem(PROJECT_KEY);
        } else {
            const serializedSources = sources.map(({ id, name, type, duration, thumbnailUrl }) => ({
                id, name, type, duration, thumbnailUrl,
            }));
            localStorage.setItem(PROJECT_KEY, JSON.stringify({ players, clipsByTrack, trackOverrides, sources: serializedSources, config: projectConfig }));
        }
        if (isDirty) return;
        if (skipDirtyRef.current) { skipDirtyRef.current = false; return; }
        setIsDirty(true);
    }, [players, clipsByTrack, trackOverrides, sources, projectConfig]);

    const isFirstEditorRender = useRef(true);
    useEffect(() => {
        if (isFirstEditorRender.current) { isFirstEditorRender.current = false; return; }
        localStorage.setItem(EDITOR_KEY, JSON.stringify({ volume, zoom }));
    }, [volume, zoom]);

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
        await exportProject(playersRef.current, projectConfigRef.current, clipsByTrackRef.current, trackOverridesRef.current, sourcesRef.current);
        setIsDirty(false);
    }, []);

    const handleImport = useCallback(async (file: File) => {
        const { manifest, config, offlineSources } = await importProject(file);
        skipDirtyRef.current = true;
        clearAutosaveRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(manifest.players, manifest.clipsByTrack ?? {}, manifest.trackOverrides ?? {});

        setSources(offlineSources);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        setProjectConfig(config ? { ...DEFAULT_PROJECT_CONFIG, ...config } : DEFAULT_PROJECT_CONFIG);
        if (offlineSources.length > 0) setRelinkDialogOpen(true);
    }, [resetPlayers]);

    const handleNew = useCallback(() => {
        skipDirtyRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(makeFreshPlayers());
        localStorage.removeItem(PROJECT_KEY);
        setVideo(null);
        setSources([]);
        setSelectedEvents([]);
        setCurrentTime(0);
        setIsPlaying(false);
        setIsDirty(false);
        setProjectConfig(DEFAULT_PROJECT_CONFIG);
    }, [resetPlayers]);

    const handleRelinkSource = useCallback(async (sourceId: string, file: File) => {
        setSources((prev) =>
            prev.map((s) => (s.id === sourceId ? { ...s, file, loading: true, thumbnailUrl: undefined } : s)),
        );
        const duration = await getFileDuration(file).catch(() => 0);
        const thumbnailUrl =
            file.type.startsWith('video') ? await generateThumbnail(file).catch(() => undefined) : undefined;
        setSources((prev) =>
            prev.map((s) =>
                s.id === sourceId ? { ...s, file, duration, thumbnailUrl, loading: false } : s,
            ),
        );
    }, []);

    const handleDeleteSource = useCallback((sourceId: string) => {
        const source = sourcesRef.current.find((s) => s.id === sourceId);
        if (source) setDeletedSourceNames((prev) => ({ ...prev, [sourceId]: source.name }));
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        // Clips are kept as orphaned — user can relink via Manage Sources
    }, []);

    const handleRelinkClips = useCallback((oldSourceId: string, newSourceId: string) => {
        relinkClips(oldSourceId, newSourceId);
        setDeletedSourceNames((prev) => {
            const next = { ...prev };
            delete next[oldSourceId];
            return next;
        });
    }, [relinkClips]);

    const handleDeleteOrphanedClips = useCallback((sourceId: string) => {
        const clipsToDelete = Object.entries(clipsByTrackRef.current).flatMap(([trackId, clips]) =>
            clips.filter((c) => c.sourceId === sourceId).map((c) => ({ trackId, clipId: c.id })),
        );
        if (clipsToDelete.length > 0) handleDeleteClips(clipsToDelete);
        setDeletedSourceNames((prev) => {
            const next = { ...prev };
            delete next[sourceId];
            return next;
        });
    }, [handleDeleteClips]);

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
        const event = handleCreateEventAutoLayer(partial, playerId);
        if (event) {
            setNewEventId(event.id);
            onCreated?.(event.id);
        }
    }, [handleCreateEventAutoLayer, trackInfoByTrackId]);

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

    const handleNLEUpdateEvent = useCallback((trackId: string, eventId: number, time: number, eventDuration: number) => {
        const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
        handleUpdateEvent(groupId, eventId, Math.max(0, Math.min(durationRef.current, time)), eventDuration);
    }, [handleUpdateEvent, trackInfoByTrackId]);

    const sourcesRef = useRef(sources);
    sourcesRef.current = sources;

    const handleDropSource = useCallback((trackId: string, sourceId: string, time: number) => {
        const source = sourcesRef.current.find((s) => s.id === sourceId);
        if (!source) return;

        const clipEnd = time + (source.duration ?? 0);
        const clipsCollide = (clips: Clip[]) =>
            clips.some((c) => time < c.time + (c.duration ?? 0) && clipEnd > c.time);

        const resolveTrack = (
            group: NLETrackGroup,
            preferredTrackId: string,
        ): { id: string; updatedRows?: TrackOverrideRow[] } => {
            if (!clipsCollide(clipsByTrack[preferredTrackId] ?? [])) {
                return { id: preferredTrackId };
            }
            for (const t of group.tracks) {
                if (t.id === preferredTrackId || t.isBlocked) continue;
                if (!clipsCollide(clipsByTrack[t.id] ?? [])) return { id: t.id };
            }
            const maxLayer = Math.max(0, ...group.tracks.map((t) => t.eventLayer ?? 0));
            const newRow: TrackOverrideRow = { id: crypto.randomUUID(), type: group.type, isBlocked: false, eventLayer: maxLayer + 1 };
            const updatedRows: TrackOverrideRow[] = [
                ...group.tracks.map((t) => ({ id: t.id, type: t.type, isBlocked: t.isBlocked, eventLayer: t.eventLayer, isHidden: t.isHidden, isMuted: t.isMuted })),
                newRow,
            ];
            return { id: newRow.id, updatedRows };
        };

        const group = trackGroups.find((g) => g.tracks.some((t) => t.id === trackId));
        if (!group) return;

        const clip: Clip = {
            id: crypto.randomUUID(),
            type: source.type === 'video' ? ClipType.Video : ClipType.Audio,
            time,
            duration: source.duration,
            sourceId,
            sourceOffset: 0,
        };

        const videoResolution = resolveTrack(group, trackId);
        const entries: Array<{ trackId: string; clip: Clip }> = [{ trackId: videoResolution.id, clip }];
        const overrides: Array<{ groupId: string; rows: TrackOverrideRow[] }> = [];
        if (videoResolution.updatedRows) overrides.push({ groupId: group.id, rows: videoResolution.updatedRows });

        if (source.type === 'video') {
            const audioGroup = trackGroups.find((g) => g.type === TrackType.Audio);
            const firstAudioTrack = audioGroup?.tracks.find((t) => !t.isBlocked);
            if (audioGroup && firstAudioTrack) {
                const audioResolution = resolveTrack(audioGroup, firstAudioTrack.id);
                entries.push({ trackId: audioResolution.id, clip: { ...clip, id: crypto.randomUUID(), type: ClipType.Audio } });
                if (audioResolution.updatedRows) overrides.push({ groupId: audioGroup.id, rows: audioResolution.updatedRows });
            }
        }

        handleAddClipsWithOverride(entries, overrides);
    }, [trackGroups, clipsByTrack, handleAddClipsWithOverride]);

    const videoClips = useMemo(
        () => trackGroups.find((g) => g.type === TrackType.Video)?.tracks.flatMap((t) => (t.clips ?? []).map((c) => ({ ...c, trackId: t.id }))) ?? [],
        [trackGroups],
    );

    const audioClips = useMemo(
        () => trackGroups.find((g) => g.type === TrackType.Audio)?.tracks.flatMap((t) => (t.clips ?? []).map((c) => ({ ...c, trackId: t.id }))) ?? [],
        [trackGroups],
    );

    const hiddenVideoTrackIds = useMemo(
        () => new Set(trackGroups.find((g) => g.type === TrackType.Video)?.tracks.filter((t) => t.isHidden).map((t) => t.id) ?? []),
        [trackGroups],
    );

    const mutedAudioTrackIds = useMemo(
        () => new Set(trackGroups.find((g) => g.type === TrackType.Audio)?.tracks.filter((t) => t.isMuted).map((t) => t.id) ?? []),
        [trackGroups],
    );

    const handleToggleTrack = useCallback((trackId: string, field: 'isHidden' | 'isMuted' | 'isBlocked') => {
        for (const group of trackGroups) {
            const idx = group.tracks.findIndex((t) => t.id === trackId);
            if (idx === -1) continue;
            const rows: TrackOverrideRow[] = group.tracks.map((t) => ({
                id: t.id,
                type: t.type,
                isBlocked: t.isBlocked,
                eventLayer: t.eventLayer,
                isHidden: t.isHidden,
                isMuted: t.isMuted,
            }));
            rows[idx] = { ...rows[idx], [field]: !rows[idx][field] };
            recordTrackOverride(group.id, rows);
            break;
        }
    }, [trackGroups, recordTrackOverride]);

    const duration = useMemo(() => {
        const clipEnd = Math.max(
            0,
            ...videoClips.map((c) => c.time + c.duration),
            ...audioClips.map((c) => c.time + c.duration),
        );
        return clipEnd > 0 ? clipEnd : (video?.duration ?? DEFAULT_DURATION);
    }, [videoClips, audioClips, video]);

    const durationRef = useRef(duration);
    durationRef.current = duration;

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
                newTime: Math.max(0, Math.min(durationRef.current, m.newTime)),
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
        <section className="h-screen flex flex-col">
                <AppBar
                    isDirty={isDirty}
                    onNew={handleNew}
                    onExport={handleExport}
                    onImport={handleImport}
                    onExportVideo={handleOpenExportDialog}
                    onOpenSettings={handleOpenSettings}
                    onRelinkMedia={() => setRelinkDialogOpen(true)}
                />
                <SettingsDialog
                    open={settingsOpen}
                    onOpenChange={setSettingsOpen}
                    config={projectConfig}
                    onConfigChange={setProjectConfig}
                    players={players}
                    onUpdatePlayer={handleUpdatePlayer}
                />
                <ExportDialog
                    open={exportDialogOpen}
                    onClose={handleCloseExportDialog}
                    videoClips={videoClips}
                    audioClips={audioClips}
                    sources={sources}
                    players={players}
                    config={projectConfig}
                />
                <RelinkDialog
                    open={relinkDialogOpen}
                    onOpenChange={setRelinkDialogOpen}
                    sources={sources}
                    clipsByTrack={clipsByTrack}
                    onRelink={handleRelinkSource}
                    onDelete={handleDeleteSource}
                    onRelinkClips={handleRelinkClips}
                    onDeleteOrphanedClips={handleDeleteOrphanedClips}
                    deletedSourceNames={deletedSourceNames}
                />
                <ResizablePanelGroup orientation="vertical" className="flex-1">
                    <ResizablePanel minSize={100} defaultSize="60%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel minSize="250px" defaultSize="15%">
                                <Sources
                                    sources={sources}
                                    setSources={setSources}
                                    clipsByTrack={clipsByTrack}
                                    onOpenRelinkDialog={() => setRelinkDialogOpen(true)}
                                    onRelink={handleRelinkSource}
                                    onDelete={handleDeleteSource}
                                />
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
                                    hiddenVideoTrackIds={hiddenVideoTrackIds}
                                    mutedAudioTrackIds={mutedAudioTrackIds}
                                    volume={volume}
                                    onVolumeChange={setVolume}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize="250px" defaultSize="15%">
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
                            initialZoom={zoom}
                            onZoomChange={setZoom}
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
                            onUpdateTrack={handleToggleTrack}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </section>
    );
}

export default App;
