import './App.css';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from './components/ui/resizable';
import { Timeline } from './features/timeline/Timeline';
import type {
    DeleteItem,
    DuplicateItem,
    PasteItem,
    ViewMode,
} from './features/timeline/Timeline';
import type { MoveResult } from './features/timeline/hooks/hookTypes';
import type { TrimCommit } from './features/timeline/hooks/useClipTrim';
import type { Clip } from './types/clip';
import { ClipType } from './types/clip';
import {
    defaultTransform,
    DEFAULT_IMAGE_CLIP_DURATION,
    resolveTransform,
    clipRectInProject,
    pointInRect,
    NO_CROP,
} from '@/lib/clipTransform';
import type { TimelineTrackGroup, TimelineTrack } from './features/timeline/types';
import { TrackType } from './features/timeline/types';
import type { TrackOverrideRow } from './features/timeline/hooks/usePlayerTracks';
import type { Player } from './types/player';
import type { TrackEvent, EventMeta } from './types/event';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { exportProject, importProject } from '@/lib/projectExport';
import { migrateLegacyEvents } from '@/lib/migrateProject';
import { RelinkDialog } from './features/sources/RelinkDialog';
import { getMediaMetadata, generateThumbnail } from '@/lib/generateThumbnail';
import { fingerprintOf } from '@/lib/matchSources';
import { resolveMedia, type MediaResolution } from '@/lib/resolveMedia';
import { deleteMediaRoot } from '@/lib/mediaRoots';
import VideoPreview, {
    type VideoPreviewHandle,
} from './features/timeline/VideoPreview';
import { PreviewGizmo } from './features/timeline/PreviewGizmo';
import type { VideoState } from './types/video';
import { Inspector } from './features/inspector/index';
import { usePlayerTracks } from './features/timeline/hooks/usePlayerTracks';
import AppBar from './features/app-bar/index';
import { ExportDialog } from './features/export/ExportDialog';
import SettingsDialog from './features/settings/SettingsDialog';
import type { Section as SettingsSection } from './features/settings/SettingsDialog';
import TimelineCardsLoader from './features/timeline/TimelineCardsLoader';
import {
    ensureOracleCards,
    forceRefreshOracleCards,
    type OracleCardsStatus,
} from '@/lib/oracleCards';
import type { ProjectConfig } from './types/config';
import { DEFAULT_PROJECT_CONFIG } from './types/config';
import { Sources } from './features/sources/index';
import type { MediaSource } from './types/source';
import WelcomeScreen from './features/welcome/index';
import LiveMode, { type LiveModeHandle } from './features/live-mode/LiveMode';
import LiveModeDialog, {
    type Section as LiveSettingsSection,
} from './features/live-mode/LiveModeDialog';
import {
    LIVE_PROJECT_KEY,
    LIVE_SCOREBOARD_KEY,
    LIVE_CARD_DISPLAY_KEY,
    LIVE_HAND_STACK_KEY,
    loadLiveModeConfig,
    DEFAULT_CARD_DISPLAY_DURATION_MS,
} from '@/lib/liveMode';

type PlayerInit = Omit<Player, 'track'>;

const PROJECT_KEY = 'spellsplice-project';
const EDITOR_KEY = 'spellsplice-editor';
const MODE_KEY = 'spellsplice-mode';

type Mode = 'welcome' | 'timeline' | 'live';

function loadMode(hasProject: boolean): Mode {
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'timeline' || raw === 'live' || raw === 'welcome') return raw;
    return hasProject ? 'timeline' : 'welcome';
}

const initialPlayers: PlayerInit[] = [
    {
        id: 'player1',
        name: 'Player 1',
        handSize: 0,
        lifeTotal: 20,
        wins: 0,
        cards: [],
    },
    {
        id: 'player2',
        name: 'Player 2',
        handSize: 0,
        lifeTotal: 20,
        wins: 0,
        cards: [],
    },
];

const makeFreshPlayers = (): Player[] =>
    initialPlayers.map((p) => ({
        ...p,
        track: { id: p.id, layers: 4, events: [] },
    }));

/**
 * Rebuild an override row from a live track. Every call site that persists rows
 * must go through this: each new TrackOverrideRow field (syncLock, height…) was
 * otherwise dropped by whichever site forgot to copy it.
 */
function toOverrideRow(t: TimelineTrack): TrackOverrideRow {
    return {
        id: t.id,
        type: t.type,
        isBlocked: t.isBlocked,
        eventLayer: t.eventLayer,
        isHidden: t.isHidden,
        isMuted: t.isMuted,
        syncLock: t.syncLock,
        height: t.height,
    };
}

type SavedState = {
    id?: string;
    mediaRoot?: string;
    players: Player[];
    clipsByTrack: Record<string, import('./types/clip').Clip[]>;
    trackOverrides: Record<string, TrackOverrideRow[]>;
    sources?: Array<{
        id: string;
        name: string;
        type: 'video' | 'audio';
        duration?: number;
        thumbnailUrl?: string;
        size?: number;
        lastModified?: number;
        relativePath?: string;
    }>;
    config?: ProjectConfig;
    markers?: import('./types/marker').Marker[];
};

type EditorConfig = {
    volume: number;
    zoom: number;
    viewMode: ViewMode;
    snapEnabled: boolean;
    followPlayhead: boolean;
    loop: boolean;
    /** Group ids collapsed in the timeline. View preference, not project data. */
    collapsedGroups: string[];
};

const DEFAULT_EDITOR_CONFIG: EditorConfig = {
    volume: 100,
    zoom: 20,
    viewMode: 'full',
    snapEnabled: true,
    followPlayhead: true,
    loop: false,
    collapsedGroups: [],
};

function loadEditorConfig(): EditorConfig {
    try {
        const raw = localStorage.getItem(EDITOR_KEY);
        if (!raw) return DEFAULT_EDITOR_CONFIG;
        return { ...DEFAULT_EDITOR_CONFIG, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_EDITOR_CONFIG;
    }
}

function loadSavedState(): SavedState | undefined {
    try {
        const raw = localStorage.getItem(PROJECT_KEY);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed))
            return { players: parsed, clipsByTrack: {}, trackOverrides: {} };
        return parsed as SavedState;
    } catch {
        return undefined;
    }
}

function App() {
    const [savedStateInit] = useState(loadSavedState);
    const [mode, setMode] = useState<Mode>(() => loadMode(!!savedStateInit));
    const [liveSettingsOpen, setLiveSettingsOpen] = useState(false);
    const [liveSettingsSection, setLiveSettingsSection] =
        useState<LiveSettingsSection>('connection');
    const [cardDisplayDuration, setCardDisplayDuration] = useState(
        () =>
            loadLiveModeConfig()?.cardDisplayDuration ??
            DEFAULT_CARD_DISPLAY_DURATION_MS
    );
    const [isPlaying, setIsPlaying] = useState(false);
    // JKL shuttle speed, forward only. Reset to 1 whenever playback stops so a
    // stop that didn't come from the transport (end of timeline) can't leave the
    // next play running at 8x.
    const [playbackRate, setPlaybackRate] = useState(1);
    const [video, setVideo] = useState<VideoState | null>(null);
    const [sources, setSources] = useState<MediaSource[]>(
        () =>
            savedStateInit?.sources?.map((s) => ({
                ...s,
                duration: s.duration ?? 0,
            })) ?? []
    );
    const [selectedEvents, setSelectedEvents] = useState<TrackEvent[]>([]);

    const [volume, setVolume] = useState(() => loadEditorConfig().volume);
    const [zoom, setZoom] = useState(() => loadEditorConfig().zoom);
    const [viewMode, setViewMode] = useState(() => loadEditorConfig().viewMode);
    const [snapEnabled, setSnapEnabled] = useState(() => loadEditorConfig().snapEnabled);
    const [followPlayhead, setFollowPlayhead] = useState(() => loadEditorConfig().followPlayhead);
    const [loop, setLoop] = useState(() => loadEditorConfig().loop);
    const [collapsedGroups, setCollapsedGroups] = useState<string[]>(
        () => loadEditorConfig().collapsedGroups
    );
    // In/out are a session range, not project data: they scope playback and the
    // export, and are cheap to re-mark.
    const [inPoint, setInPoint] = useState<number | null>(null);
    const [outPoint, setOutPoint] = useState<number | null>(null);

    const [isDirty, setIsDirty] = useState(false);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] =
        useState<SettingsSection>('metadata');
    const [cardStatus, setCardStatus] = useState<OracleCardsStatus>('idle');
    const [cardProgress, setCardProgress] = useState<number | undefined>(
        undefined
    );
    const [cardsReady, setCardsReady] = useState(false);
    // Opened by the media resolve, not by the mere presence of offline sources:
    // a project whose folder is still remembered reattaches silently and should
    // never show the dialog.
    const [relinkDialogOpen, setRelinkDialogOpen] = useState(false);
    const [mediaResolution, setMediaResolution] = useState<MediaResolution | null>(null);
    const [projectId, setProjectId] = useState(
        () => savedStateInit?.id ?? crypto.randomUUID()
    );
    const [mediaRoot, setMediaRootName] = useState<string | undefined>(
        () => savedStateInit?.mediaRoot
    );
    const [deletedSourceNames, setDeletedSourceNames] = useState<
        Record<string, string>
    >({});
    const [projectConfig, setProjectConfig] = useState<ProjectConfig>(
        savedStateInit?.config
            ? { ...DEFAULT_PROJECT_CONFIG, ...savedStateInit.config }
            : DEFAULT_PROJECT_CONFIG
    );
    const [newEventId, setNewEventId] = useState<number | null>(null);
    const liveModeRef = useRef<LiveModeHandle>(null);
    const isFirstPlayersRender = useRef(true);
    const skipDirtyRef = useRef(false);
    const suppressDirtyRef = useRef(false);
    const clearAutosaveRef = useRef(false);
    const projectIdRef = useRef(projectId);
    projectIdRef.current = projectId;
    const mediaRootRef = useRef(mediaRoot);
    mediaRootRef.current = mediaRoot;
    const currentTimeRef = useRef(0);
    const videoPreviewRef = useRef<VideoPreviewHandle>(null);

    // Playback time lives entirely in currentTimeRef (VideoPreview's loop owns it,
    // the timeline cursor reads it imperatively). Seeks route here instead of
    // through App state, so App never re-renders per tick during playback.
    const handleSeek = useCallback((t: number) => {
        currentTimeRef.current = t;
        videoPreviewRef.current?.seek(t);
    }, []);

    useEffect(() => {
        if (!isPlaying) setPlaybackRate(1);
    }, [isPlaying]);

    const handleCardStatus = useCallback(
        (status: OracleCardsStatus, progress?: number) => {
            setCardStatus(status);
            setCardProgress(progress);
        },
        []
    );

    useEffect(() => {
        localStorage.setItem(MODE_KEY, mode);
    }, [mode]);

    // Load the shared card database on entering timeline. The module dedupes
    // with live mode, so at most one download happens. First run blocks (below);
    // a stale copy resolves immediately and refreshes in the background.
    useEffect(() => {
        if (mode !== 'timeline') return;
        ensureOracleCards(handleCardStatus)
            .then(() => setCardsReady(true))
            .catch(() => {});
    }, [mode, handleCardStatus]);

    const handleRetryCards = useCallback(() => {
        setCardsReady(false);
        forceRefreshOracleCards(handleCardStatus)
            .then(() => setCardsReady(true))
            .catch(() => {});
    }, [handleCardStatus]);

    const handleForceRefreshCards = useCallback(() => {
        forceRefreshOracleCards(handleCardStatus).catch(() => {});
    }, [handleCardStatus]);

    // Stable identities so React.memo(AppBar) holds across the ~10Hz playback
    // re-renders (inline lambdas here would re-render the whole AppBar + menus).
    const handleOpenRelinkMedia = useCallback(
        () => setRelinkDialogOpen(true),
        []
    );
    const handleOpenLiveSettings = useCallback(() => {
        setLiveSettingsSection('connection');
        setLiveSettingsOpen(true);
    }, []);

    const {
        players,
        trackOverrides,
        clipsByTrack,
        markers,
        handleTrimClip,
        handleSplitClips,
        handleRippleDelete,
        handleCloseGaps,
        handleUpdateClipGain,
        handleUnlinkClip,
        handleAddMarker,
        handleUpdateMarker,
        handleDeleteMarker,
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
        handleUpdateClipTransform,
        handleDeleteClip,
        handleDeleteClips,
        handleDeleteAll,
        relinkClips,
        resetPlayers,
        undo,
        redo,
        canUndo,
        canRedo,
    } = usePlayerTracks(
        initialPlayers,
        currentTimeRef,
        setSelectedEvents,
        savedStateInit?.players
            ? migrateLegacyEvents(savedStateInit.players)
            : undefined,
        savedStateInit?.clipsByTrack,
        savedStateInit?.trackOverrides,
        savedStateInit?.markers
    );

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
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
            const serializedSources = sources.map(
                ({ id, name, type, duration, thumbnailUrl, size, lastModified, relativePath }) => ({
                    id,
                    name,
                    type,
                    duration,
                    thumbnailUrl,
                    size,
                    lastModified,
                    relativePath,
                })
            );
            localStorage.setItem(
                PROJECT_KEY,
                JSON.stringify({
                    id: projectIdRef.current,
                    mediaRoot: mediaRootRef.current,
                    players,
                    clipsByTrack,
                    trackOverrides,
                    sources: serializedSources,
                    config: projectConfig,
                    markers,
                })
            );
        }
        if (isDirty) return;
        // An automatic relink reattaches files that already matched what was
        // saved, so nothing serialized actually changed. Marking the project
        // dirty for it would put an unsaved-changes prompt on every reload.
        if (suppressDirtyRef.current) return;
        if (skipDirtyRef.current) {
            skipDirtyRef.current = false;
            return;
        }
        setIsDirty(true);
    }, [players, clipsByTrack, trackOverrides, sources, projectConfig, markers]);

    const isFirstEditorRender = useRef(true);
    useEffect(() => {
        if (isFirstEditorRender.current) {
            isFirstEditorRender.current = false;
            return;
        }
        localStorage.setItem(
            EDITOR_KEY,
            JSON.stringify({
                volume,
                zoom,
                viewMode,
                snapEnabled,
                followPlayhead,
                loop,
                collapsedGroups,
            })
        );
    }, [volume, zoom, viewMode, snapEnabled, followPlayhead, loop, collapsedGroups]);

    const isFirstConfigRender = useRef(true);
    useEffect(() => {
        if (isFirstConfigRender.current) {
            isFirstConfigRender.current = false;
            return;
        }
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
            return next.length === prev.length &&
                next.every((e, i) => e === prev[i])
                ? prev
                : next;
        });
    }, [players]);

    const projectConfigRef = useRef(projectConfig);
    projectConfigRef.current = projectConfig;

    // Overlay-appearance slice for the preview/export, memoized so its reference
    // changes only when the config does — VideoPreview repaints on that change.
    const overlayConfig = useMemo(
        () => ({
            overlayStartHidden: projectConfig.overlayStartHidden,
            annotationSlots: projectConfig.annotationSlots,
            scoreboard: projectConfig.scoreboard,
            handStack: projectConfig.handStack,
            cardDisplay: projectConfig.cardDisplay,
            annotationConfig: projectConfig.annotationConfig,
            layers: projectConfig.layers,
        }),
        [projectConfig]
    );

    const clipsByTrackRef = useRef(clipsByTrack);
    clipsByTrackRef.current = clipsByTrack;
    const trackOverridesRef = useRef(trackOverrides);
    trackOverridesRef.current = trackOverrides;
    const markersRef = useRef(markers);
    markersRef.current = markers;

    const handleRelinkMany = useCallback(
        async (pairs: Array<{ sourceId: string; file: File }>) => {
            if (pairs.length === 0) return;
            const byId = new Map(pairs.map((p) => [p.sourceId, p.file]));
            setSources((prev) =>
                prev.map((s) => {
                    const file = byId.get(s.id);
                    return file
                        ? {
                              ...s,
                              file,
                              loading: true,
                              thumbnailUrl: undefined,
                              ...fingerprintOf(file),
                          }
                        : s;
                })
            );
            await Promise.all(
                pairs.map(async ({ sourceId, file }) => {
                    const meta = await getMediaMetadata(file).catch(() => ({
                        duration: 0,
                        width: 0,
                        height: 0,
                    }));
                    const thumbnailUrl = file.type.startsWith('audio')
                        ? undefined
                        : await generateThumbnail(file).catch(() => undefined);
                    setSources((prev) =>
                        prev.map((s) =>
                            s.id === sourceId
                                ? {
                                      ...s,
                                      duration: meta.duration,
                                      width: meta.width || undefined,
                                      height: meta.height || undefined,
                                      thumbnailUrl,
                                      loading: false,
                                  }
                                : s
                        )
                    );
                })
            );
        },
        []
    );

    const handleRelinkSource = useCallback(
        (sourceId: string, file: File) => handleRelinkMany([{ sourceId, file }]),
        [handleRelinkMany]
    );

    /**
     * Reattaches media from the project's remembered folder. Everything matched
     * exactly is applied without UI; anything less certain opens the dialog with
     * the matches pre-filled for review.
     */
    const runMediaResolve = useCallback(
        async (id: string, offlineSources: MediaSource[]) => {
            if (offlineSources.length === 0) return;
            const resolution = await resolveMedia(id, offlineSources);
            const exact = resolution.matches.filter(
                (m): m is typeof m & { file: File } => !!m.file && m.confidence === 'exact'
            );
            if (exact.length === offlineSources.length) {
                suppressDirtyRef.current = true;
                try {
                    await handleRelinkMany(
                        exact.map((m) => ({ sourceId: m.sourceId, file: m.file }))
                    );
                } finally {
                    // Let the trailing setSources renders flush through the
                    // autosave effect before dirty tracking resumes.
                    setTimeout(() => {
                        suppressDirtyRef.current = false;
                    }, 0);
                }
                return;
            }
            setMediaResolution(resolution);
            setRelinkDialogOpen(true);
        },
        [handleRelinkMany]
    );

    const didRestoreMedia = useRef(false);
    useEffect(() => {
        if (didRestoreMedia.current) return;
        didRestoreMedia.current = true;
        const restored = savedStateInit?.sources;
        if (!restored?.length) return;
        void runMediaResolve(
            projectIdRef.current,
            restored.map((s) => ({ ...s, duration: s.duration ?? 0 }) as MediaSource)
        );
    }, [savedStateInit, runMediaResolve]);

    const handleExport = useCallback(async () => {
        await exportProject(
            playersRef.current,
            projectConfigRef.current,
            clipsByTrackRef.current,
            trackOverridesRef.current,
            sourcesRef.current,
            markersRef.current,
            projectIdRef.current,
            mediaRootRef.current
        );
        setIsDirty(false);
    }, []);

    const handleImport = useCallback(
        async (file: File) => {
            const { manifest, config, offlineSources } =
                await importProject(file);
            // Projects saved before media roots existed have no id; minting one
            // here lets the user pick a folder now and get silent relinks after.
            const id = manifest.id ?? crypto.randomUUID();
            setProjectId(id);
            projectIdRef.current = id;
            setMediaRootName(manifest.mediaRoot);
            mediaRootRef.current = manifest.mediaRoot;
            skipDirtyRef.current = true;
            clearAutosaveRef.current = true;
            isFirstConfigRender.current = true;
            resetPlayers(
                migrateLegacyEvents(manifest.players),
                manifest.clipsByTrack ?? {},
                manifest.trackOverrides ?? {},
                manifest.markers ?? []
            );
            setInPoint(null);
            setOutPoint(null);

            setSources(offlineSources);
            setSelectedEvents([]);
            currentTimeRef.current = 0;
            videoPreviewRef.current?.seek(0);
            setIsPlaying(false);
            setIsDirty(false);
            setProjectConfig(
                config
                    ? { ...DEFAULT_PROJECT_CONFIG, ...config }
                    : DEFAULT_PROJECT_CONFIG
            );
            setMode('timeline');
            void runMediaResolve(id, offlineSources);
        },
        [resetPlayers, runMediaResolve]
    );

    const resetToFresh = useCallback(() => {
        skipDirtyRef.current = true;
        clearAutosaveRef.current = true;
        isFirstConfigRender.current = true;
        resetPlayers(makeFreshPlayers());
        localStorage.removeItem(PROJECT_KEY);
        void deleteMediaRoot(projectIdRef.current);
        const freshId = crypto.randomUUID();
        setProjectId(freshId);
        projectIdRef.current = freshId;
        setMediaRootName(undefined);
        mediaRootRef.current = undefined;
        setMediaResolution(null);
        setRelinkDialogOpen(false);
        setVideo(null);
        setSources([]);
        setSelectedEvents([]);
        currentTimeRef.current = 0;
        videoPreviewRef.current?.seek(0);
        setIsPlaying(false);
        setIsDirty(false);
        setProjectConfig(DEFAULT_PROJECT_CONFIG);
    }, [resetPlayers]);

    const handleNew = useCallback(() => {
        resetToFresh();
        setMode('timeline');
    }, [resetToFresh]);

    const handleFileNew = useCallback(() => {
        if (mode === 'timeline') resetToFresh();
        else if (mode === 'live') {
            liveModeRef.current?.resetOverlay();
            localStorage.removeItem(LIVE_PROJECT_KEY);
            localStorage.removeItem(LIVE_SCOREBOARD_KEY);
            localStorage.removeItem(LIVE_CARD_DISPLAY_KEY);
            localStorage.removeItem(LIVE_HAND_STACK_KEY);
        }
        setMode('welcome');
    }, [mode, resetToFresh]);


    const handleDeleteSource = useCallback((sourceId: string) => {
        const source = sourcesRef.current.find((s) => s.id === sourceId);
        if (source)
            setDeletedSourceNames((prev) => ({
                ...prev,
                [sourceId]: source.name,
            }));
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        // Clips are kept as orphaned — user can relink via Manage Sources
    }, []);

    const handleRelinkClips = useCallback(
        (oldSourceId: string, newSourceId: string) => {
            relinkClips(oldSourceId, newSourceId);
            setDeletedSourceNames((prev) => {
                const next = { ...prev };
                delete next[oldSourceId];
                return next;
            });
        },
        [relinkClips]
    );

    const handleDeleteOrphanedClips = useCallback(
        (sourceId: string) => {
            const clipsToDelete = Object.entries(
                clipsByTrackRef.current
            ).flatMap(([trackId, clips]) =>
                clips
                    .filter((c) => c.sourceId === sourceId)
                    .map((c) => ({ trackId, clipId: c.id }))
            );
            if (clipsToDelete.length > 0) handleDeleteClips(clipsToDelete);
            setDeletedSourceNames((prev) => {
                const next = { ...prev };
                delete next[sourceId];
                return next;
            });
        },
        [handleDeleteClips]
    );

    const handleOpenExportDialog = useCallback(
        () => setExportDialogOpen(true),
        []
    );
    const handleCloseExportDialog = useCallback(
        () => setExportDialogOpen(false),
        []
    );
    const handleOpenSettings = useCallback(() => {
        setSettingsSection('metadata');
        setSettingsOpen(true);
    }, []);
    const handleManageSlots = useCallback(() => {
        setSettingsSection('annotation-slots');
        setSettingsOpen(true);
    }, []);

    const inspectorPlayer = selectedEvents[0]
        ? (players.find((p) =>
              p.track.events.some((e) => e.id === selectedEvents[0].id)
          ) ?? null)
        : null;

    const playersRef = useRef(players);
    playersRef.current = players;

    const videoRef = useRef(video);
    videoRef.current = video;

    const trackGroups = useMemo(
        (): TimelineTrackGroup[] => [
            ...players.map((p) => {
                const override = trackOverrides[p.id];
                const tracks: TimelineTrack[] = override
                    ? override.map((t) => ({
                          ...t,
                          events: p.track.events.filter(
                              (e) => e.layer === (t.eventLayer ?? 0)
                          ),
                          player: p,
                      }))
                    : [
                          {
                              id: p.id,
                              type: TrackType.Event,
                              events: p.track.events,
                              player: p,
                              isBlocked: false,
                              eventLayer: 0,
                          },
                      ];
                return {
                    id: p.id,
                    label: p.name,
                    type: TrackType.Event,
                    tracks,
                };
            }),
            {
                id: 'video',
                label: 'Video',
                type: TrackType.Video,
                tracks: (
                    trackOverrides['video'] ?? [
                        {
                            id: 'video-1',
                            type: TrackType.Video,
                            isBlocked: false,
                        },
                    ]
                ).map((t) => ({
                    ...t,
                    events: [],
                    clips: clipsByTrack[t.id] ?? [],
                })),
            },
            {
                id: 'audio',
                label: 'Audio',
                type: TrackType.Audio,
                tracks: (
                    trackOverrides['audio'] ?? [
                        {
                            id: 'audio-1',
                            type: TrackType.Audio,
                            isBlocked: false,
                        },
                    ]
                ).map((t) => ({
                    ...t,
                    events: [],
                    clips: clipsByTrack[t.id] ?? [],
                })),
            },
        ],
        [players, trackOverrides, clipsByTrack]
    );

    const trackGroupsRef = useRef(trackGroups);
    trackGroupsRef.current = trackGroups;

    const trackInfoByTrackId = useMemo(() => {
        const map = new Map<string, { groupId: string; eventLayer: number }>();
        for (const group of trackGroups) {
            for (const track of group.tracks) {
                map.set(track.id, {
                    groupId: group.id,
                    eventLayer: track.eventLayer ?? 0,
                });
            }
        }
        return map;
    }, [trackGroups]);

    const handleAddTrack = useCallback(
        (groupId: string, trackId: string, position: 'above' | 'below') => {
            const group = trackGroupsRef.current.find((g) => g.id === groupId);
            if (!group) return;
            const maxLayer = Math.max(
                ...group.tracks.map((t) => t.eventLayer ?? 0)
            );
            const newRow: TrackOverrideRow = {
                id: crypto.randomUUID(),
                type: group.type,
                isBlocked: false,
                eventLayer: maxLayer + 1,
            };
            const idx = group.tracks.findIndex((t) => t.id === trackId);
            if (idx === -1) return;
            const currentRows: TrackOverrideRow[] = group.tracks.map(toOverrideRow);
            currentRows.splice(position === 'above' ? idx + 1 : idx, 0, newRow);
            recordTrackOverride(groupId, currentRows);
        },
        [recordTrackOverride]
    );

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

    const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set());
    // A single selected VISUAL clip (video/image) drives the preview gizmo.
    const selectedVisualClip = useMemo(() => {
        if (selectedClipIds.size !== 1) return null;
        const [clipId] = selectedClipIds;
        for (const [trackId, clips] of Object.entries(clipsByTrack)) {
            const clip = clips.find((c) => c.id === clipId);
            if (clip && clip.type !== ClipType.Audio) return { trackId, clip };
        }
        return null;
    }, [selectedClipIds, clipsByTrack]);

    const handleCreate = useCallback(
        (
            trackId: string,
            partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>,
            onCreated?: (id: number) => void
        ) => {
            const resolved = trackInfoByTrackId.get(trackId);
            const playerId = resolved?.groupId ?? trackId;
            const event = handleCreateEventAutoLayer(partial, playerId);
            if (event) {
                setNewEventId(event.id);
                onCreated?.(event.id);
            }
        },
        [handleCreateEventAutoLayer, trackInfoByTrackId]
    );

    const handleDelete = useCallback(
        (items: DeleteItem[]) => {
            const byPlayer = new Map<string, number[]>();
            for (const { trackId, eventId } of items) {
                const groupId =
                    trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
                const arr = byPlayer.get(groupId) ?? [];
                arr.push(eventId);
                byPlayer.set(groupId, arr);
            }
            for (const [playerId, eventIds] of byPlayer) {
                handleDeleteEvents(playerId, eventIds);
            }
        },
        [handleDeleteEvents, trackInfoByTrackId]
    );

    const handleDeleteSelection = useCallback(
        (
            eventItems: DeleteItem[],
            clipItems: { trackId: string; clipId: string }[]
        ) => {
            const byPlayer = new Map<string, number[]>();
            for (const { trackId, eventId } of eventItems) {
                const groupId =
                    trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
                const arr = byPlayer.get(groupId) ?? [];
                arr.push(eventId);
                byPlayer.set(groupId, arr);
            }
            handleDeleteAll(
                Array.from(byPlayer, ([playerId, eventIds]) => ({
                    playerId,
                    eventIds,
                })),
                clipItems
            );
        },
        [handleDeleteAll, trackInfoByTrackId]
    );

    const handleRippleDeleteSelection = useCallback(
        (
            clipItems: { trackId: string; clipId: string }[],
            eventItems: DeleteItem[]
        ) => {
            const byPlayer = new Map<string, number[]>();
            for (const { trackId, eventId } of eventItems) {
                const groupId =
                    trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
                const arr = byPlayer.get(groupId) ?? [];
                arr.push(eventId);
                byPlayer.set(groupId, arr);
            }
            handleRippleDelete(
                clipItems,
                Array.from(byPlayer, ([playerId, eventIds]) => ({
                    playerId,
                    eventIds,
                }))
            );
        },
        [handleRippleDelete, trackInfoByTrackId]
    );

    const handleTrimCommit = useCallback(
        (commit: TrimCommit) => {
            handleTrimClip(
                commit.clipId,
                commit.edge,
                commit.desiredTime,
                commit.sourceDuration,
                commit.ripple
            );
        },
        [handleTrimClip]
    );

    const handleToggleLoop = useCallback(() => setLoop((v) => !v), []);

    const handleToggleGroupCollapse = useCallback((groupId: string) => {
        setCollapsedGroups((prev) =>
            prev.includes(groupId)
                ? prev.filter((id) => id !== groupId)
                : [...prev, groupId]
        );
    }, []);

    // Called once, on mouse-up. The drag itself previews via Timeline-local
    // state, so this is a single history entry rather than one per pixel.
    const handleSetTrackHeight = useCallback(
        (groupId: string, trackId: string, height: number) => {
            const group = trackGroupsRef.current.find((g) => g.id === groupId);
            if (!group) return;
            recordTrackOverride(
                groupId,
                group.tracks.map((t) => ({
                    ...toOverrideRow(t),
                    height: t.id === trackId ? height : t.height,
                }))
            );
        },
        [recordTrackOverride]
    );

    const handleSetGroupHeight = useCallback(
        (groupId: string, height: number) => {
            const group = trackGroupsRef.current.find((g) => g.id === groupId);
            if (!group) return;
            recordTrackOverride(
                groupId,
                group.tracks.map((t) => ({ ...toOverrideRow(t), height }))
            );
        },
        [recordTrackOverride]
    );

    const handleToggleSyncLock = useCallback(
        (groupId: string, trackId: string) => {
            const group = trackGroupsRef.current.find((g) => g.id === groupId);
            if (!group) return;
            recordTrackOverride(
                groupId,
                group.tracks.map((t) => ({
                    ...toOverrideRow(t),
                    // Undefined reads as locked, so the flip of "locked" is
                    // exactly "was it explicitly unlocked".
                    syncLock: t.id === trackId ? t.syncLock === false : t.syncLock,
                }))
            );
        },
        [recordTrackOverride]
    );

    const handleDuplicate = useCallback(
        (items: DuplicateItem[], onCreated: (newIds: number[]) => void) => {
            const byPlayer = new Map<string, TrackEvent[]>();
            for (const { trackId, eventId } of items) {
                const groupId =
                    trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
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
        },
        [handleDuplicateEvents, trackInfoByTrackId]
    );

    const handlePaste = useCallback(
        (
            items: PasteItem[],
            pasteTime: number,
            onCreated: (newIds: number[]) => void
        ) => {
            const byPlayer = new Map<string, TrackEvent[]>();
            for (const { trackId, event } of items) {
                const groupId =
                    trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
                const arr = byPlayer.get(groupId) ?? [];
                arr.push(event);
                byPlayer.set(groupId, arr);
            }
            const allNewIds: number[] = [];
            for (const [playerId, events] of byPlayer) {
                const newEvents = handlePasteEvents(
                    playerId,
                    events,
                    pasteTime
                );
                allNewIds.push(...newEvents.map((e) => e.id));
            }
            onCreated(allNewIds);
        },
        [handlePasteEvents, trackInfoByTrackId]
    );

    const handleTimelineUpdateEvent = useCallback(
        (
            trackId: string,
            eventId: number,
            time: number,
            eventDuration: number
        ) => {
            const groupId = trackInfoByTrackId.get(trackId)?.groupId ?? trackId;
            handleUpdateEvent(
                groupId,
                eventId,
                Math.max(0, Math.min(durationRef.current, time)),
                eventDuration
            );
        },
        [handleUpdateEvent, trackInfoByTrackId]
    );

    const sourcesRef = useRef(sources);
    sourcesRef.current = sources;

    const handleDropSource = useCallback(
        (trackId: string, sourceId: string, time: number) => {
            const source = sourcesRef.current.find((s) => s.id === sourceId);
            if (!source) return;

            const clipDuration =
                source.type === 'image' ? source.duration || DEFAULT_IMAGE_CLIP_DURATION : source.duration;
            const clipEnd = time + (clipDuration ?? 0);
            const clipsCollide = (clips: Clip[]) =>
                clips.some(
                    (c) => time < c.time + (c.duration ?? 0) && clipEnd > c.time
                );

            const resolveTrack = (
                group: TimelineTrackGroup,
                preferredTrackId: string
            ): { id: string; updatedRows?: TrackOverrideRow[] } => {
                if (!clipsCollide(clipsByTrackRef.current[preferredTrackId] ?? [])) {
                    return { id: preferredTrackId };
                }
                for (const t of group.tracks) {
                    if (t.id === preferredTrackId || t.isBlocked) continue;
                    if (!clipsCollide(clipsByTrackRef.current[t.id] ?? []))
                        return { id: t.id };
                }
                const maxLayer = Math.max(
                    0,
                    ...group.tracks.map((t) => t.eventLayer ?? 0)
                );
                const newRow: TrackOverrideRow = {
                    id: crypto.randomUUID(),
                    type: group.type,
                    isBlocked: false,
                    eventLayer: maxLayer + 1,
                };
                const updatedRows: TrackOverrideRow[] = [
                    ...group.tracks.map(toOverrideRow),
                    newRow,
                ];
                return { id: newRow.id, updatedRows };
            };

            const group = trackGroupsRef.current.find((g) =>
                g.tracks.some((t) => t.id === trackId)
            );
            if (!group) return;

            const clipType =
                source.type === 'video'
                    ? ClipType.Video
                    : source.type === 'image'
                      ? ClipType.Image
                      : ClipType.Audio;
            const isVisual = clipType === ClipType.Video || clipType === ClipType.Image;
            // A video source lands as a video + audio pair; the shared linkId is
            // what keeps trim, blade, move and delete from desyncing them.
            const linkId = source.type === 'video' ? crypto.randomUUID() : undefined;
            const clip: Clip = {
                id: crypto.randomUUID(),
                type: clipType,
                time,
                duration: clipDuration,
                sourceId,
                sourceOffset: 0,
                ...(linkId ? { linkId } : {}),
                ...(isVisual
                    ? { transform: defaultTransform(source, projectConfigRef.current.resolution) }
                    : {}),
            };

            const videoResolution = resolveTrack(group, trackId);
            const entries: Array<{ trackId: string; clip: Clip }> = [
                { trackId: videoResolution.id, clip },
            ];
            const overrides: Array<{
                groupId: string;
                rows: TrackOverrideRow[];
            }> = [];
            if (videoResolution.updatedRows)
                overrides.push({
                    groupId: group.id,
                    rows: videoResolution.updatedRows,
                });

            if (source.type === 'video') {
                const audioGroup = trackGroupsRef.current.find(
                    (g) => g.type === TrackType.Audio
                );
                const firstAudioTrack = audioGroup?.tracks.find(
                    (t) => !t.isBlocked
                );
                if (audioGroup && firstAudioTrack) {
                    const audioResolution = resolveTrack(
                        audioGroup,
                        firstAudioTrack.id
                    );
                    entries.push({
                        trackId: audioResolution.id,
                        clip: {
                            ...clip,
                            id: crypto.randomUUID(),
                            type: ClipType.Audio,
                            transform: undefined,
                        },
                    });
                    if (audioResolution.updatedRows)
                        overrides.push({
                            groupId: audioGroup.id,
                            rows: audioResolution.updatedRows,
                        });
                }
            }

            handleAddClipsWithOverride(entries, overrides);
        },
        [handleAddClipsWithOverride]
    );

    const videoClips = useMemo(
        () =>
            trackGroups
                .find((g) => g.type === TrackType.Video)
                ?.tracks.flatMap((t) =>
                    (t.clips ?? []).map((c) => ({ ...c, trackId: t.id }))
                ) ?? [],
        [trackGroups]
    );

    const audioClips = useMemo(
        () =>
            trackGroups
                .find((g) => g.type === TrackType.Audio)
                ?.tracks.flatMap((t) =>
                    (t.clips ?? []).map((c) => ({ ...c, trackId: t.id }))
                ) ?? [],
        [trackGroups]
    );

    const hiddenVideoTrackIds = useMemo(
        () =>
            new Set(
                trackGroups
                    .find((g) => g.type === TrackType.Video)
                    ?.tracks.filter((t) => t.isHidden)
                    .map((t) => t.id) ?? []
            ),
        [trackGroups]
    );

    // Refs so the preview click handler stays stable (no re-subscribe per render).
    const videoClipsRef = useRef(videoClips);
    videoClipsRef.current = videoClips;
    const hiddenVideoTrackIdsRef = useRef(hiddenVideoTrackIds);
    hiddenVideoTrackIdsRef.current = hiddenVideoTrackIds;

    // App -> Timeline selection request (preview-click selects a clip). The nonce
    // lets the same clipId re-fire; clipId null clears the selection.
    const clipSelectNonce = useRef(0);
    const [clipSelectionRequest, setClipSelectionRequest] = useState<{
        clipId: string | null;
        nonce: number;
    } | null>(null);

    // Click on the preview: pick the top-most visual clip whose rendered rect
    // contains the point (at the current time), else clear the selection.
    const handlePreviewCanvasClick = useCallback((x: number, y: number) => {
        const t = currentTimeRef.current;
        const res = projectConfigRef.current.resolution;
        const clips = videoClipsRef.current.filter((c) => c.time <= t && t < c.time + c.duration);
        for (let i = clips.length - 1; i >= 0; i--) {
            const clip = clips[i];
            if (clip.trackId && hiddenVideoTrackIdsRef.current.has(clip.trackId)) continue;
            const source = sourcesRef.current.find((s) => s.id === clip.sourceId);
            const rect = clipRectInProject(
                resolveTransform(clip, source, res),
                source,
                res,
                clip.crop ?? NO_CROP,
            );
            if (pointInRect(x, y, rect)) {
                setClipSelectionRequest({ clipId: clip.id, nonce: ++clipSelectNonce.current });
                return;
            }
        }
        setClipSelectionRequest({ clipId: null, nonce: ++clipSelectNonce.current });
    }, []);

    const mutedAudioTrackIds = useMemo(
        () =>
            new Set(
                trackGroups
                    .find((g) => g.type === TrackType.Audio)
                    ?.tracks.filter((t) => t.isMuted)
                    .map((t) => t.id) ?? []
            ),
        [trackGroups]
    );

    const handleToggleTrack = useCallback(
        (trackId: string, field: 'isHidden' | 'isMuted' | 'isBlocked') => {
            for (const group of trackGroupsRef.current) {
                const idx = group.tracks.findIndex((t) => t.id === trackId);
                if (idx === -1) continue;
                const rows: TrackOverrideRow[] = group.tracks.map(toOverrideRow);
                rows[idx] = { ...rows[idx], [field]: !rows[idx][field] };
                recordTrackOverride(group.id, rows);
                break;
            }
        },
        [recordTrackOverride]
    );

    // Content duration, not the timeline's scrollable extent (Timeline derives
    // that). Accumulated rather than Math.max(...spread) because a long project
    // can hold more events than the argument limit allows.
    const duration = useMemo(() => {
        let end = 0;
        for (const c of videoClips) end = Math.max(end, c.time + c.duration);
        for (const c of audioClips) end = Math.max(end, c.time + c.duration);
        for (const p of players) {
            for (const e of p.track.events) end = Math.max(end, e.time + (e.duration ?? 0));
        }
        return end;
    }, [videoClips, audioClips, players]);

    const durationRef = useRef(duration);
    durationRef.current = duration;

    const handleMove = useCallback(
        (
            moves: MoveResult[],
            newTracksInfo?: Map<
                string,
                {
                    groupId: string;
                    eventLayer: number;
                    targetLocalIndex: number;
                }
            >
        ) => {
            if (newTracksInfo && newTracksInfo.size > 0) {
                const newByGroup = new Map<
                    string,
                    Array<{
                        id: string;
                        eventLayer: number;
                        targetLocalIndex: number;
                    }>
                >();
                for (const [trackId, info] of newTracksInfo) {
                    const list = newByGroup.get(info.groupId) ?? [];
                    list.push({
                        id: trackId,
                        eventLayer: info.eventLayer,
                        targetLocalIndex: info.targetLocalIndex,
                    });
                    newByGroup.set(info.groupId, list);
                }
                for (const [groupId, newTracks] of newByGroup) {
                    const group = trackGroups.find((g) => g.id === groupId);
                    if (!group) continue;
                    const currentRows: TrackOverrideRow[] = group.tracks.map(
                        (t) => ({
                            id: t.id,
                            type: t.type,
                            isBlocked: t.isBlocked,
                            eventLayer: t.eventLayer,
                            isHidden: t.isHidden,
                            isMuted: t.isMuted,
                        })
                    );
                    const prepends = newTracks
                        .filter(({ targetLocalIndex }) => targetLocalIndex < 0)
                        .sort(
                            (a, b) => a.targetLocalIndex - b.targetLocalIndex
                        );
                    const appends = newTracks
                        .filter(
                            ({ targetLocalIndex }) =>
                                targetLocalIndex >= group.tracks.length
                        )
                        .sort(
                            (a, b) => a.targetLocalIndex - b.targetLocalIndex
                        );
                    for (let i = 0; i < prepends.length; i++) {
                        currentRows.splice(i, 0, {
                            id: prepends[i].id,
                            type: TrackType.Event,
                            isBlocked: false,
                            eventLayer: prepends[i].eventLayer,
                        });
                    }
                    for (const { id, eventLayer } of appends) {
                        currentRows.push({
                            id,
                            type: TrackType.Event,
                            isBlocked: false,
                            eventLayer,
                        });
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

            handleMoveEvents(
                moves.map((m) => {
                    const from = extendedInfo.get(m.fromTrackId);
                    const to = extendedInfo.get(m.toTrackId);
                    return {
                        fromPlayerId: from?.groupId ?? m.fromTrackId,
                        toPlayerId: to?.groupId ?? m.toTrackId,
                        eventId: m.eventId,
                        newTime: Math.max(
                            0,
                            Math.min(durationRef.current, m.newTime)
                        ),
                        newLayer: to?.eventLayer ?? 0,
                    };
                })
            );
        },
        [handleMoveEvents, trackGroups, trackInfoByTrackId, recordTrackOverride]
    );

    useEffect(() => {
        if (newEventId !== null && selectedEvents[0]?.id !== newEventId) {
            setNewEventId(null);
        }
    }, [selectedEvents, newEventId]);

    const handleInspectorUpdate = useCallback(
        (eventId: number, meta: EventMeta) => {
            const player = playersRef.current.find((p) =>
                p.track.events.some((e) => e.id === eventId)
            );
            if (!player) return;
            handleUpdateMeta(player.id, eventId, meta);
            setSelectedEvents((prev) =>
                prev.map((e) => (e.id === eventId ? { ...e, meta } : e))
            );
        },
        [handleUpdateMeta, setSelectedEvents]
    );

    return (
        <section className="h-screen flex flex-col">
            <AppBar
                mode={mode}
                isDirty={isDirty}
                onNew={handleFileNew}
                onExport={handleExport}
                onImport={handleImport}
                onExportVideo={handleOpenExportDialog}
                onOpenSettings={handleOpenSettings}
                onRelinkMedia={handleOpenRelinkMedia}
                onOpenLiveSettings={handleOpenLiveSettings}
            />
            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                config={projectConfig}
                onConfigChange={setProjectConfig}
                players={players}
                onUpdatePlayer={handleUpdatePlayer}
                initialSection={settingsSection}
                cardStatus={cardStatus}
                onForceRefreshCards={handleForceRefreshCards}
            />
            <LiveModeDialog
                open={liveSettingsOpen}
                onOpenChange={(open) => {
                    setLiveSettingsOpen(open);
                    // Pick up any duration change the dialog persisted so the
                    // controller's play timer uses the new value right away.
                    if (!open) {
                        setCardDisplayDuration(
                            loadLiveModeConfig()?.cardDisplayDuration ??
                                DEFAULT_CARD_DISPLAY_DURATION_MS
                        );
                        // Pull in any player identity edits the Players section
                        // persisted so LiveMode's own copy stays in sync.
                        liveModeRef.current?.syncPlayerInfoFromStorage();
                    }
                }}
                onStart={() => setLiveSettingsOpen(false)}
                initialSection={liveSettingsSection}
            />
            <ExportDialog
                open={exportDialogOpen}
                onClose={handleCloseExportDialog}
                videoClips={videoClips}
                audioClips={audioClips}
                sources={sources}
                players={players}
                config={projectConfig}
                hiddenVideoTrackIds={hiddenVideoTrackIds}
                inPoint={inPoint}
                outPoint={outPoint}
            />
            <RelinkDialog
                open={relinkDialogOpen}
                onOpenChange={setRelinkDialogOpen}
                projectId={projectId}
                sources={sources}
                clipsByTrack={clipsByTrack}
                onRelink={handleRelinkSource}
                onRelinkMany={handleRelinkMany}
                resolution={mediaResolution}
                onDelete={handleDeleteSource}
                onRelinkClips={handleRelinkClips}
                onDeleteOrphanedClips={handleDeleteOrphanedClips}
                deletedSourceNames={deletedSourceNames}
            />
            {mode === 'live' ? (
                <LiveMode
                    ref={liveModeRef}
                    cardDisplayDuration={cardDisplayDuration}
                    onOpenSettings={() => {
                        setLiveSettingsSection('card-display');
                        setLiveSettingsOpen(true);
                    }}
                    onEditPlayers={() => {
                        setLiveSettingsSection('players');
                        setLiveSettingsOpen(true);
                    }}
                />
            ) : mode === 'welcome' ? (
                <WelcomeScreen
                    onCreateNew={handleNew}
                    onOpenProject={handleImport}
                    onStartLiveMode={() => setMode('live')}
                />
            ) : !cardsReady ? (
                <TimelineCardsLoader
                    status={cardStatus}
                    progress={cardProgress}
                    onRetry={handleRetryCards}
                />
            ) : (
                <ResizablePanelGroup orientation="vertical" className="flex-1">
                    <ResizablePanel minSize={100} defaultSize="60%">
                        <ResizablePanelGroup orientation="horizontal">
                            <ResizablePanel minSize="250px" defaultSize="15%">
                                <Sources
                                    sources={sources}
                                    setSources={setSources}
                                    clipsByTrack={clipsByTrack}
                                    onOpenRelinkDialog={handleOpenRelinkMedia}
                                    onRelink={handleRelinkSource}
                                    onDelete={handleDeleteSource}
                                />
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel
                                minSize={100}
                                defaultSize="70%"
                                className="bg-surface"
                            >
                                <div className="relative w-full h-full">
                                    <VideoPreview
                                        ref={videoPreviewRef}
                                        isPlaying={isPlaying}
                                        currentTimeRef={currentTimeRef}
                                        setIsPlaying={setIsPlaying}
                                        playbackRate={playbackRate}
                                        setPlaybackRate={setPlaybackRate}
                                        players={players}
                                        overlayConfig={overlayConfig}
                                        duration={duration}
                                        videoClips={videoClips}
                                        audioClips={audioClips}
                                        sources={sources}
                                        resolution={projectConfig.resolution}
                                        hiddenVideoTrackIds={hiddenVideoTrackIds}
                                        mutedAudioTrackIds={mutedAudioTrackIds}
                                        volume={volume}
                                        onVolumeChange={setVolume}
                                        loop={loop}
                                        onToggleLoop={handleToggleLoop}
                                        inPoint={inPoint}
                                        outPoint={outPoint}
                                        onCanvasClick={handlePreviewCanvasClick}
                                    />
                                    {!isPlaying && selectedVisualClip && (
                                        <PreviewGizmo
                                            key={selectedVisualClip.clip.id}
                                            clip={selectedVisualClip.clip}
                                            trackId={selectedVisualClip.trackId}
                                            source={sources.find(
                                                (s) => s.id === selectedVisualClip.clip.sourceId
                                            )}
                                            resolution={projectConfig.resolution}
                                            previewRef={videoPreviewRef}
                                            onCommit={handleUpdateClipTransform}
                                        />
                                    )}
                                </div>
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel minSize="250px" defaultSize="15%">
                                <Inspector
                                    editObject={selectedEvents}
                                    onUpdate={handleInspectorUpdate}
                                    player={inspectorPlayer}
                                    annotationSlots={
                                        projectConfig.annotationSlots
                                    }
                                    onManageSlots={handleManageSlots}
                                    autoFocus={
                                        selectedEvents[0]?.id === newEventId
                                    }
                                />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel minSize="280px" defaultSize="40%">
                        <Timeline
                            duration={duration}
                            isPlaying={isPlaying}
                            setIsPlaying={setIsPlaying}
                            currentTimeRef={currentTimeRef}
                            onSeek={handleSeek}
                            trackGroups={trackGroups}
                            initialZoom={zoom}
                            onZoomChange={setZoom}
                            initialViewMode={viewMode}
                            onViewModeChange={setViewMode}
                            displayCardDuration={
                                projectConfig.cardDisplayDuration / 1000
                            }
                            onUndo={undo}
                            onRedo={redo}
                            canUndo={canUndo}
                            canRedo={canRedo}
                            onCreateEvent={handleCreate}
                            onDeleteEvents={handleDelete}
                            onDuplicateEvents={handleDuplicate}
                            onPasteEvents={handlePaste}
                            onUpdateEvent={handleTimelineUpdateEvent}
                            onMoveEvent={handleMove}
                            onResizeStart={handleBeginResize}
                            onResizeEnd={handleCommitResize}
                            onSelectionChange={handleSelectionChange}
                            onClipSelectionChange={setSelectedClipIds}
                            clipSelectionRequest={clipSelectionRequest}
                            onAddTrack={handleAddTrack}
                            onDeleteTrack={handleDeleteTrack}
                            sources={sources}
                            onDropSource={handleDropSource}
                            onMoveClips={handleMoveClips}
                            onDeleteClip={handleDeleteClip}
                            onDeleteClips={handleDeleteClips}
                            onDeleteSelection={handleDeleteSelection}
                            onUpdateTrack={handleToggleTrack}
                            markers={markers}
                            onAddMarker={handleAddMarker}
                            onUpdateMarker={handleUpdateMarker}
                            onDeleteMarker={handleDeleteMarker}
                            onTrimClip={handleTrimCommit}
                            onSplitClips={handleSplitClips}
                            onRippleDelete={handleRippleDeleteSelection}
                            onCloseGaps={handleCloseGaps}
                            onClipGainChange={handleUpdateClipGain}
                            onUnlinkClip={handleUnlinkClip}
                            onToggleSyncLock={handleToggleSyncLock}
                            snapEnabled={snapEnabled}
                            onToggleSnap={() => setSnapEnabled((v) => !v)}
                            followPlayhead={followPlayhead}
                            onToggleFollow={() => setFollowPlayhead((v) => !v)}
                            inPoint={inPoint}
                            outPoint={outPoint}
                            onSetInPoint={setInPoint}
                            onSetOutPoint={setOutPoint}
                            onToggleLoop={handleToggleLoop}
                            collapsedGroups={collapsedGroups}
                            onToggleGroupCollapse={handleToggleGroupCollapse}
                            onSetTrackHeight={handleSetTrackHeight}
                            onSetGroupHeight={handleSetGroupHeight}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            )}
        </section>
    );
}

export default App;
