import { useRef, useState } from 'react';
import type { Player, Decklist } from '../../types/player';
import type { TrackEvent, EventMeta } from '../../types/event';

type PlayerInit = Omit<Player, 'track'>;

export function usePlayerTracks(
    initialPlayers: PlayerInit[],
    currentTime: number,
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>,
    savedPlayers?: Player[]
) {
    const [players, setPlayers] = useState<Player[]>(() =>
        savedPlayers ??
        initialPlayers.map((p) => ({
            ...p,
            track: { id: p.id, layers: 4, events: [] },
        }))
    );
    const nextEventId = useRef(
        savedPlayers
            ? Math.max(0, ...savedPlayers.flatMap((p) => p.track.events.map((e) => e.id))) + 1
            : 1
    );

    const handleCreateEvent = (
        partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>,
        playerId?: string
    ) => {
        const targetId = playerId ?? players[0]?.id;
        if (!targetId) return;
        const newEvent: TrackEvent = {
            id: nextEventId.current++,
            time: currentTime,
            layer: 0,
            duration: 1,
            resizable: false,
            ...partial,
        };
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === targetId
                    ? { ...p, track: { ...p.track, events: [...p.track.events, newEvent] } }
                    : p
            )
        );
        setSelectedEvents([newEvent]);
    };

    const handleDeleteEvents = (playerId: string, eventIds: number[]) => {
        const idSet = new Set(eventIds);
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === playerId
                    ? { ...p, track: { ...p.track, events: p.track.events.filter((e) => !idSet.has(e.id)) } }
                    : p
            )
        );
    };

    const handleDuplicateEvents = (playerId: string, events: TrackEvent[]) => {
        const newEvents = events.map((e) => ({
            ...e,
            id: nextEventId.current++,
            time: e.time + 0.5,
        }));
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === playerId
                    ? { ...p, track: { ...p.track, events: [...p.track.events, ...newEvents] } }
                    : p
            )
        );
        setSelectedEvents(newEvents);
    };

    const handlePasteEvents = (playerId: string, events: TrackEvent[], pasteTime: number) => {
        const minTime = Math.min(...events.map((e) => e.time));
        const newEvents = events.map((e) => ({
            ...e,
            id: nextEventId.current++,
            time: pasteTime + (e.time - minTime),
        }));
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === playerId
                    ? { ...p, track: { ...p.track, events: [...p.track.events, ...newEvents] } }
                    : p
            )
        );
        setSelectedEvents(newEvents);
    };

    const handleUpdateEvent = (
        playerId: string,
        eventId: number,
        time: number,
        duration: number
    ) => {
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === playerId
                    ? {
                          ...p,
                          track: {
                              ...p.track,
                              events: p.track.events.map((e) =>
                                  e.id === eventId ? { ...e, time, duration } : e
                              ),
                          },
                      }
                    : p
            )
        );
    };

    const handleMoveEvents = (
        moves: Array<{ playerId: string; eventId: number; newTime: number; newLayer: number }>
    ) => {
        setPlayers((prev) => {
            let next = prev;
            for (const { playerId, eventId, newTime, newLayer } of moves) {
                next = next.map((p) => {
                    if (p.id !== playerId) return p;
                    const clampedLayer = Math.max(0, Math.min(p.track.layers - 1, newLayer));
                    return {
                        ...p,
                        track: {
                            ...p.track,
                            events: p.track.events.map((e) =>
                                e.id === eventId ? { ...e, time: newTime, layer: clampedLayer } : e
                            ),
                        },
                    };
                });
            }
            return next;
        });
    };

    const handleUpdateMeta = (
        playerId: string,
        eventId: number,
        meta: EventMeta
    ) => {
        setPlayers((prev) =>
            prev.map((p) =>
                p.id !== playerId
                    ? p
                    : {
                          ...p,
                          track: {
                              ...p.track,
                              events: p.track.events.map((e) =>
                                  e.id !== eventId ? e : { ...e, meta }
                              ),
                          },
                      }
            )
        );
    };

    const handleUpdatePlayer = (
        playerId: string,
        updates: { name?: string; deckName?: string; decklist?: Decklist }
    ) => {
        setPlayers((prev) =>
            prev.map((p) => (p.id !== playerId ? p : { ...p, ...updates }))
        );
    };

    const resetPlayers = (incoming: Player[]) => {
        setPlayers(incoming);
        const maxId = Math.max(
            0,
            ...incoming.flatMap((p) => p.track.events.map((e) => e.id))
        );
        nextEventId.current = maxId + 1;
    };

    return {
        players,
        handleCreateEvent,
        handleDeleteEvents,
        handleDuplicateEvents,
        handlePasteEvents,
        handleUpdateEvent,
        handleMoveEvents,
        handleUpdateMeta,
        handleUpdatePlayer,
        resetPlayers,
    };
}
