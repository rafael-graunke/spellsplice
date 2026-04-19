import { useRef, useState } from 'react';
import type { Player } from '../../types/player';
import { EventColorMap, type TrackEvent } from '../../types/event';

type PlayerInit = Omit<Player, 'track'>;

export function usePlayerTracks(
    initialPlayers: PlayerInit[],
    currentTime: number,
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>
) {
    const [players, setPlayers] = useState<Player[]>(() =>
        initialPlayers.map((p) => ({
            ...p,
            track: { id: p.id, layers: 4, events: [] },
        }))
    );
    const nextEventId = useRef(1);

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
            color: EventColorMap[partial.type].bg,
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

    const handleDeleteEvent = (playerId: string, eventId: number) => {
        setPlayers((prev) =>
            prev.map((p) =>
                p.id === playerId
                    ? {
                          ...p,
                          track: {
                              ...p.track,
                              events: p.track.events.filter((e) => e.id !== eventId),
                          },
                      }
                    : p
            )
        );
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

    const handleMoveEvent = (
        playerId: string,
        eventId: number,
        newTime: number,
        newLayer: number
    ) => {
        setPlayers((prev) =>
            prev.map((p) => {
                if (p.id !== playerId) return p;
                const clampedLayer = Math.max(0, Math.min(p.track.layers - 1, newLayer));
                return {
                    ...p,
                    track: {
                        ...p.track,
                        events: p.track.events.map((e) =>
                            e.id === eventId
                                ? { ...e, time: newTime, layer: clampedLayer }
                                : e
                        ),
                    },
                };
            })
        );
    };

    const handleMoveMultipleEvents = (
        moves: Array<{
            playerId: string;
            eventId: number;
            newTime: number;
            newLayer: number;
        }>
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
                                e.id === eventId
                                    ? { ...e, time: newTime, layer: clampedLayer }
                                    : e
                            ),
                        },
                    };
                });
            }
            return next;
        });
    };

    return {
        players,
        handleCreateEvent,
        handleDeleteEvent,
        handleUpdateEvent,
        handleMoveEvent,
        handleMoveMultipleEvents,
    };
}
