import { useCallback, useRef } from 'react';
import type { Player, Decklist } from '../../types/player';
import type { TrackEvent, EventMeta } from '../../types/event';
import type { TrackType } from '../../types/nle';
import type { Clip } from '../../types/clip';
import type { ClipMoveResult } from '../../nle/hooks/nleHookTypes';
import { useHistory } from '@/hooks/useHistory';

type PlayerInit = Omit<Player, 'track'>;

export type TrackOverrideRow = {
    id: string;
    type: TrackType;
    eventLayer?: number;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
};

type TracksState = {
    players: Player[];
    trackOverrides: Record<string, TrackOverrideRow[]>;
    clipsByTrack: Record<string, Clip[]>;
};

const COLLISION_THRESHOLD = 1.0;

function findAvailableLayer(
    events: TrackEvent[],
    time: number,
    duration: number,
    resizable: boolean,
): number {
    for (let layer = 0; ; layer++) {
        const collides = events.some((e) => {
            if (e.layer !== layer) return false;
            if (resizable || e.resizable) {
                const newEnd = time + duration;
                const eEnd = e.time + (e.duration ?? 1);
                return time < eEnd && newEnd > e.time;
            }
            return Math.abs(e.time - time) < COLLISION_THRESHOLD;
        });
        if (!collides) return layer;
    }
}

export function usePlayerTracks(
    initialPlayers: PlayerInit[],
    currentTimeRef: React.RefObject<number>,
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>,
    savedPlayers?: Player[]
) {
    const initialState: TracksState = {
        players: savedPlayers ??
            initialPlayers.map((p) => ({
                ...p,
                track: { id: p.id, layers: 4, events: [] },
            })),
        trackOverrides: {},
        clipsByTrack: {},
    };

    const {
        state,
        setState,
        record,
        mutate,
        recordFromBaseline,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
    } = useHistory<TracksState>(initialState);

    const players = state.players;
    const trackOverrides = state.trackOverrides;
    const clipsByTrack = state.clipsByTrack;

    const nextEventId = useRef(
        savedPlayers
            ? Math.max(0, ...savedPlayers.flatMap((p) => p.track.events.map((e) => e.id))) + 1
            : 1
    );
    const playersRef = useRef(players);
    playersRef.current = players;

    const resizeBaselineRef = useRef<TracksState | null>(null);
    const lastMetaRef = useRef<{ key: string; timestamp: number } | null>(null);

    const handleCreateEvent = useCallback((
        partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>,
        playerId?: string
    ) => {
        const targetId = playerId ?? playersRef.current[0]?.id;
        if (!targetId) return;
        const player = playersRef.current.find((p) => p.id === targetId);
        const time = currentTimeRef.current;
        const resizable = partial.resizable ?? false;
        const duration = partial.duration ?? 1;
        const layer = player
            ? findAvailableLayer(player.track.events, time, duration, resizable)
            : 0;
        const newEvent: TrackEvent = {
            id: nextEventId.current++,
            time,
            layer,
            duration,
            resizable,
            ...partial,
        };
        record((draft) => {
            const player = draft.players.find((p) => p.id === targetId);
            if (player) player.track.events.push(newEvent as any);
        });
        setSelectedEvents([newEvent]);
        return newEvent;
    }, [record, setSelectedEvents]);

    const handleDeleteEvents = useCallback((playerId: string, eventIds: number[]) => {
        const idSet = new Set(eventIds);
        record((draft) => {
            const player = draft.players.find((p) => p.id === playerId);
            if (player) player.track.events = player.track.events.filter((e) => !idSet.has(e.id));
        });
    }, [record]);

    const handleDuplicateEvents = useCallback((playerId: string, events: TrackEvent[]) => {
        const newEvents = events.map((e) => ({
            ...e,
            id: nextEventId.current++,
            time: e.time + 0.5,
        }));
        record((draft) => {
            const player = draft.players.find((p) => p.id === playerId);
            if (player) player.track.events.push(...(newEvents as any[]));
        });
        setSelectedEvents(newEvents);
        return newEvents as TrackEvent[];
    }, [record, setSelectedEvents]);

    const handlePasteEvents = useCallback((playerId: string, events: TrackEvent[], pasteTime: number) => {
        const minTime = Math.min(...events.map((e) => e.time));
        const newEvents = events.map((e) => ({
            ...e,
            id: nextEventId.current++,
            time: pasteTime + (e.time - minTime),
        }));
        record((draft) => {
            const player = draft.players.find((p) => p.id === playerId);
            if (player) player.track.events.push(...(newEvents as any[]));
        });
        setSelectedEvents(newEvents);
        return newEvents as TrackEvent[];
    }, [record, setSelectedEvents]);

    // Called on every mousemove during resize — no history entry, committed by handleCommitResize.
    const handleUpdateEvent = useCallback((
        playerId: string,
        eventId: number,
        time: number,
        duration: number
    ) => {
        mutate((draft) => {
            const player = draft.players.find((p) => p.id === playerId);
            const event = player?.track.events.find((e) => e.id === eventId);
            if (event) { event.time = time; event.duration = duration; }
        });
    }, [mutate]);

    const handleBeginResize = useCallback(() => {
        resizeBaselineRef.current = state;
    }, [state]);

    const handleCommitResize = useCallback(() => {
        const baseline = resizeBaselineRef.current;
        resizeBaselineRef.current = null;
        if (baseline) recordFromBaseline(baseline);
    }, [recordFromBaseline]);

    const handleMoveEvents = useCallback((
        moves: Array<{ fromPlayerId: string; toPlayerId: string; eventId: number; newTime: number; newLayer: number }>
    ) => {
        record((draft) => {
            for (const { fromPlayerId, toPlayerId, eventId, newTime, newLayer } of moves) {
                const fromPlayer = draft.players.find((p) => p.id === fromPlayerId);
                const toPlayer = draft.players.find((p) => p.id === toPlayerId);
                if (!fromPlayer || !toPlayer) continue;
                const idx = fromPlayer.track.events.findIndex((e) => e.id === eventId);
                if (idx === -1) continue;
                const [event] = fromPlayer.track.events.splice(idx, 1);
                event.time = newTime;
                event.layer = Math.max(0, newLayer);
                toPlayer.track.events.push(event);
            }
        });
    }, [record]);

    const handleUpdateMeta = useCallback((
        playerId: string,
        eventId: number,
        meta: EventMeta
    ) => {
        const coalesceKey = `${playerId}-${eventId}`;
        const now = Date.now();
        const shouldCoalesce =
            lastMetaRef.current?.key === coalesceKey &&
            now - lastMetaRef.current.timestamp < 1000;

        const recipe = (draft: TracksState) => {
            const player = draft.players.find((p: Player) => p.id === playerId);
            const event = player?.track.events.find((e: TrackEvent) => e.id === eventId);
            if (event) event.meta = meta;
        };

        if (shouldCoalesce) {
            mutate(recipe);
        } else {
            record(recipe);
            lastMetaRef.current = { key: coalesceKey, timestamp: now };
        }
    }, [record, mutate]);

    const handleUpdatePlayer = useCallback((
        playerId: string,
        updates: { name?: string; deckName?: string; decklist?: Decklist }
    ) => {
        record((draft) => {
            const player = draft.players.find((p) => p.id === playerId);
            if (player) Object.assign(player, updates);
        });
    }, [record]);

    const handleAddClips = useCallback((entries: Array<{ trackId: string; clip: Clip }>) => {
        record((draft) => {
            for (const { trackId, clip } of entries) {
                draft.clipsByTrack[trackId] = [...(draft.clipsByTrack[trackId] ?? []), clip];
            }
        });
    }, [record]);

    const handleMoveClips = useCallback((moves: ClipMoveResult[]) => {
        record((draft) => {
            for (const { clipId, fromTrackId, toTrackId, newTime } of moves) {
                const clip = (draft.clipsByTrack[fromTrackId] ?? []).find((c) => c.id === clipId);
                if (!clip) continue;
                draft.clipsByTrack[fromTrackId] = (draft.clipsByTrack[fromTrackId] ?? []).filter((c) => c.id !== clipId);
                clip.time = newTime;
                draft.clipsByTrack[toTrackId] = [...(draft.clipsByTrack[toTrackId] ?? []), clip];
            }
        });
    }, [record]);

    const handleDeleteClip = useCallback((trackId: string, clipId: string) => {
        record((draft) => {
            draft.clipsByTrack[trackId] = (draft.clipsByTrack[trackId] ?? []).filter((c) => c.id !== clipId);
        });
    }, [record]);

    const handleDeleteClips = useCallback((items: { trackId: string; clipId: string }[]) => {
        record((draft) => {
            for (const { trackId, clipId } of items) {
                draft.clipsByTrack[trackId] = (draft.clipsByTrack[trackId] ?? []).filter((c) => c.id !== clipId);
            }
        });
    }, [record]);

    const handleDeleteAll = useCallback((
        playerEventDeletions: { playerId: string; eventIds: number[] }[],
        clipDeletions: { trackId: string; clipId: string }[],
    ) => {
        record((draft) => {
            for (const { playerId, eventIds } of playerEventDeletions) {
                const player = draft.players.find((p) => p.id === playerId);
                if (!player) continue;
                const idSet = new Set(eventIds);
                player.track.events = player.track.events.filter((e) => !idSet.has(e.id));
            }
            for (const { trackId, clipId } of clipDeletions) {
                draft.clipsByTrack[trackId] = (draft.clipsByTrack[trackId] ?? []).filter((c) => c.id !== clipId);
            }
        });
    }, [record]);

    const resetPlayers = useCallback((incoming: Player[]) => {
        setState({ players: incoming, trackOverrides: {}, clipsByTrack: {} });
        clearHistory();
        const maxId = Math.max(
            0,
            ...incoming.flatMap((p) => p.track.events.map((e) => e.id))
        );
        nextEventId.current = maxId + 1;
    }, [setState, clearHistory]);

    const recordTrackOverride = useCallback((groupId: string, rows: TrackOverrideRow[]) => {
        record((draft) => {
            draft.trackOverrides[groupId] = rows;
        });
    }, [record]);

    const handleDeleteTrack = useCallback((groupId: string, trackId: string) => {
        record((draft) => {
            const rows = draft.trackOverrides[groupId];
            if (!rows || rows.length <= 1) return;
            const deleted = rows.find((r) => r.id === trackId);
            draft.trackOverrides[groupId] = rows.filter((r) => r.id !== trackId);
            if (deleted?.eventLayer !== undefined) {
                const player = draft.players.find((p) => p.id === groupId);
                if (player) {
                    player.track.events = player.track.events.filter(
                        (e) => e.layer !== deleted.eventLayer
                    );
                }
            }
        });
    }, [record]);

    return {
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
        handleUpdatePlayer,
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
    };
}
