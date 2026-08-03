import { useCallback, useEffect, useRef } from 'react';
import type { Player, Decklist } from '../../../types/player';
import type { TrackEvent, EventMeta } from '../../../types/event';
import type { TrackType } from '../types';
import type { Clip, ClipTransform, ClipCrop } from '../../../types/clip';
import type { Marker, MarkerColor } from '../../../types/marker';
import { DEFAULT_MARKER_COLOR } from '../../../types/marker';
import type { ClipMoveResult } from './hookTypes';
import type { TimeRange, TrimEdge } from '../editOps';
import { mapTimeAfterRipple, mergeRanges, splitGeometry, trimClip } from '../editOps';
import { useHistory } from '@/hooks/useHistory';

type PlayerInit = Omit<Player, 'track'>;

export type TrackOverrideRow = {
    id: string;
    type: TrackType;
    eventLayer?: number;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
    /** Whether ripple edits shift this row. Undefined = locked (the default). */
    syncLock?: boolean;
};

type TracksState = {
    players: Player[];
    trackOverrides: Record<string, TrackOverrideRow[]>;
    clipsByTrack: Record<string, Clip[]>;
    markers: Marker[];
};

const COLLISION_THRESHOLD = 2.0;

/** Rows explicitly opted out of ripple. Everything else rides along. */
function unlockedRowIds(state: TracksState): Set<string> {
    const out = new Set<string>();
    for (const rows of Object.values(state.trackOverrides)) {
        for (const r of rows) if (r.syncLock === false) out.add(r.id);
    }
    return out;
}

function isEventLayerLocked(state: TracksState, playerId: string, layer: number): boolean {
    const rows = state.trackOverrides[playerId];
    if (!rows) return true;
    const row = rows.find((r) => (r.eventLayer ?? 0) === layer);
    return row ? row.syncLock !== false : true;
}

/**
 * Close the given output-time ranges: every clip and event that starts after a
 * range slides left by the total length of the ranges before it.
 *
 * Events shift too. Overlay timing is authored against the video, so a ripple
 * that moved only clips would silently desync every event downstream of the cut.
 */
function applyRipple(draft: TracksState, ranges: TimeRange[]): void {
    const merged = mergeRanges(ranges);
    if (merged.length === 0) return;
    const unlocked = unlockedRowIds(draft);

    for (const trackId of Object.keys(draft.clipsByTrack)) {
        if (unlocked.has(trackId)) continue;
        for (const clip of draft.clipsByTrack[trackId]) {
            clip.time = mapTimeAfterRipple(clip.time, merged);
        }
    }
    for (const player of draft.players) {
        for (const ev of player.track.events) {
            if (!isEventLayerLocked(draft, player.id, ev.layer)) continue;
            ev.time = mapTimeAfterRipple(ev.time, merged);
        }
    }
    for (const marker of draft.markers) {
        marker.time = mapTimeAfterRipple(marker.time, merged);
    }
}

/** Shift everything at or after `from` by `delta`, honouring sync lock. */
function applyShiftFrom(draft: TracksState, from: number, delta: number): void {
    if (delta === 0) return;
    const unlocked = unlockedRowIds(draft);
    for (const trackId of Object.keys(draft.clipsByTrack)) {
        if (unlocked.has(trackId)) continue;
        for (const clip of draft.clipsByTrack[trackId]) {
            if (clip.time >= from - 1e-9) clip.time = Math.max(0, clip.time + delta);
        }
    }
    for (const player of draft.players) {
        for (const ev of player.track.events) {
            if (!isEventLayerLocked(draft, player.id, ev.layer)) continue;
            if (ev.time >= from - 1e-9) ev.time = Math.max(0, ev.time + delta);
        }
    }
    for (const marker of draft.markers) {
        if (marker.time >= from - 1e-9) marker.time = Math.max(0, marker.time + delta);
    }
}

function findClipEntry(
    state: TracksState,
    clipId: string,
): { trackId: string; clip: Clip } | null {
    for (const [trackId, clips] of Object.entries(state.clipsByTrack)) {
        const clip = clips.find((c) => c.id === clipId);
        if (clip) return { trackId, clip };
    }
    return null;
}

/** A clip plus every clip sharing its linkId (the A/V halves of one source). */
function withLinked(state: TracksState, clipId: string): Array<{ trackId: string; clip: Clip }> {
    const entry = findClipEntry(state, clipId);
    if (!entry) return [];
    if (!entry.clip.linkId) return [entry];
    const out: Array<{ trackId: string; clip: Clip }> = [];
    for (const [trackId, clips] of Object.entries(state.clipsByTrack)) {
        for (const clip of clips) {
            if (clip.linkId === entry.clip.linkId) out.push({ trackId, clip });
        }
    }
    return out;
}

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
    savedPlayers?: Player[],
    savedClipsByTrack?: Record<string, Clip[]>,
    savedTrackOverrides?: Record<string, TrackOverrideRow[]>,
    savedMarkers?: Marker[],
) {
    const initialState: TracksState = {
        players: savedPlayers ??
            initialPlayers.map((p) => ({
                ...p,
                track: { id: p.id, layers: 4, events: [] },
            })),
        trackOverrides: savedTrackOverrides ?? {},
        clipsByTrack: savedClipsByTrack ?? {},
        markers: savedMarkers ?? [],
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
    const markers = state.markers;
    const stateRef = useRef(state);
    useEffect(() => { stateRef.current = state; });

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
                event.layer = newLayer;
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
        updates: { name?: string; deckName?: string; decklist?: Decklist; pronouns?: string; standing?: string }
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

    const handleAddClipsWithOverride = useCallback((
        entries: Array<{ trackId: string; clip: Clip }>,
        overrides: Array<{ groupId: string; rows: TrackOverrideRow[] }>,
    ) => {
        record((draft) => {
            for (const { groupId, rows } of overrides) {
                draft.trackOverrides[groupId] = rows;
            }
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

    const handleUpdateClipTransform = useCallback(
        (trackId: string, clipId: string, transform: ClipTransform, crop?: ClipCrop) => {
            record((draft) => {
                const clip = (draft.clipsByTrack[trackId] ?? []).find((c) => c.id === clipId);
                if (!clip) return;
                clip.transform = transform;
                if (crop) clip.crop = crop;
            });
        },
        [record],
    );

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

    /**
     * Commit a trim drag. `ripple` slides everything downstream by the change in
     * the clip's end, closing (or opening) the gap the trim would leave.
     */
    const handleTrimClip = useCallback((
        clipId: string,
        edge: TrimEdge,
        desiredTime: number,
        sourceDuration: number,
        ripple = false,
    ) => {
        const targets = withLinked(stateRef.current, clipId);
        const primary = targets.find((t) => t.clip.id === clipId);
        if (!primary) return;
        const neighbours = stateRef.current.clipsByTrack[primary.trackId] ?? [];
        const next = trimClip(primary.clip, edge, desiredTime, sourceDuration, neighbours);
        const dTime = next.time - primary.clip.time;
        const dDuration = next.duration - primary.clip.duration;
        const dOffset = next.sourceOffset - primary.clip.sourceOffset;
        if (dTime === 0 && dDuration === 0) return;
        const oldEnd = primary.clip.time + primary.clip.duration;

        record((draft) => {
            for (const { trackId, clip } of targets) {
                const target = (draft.clipsByTrack[trackId] ?? []).find((c) => c.id === clip.id);
                if (!target) continue;
                target.time = Math.max(0, target.time + dTime);
                target.duration = Math.max(0, target.duration + dDuration);
                target.sourceOffset = Math.max(0, target.sourceOffset + dOffset);
            }
            if (!ripple) return;
            // Head trims move the clip's start, so the run of downstream material
            // begins at the old end either way.
            const delta = edge === 'end' ? dDuration : -dTime;
            applyShiftFrom(draft, oldEnd, delta);
        });
    }, [record]);

    /** Blade every given clip at `t`, splitting linked partners with it. */
    const handleSplitClips = useCallback((clipIds: string[], t: number) => {
        const ids = new Set<string>();
        for (const id of clipIds) {
            for (const { clip } of withLinked(stateRef.current, id)) ids.add(clip.id);
        }
        if (ids.size === 0) return [];

        // Both halves of a linked pair get the SAME new linkId, so the right
        // halves stay linked to each other rather than to what they were cut from.
        const rightLinkSuffix = `:${t.toFixed(4)}`;
        const additions: Array<{ trackId: string; clip: Clip; leftId: string; leftDuration: number }> = [];
        for (const [trackId, clips] of Object.entries(stateRef.current.clipsByTrack)) {
            for (const clip of clips) {
                if (!ids.has(clip.id)) continue;
                const geo = splitGeometry(clip, t);
                if (!geo) continue;
                additions.push({
                    trackId,
                    leftId: clip.id,
                    leftDuration: geo.left.duration,
                    clip: {
                        ...clip,
                        id: crypto.randomUUID(),
                        time: geo.right.time,
                        duration: geo.right.duration,
                        sourceOffset: geo.right.sourceOffset,
                        linkId: clip.linkId ? clip.linkId + rightLinkSuffix : undefined,
                    },
                });
            }
        }
        if (additions.length === 0) return [];

        record((draft) => {
            for (const { trackId, clip, leftId, leftDuration } of additions) {
                const left = (draft.clipsByTrack[trackId] ?? []).find((c) => c.id === leftId);
                if (left) left.duration = leftDuration;
                draft.clipsByTrack[trackId] = [...(draft.clipsByTrack[trackId] ?? []), clip];
            }
        });
        return additions.map((a) => a.clip.id);
    }, [record]);

    /** Delete and close the gap. Events and markers ride the shift. */
    const handleRippleDelete = useCallback((
        clipItems: { trackId: string; clipId: string }[],
        eventDeletions: { playerId: string; eventIds: number[] }[],
    ) => {
        const ranges: TimeRange[] = [];
        for (const { trackId, clipId } of clipItems) {
            const clip = (stateRef.current.clipsByTrack[trackId] ?? []).find((c) => c.id === clipId);
            if (clip) ranges.push({ start: clip.time, end: clip.time + clip.duration });
        }
        const deletedIds = new Set(clipItems.map((i) => i.clipId));
        record((draft) => {
            for (const { playerId, eventIds } of eventDeletions) {
                const player = draft.players.find((p) => p.id === playerId);
                if (!player) continue;
                const idSet = new Set(eventIds);
                player.track.events = player.track.events.filter((e) => !idSet.has(e.id));
            }
            for (const { trackId } of clipItems) {
                draft.clipsByTrack[trackId] = (draft.clipsByTrack[trackId] ?? []).filter(
                    (c) => !deletedIds.has(c.id),
                );
            }
            applyRipple(draft, ranges);
        });
    }, [record]);

    const handleCloseGaps = useCallback((ranges: TimeRange[]) => {
        if (ranges.length === 0) return;
        record((draft) => applyRipple(draft, ranges));
    }, [record]);

    const handleUpdateClipGain = useCallback((trackId: string, clipId: string, gain: number) => {
        record((draft) => {
            const clip = (draft.clipsByTrack[trackId] ?? []).find((c) => c.id === clipId);
            if (clip) clip.gain = gain;
        });
    }, [record]);

    const handleUnlinkClip = useCallback((clipId: string) => {
        const targets = withLinked(stateRef.current, clipId);
        if (targets.length < 2) return;
        record((draft) => {
            for (const { trackId, clip } of targets) {
                const target = (draft.clipsByTrack[trackId] ?? []).find((c) => c.id === clip.id);
                if (target) delete target.linkId;
            }
        });
    }, [record]);

    const handleAddMarker = useCallback((time: number, color: MarkerColor = DEFAULT_MARKER_COLOR) => {
        const marker: Marker = { id: crypto.randomUUID(), time, color };
        record((draft) => { draft.markers.push(marker); });
        return marker;
    }, [record]);

    const handleUpdateMarker = useCallback((id: string, updates: Partial<Omit<Marker, 'id'>>) => {
        const recipe = (draft: TracksState) => {
            const marker = draft.markers.find((m) => m.id === id);
            if (marker) Object.assign(marker, updates);
        };
        // Renaming is keystroke-by-keystroke; coalesce it into one history entry
        // the same way event meta edits do, or a name costs 20 undos.
        const key = `marker-${id}`;
        const now = Date.now();
        if (lastMetaRef.current?.key === key && now - lastMetaRef.current.timestamp < 1000) {
            mutate(recipe);
        } else {
            record(recipe);
        }
        lastMetaRef.current = { key, timestamp: now };
    }, [record, mutate]);

    const handleDeleteMarker = useCallback((id: string) => {
        record((draft) => { draft.markers = draft.markers.filter((m) => m.id !== id); });
    }, [record]);

    const relinkClips = useCallback((oldSourceId: string, newSourceId: string) => {
        record((draft) => {
            for (const trackId of Object.keys(draft.clipsByTrack)) {
                draft.clipsByTrack[trackId] = (draft.clipsByTrack[trackId] ?? []).map((c) =>
                    c.sourceId === oldSourceId ? { ...c, sourceId: newSourceId } : c,
                );
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

    const resetPlayers = useCallback((
        incoming: Player[],
        clipsByTrack: Record<string, Clip[]> = {},
        trackOverrides: Record<string, TrackOverrideRow[]> = {},
        markers: Marker[] = [],
    ) => {
        setState({ players: incoming, trackOverrides, clipsByTrack, markers });
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

    const handleCreateEventAutoLayer = useCallback((
        partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>,
        playerId?: string,
    ): TrackEvent | undefined => {
        const targetId = playerId ?? playersRef.current[0]?.id;
        if (!targetId) return undefined;
        const player = playersRef.current.find((p) => p.id === targetId);
        if (!player) return undefined;
        const time = currentTimeRef.current;
        const resizable = partial.resizable ?? false;
        const duration = partial.duration ?? 1;
        const layer = findAvailableLayer(player.track.events, time, duration, resizable);
        const { layer: _ignored, ...rest } = partial as any;
        const newEvent: TrackEvent = {
            id: nextEventId.current++,
            time,
            layer,
            duration,
            resizable,
            ...rest,
        };
        record((draft) => {
            const p = draft.players.find((p) => p.id === targetId);
            if (p) p.track.events.push(newEvent as any);
            const existingRows = draft.trackOverrides[targetId];
            const maxLayer = existingRows
                ? Math.max(0, ...existingRows.map((r) => r.eventLayer ?? 0))
                : 0;
            if (layer > maxLayer) {
                const rows: TrackOverrideRow[] = existingRows
                    ?? [{ id: targetId, type: 'EVENT' as TrackType, isBlocked: false, eventLayer: 0 }];
                draft.trackOverrides[targetId] = [
                    ...rows,
                    { id: crypto.randomUUID(), type: 'EVENT' as TrackType, isBlocked: false, eventLayer: layer },
                ];
            }
        });
        setSelectedEvents([newEvent]);
        return newEvent;
    }, [record, setSelectedEvents]);

    return {
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
        handleCreateEvent,
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
        handleAddClips,
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
    };
}
