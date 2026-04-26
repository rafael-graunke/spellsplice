import { useRef, useState } from 'react';
import type { Player } from '../../types/player';
import type { Track, TrackEvent } from '../../types/event';

export function useTrackEvents(
    playerData: Player[],
    currentTime: number,
    setSelectedEvents: React.Dispatch<React.SetStateAction<TrackEvent[]>>
) {
    const [tracks, setTracks] = useState<Track[]>(() =>
        playerData.map((player) => ({
            id: player.id,
            playerId: player.id,
            layers: 4,
            events: [],
        }))
    );
    const nextEventId = useRef(1);

    const handleCreateEvent = (
        partial: Partial<TrackEvent> & Pick<TrackEvent, 'type'>
    ) => {
        const newEvent: TrackEvent = {
            id: nextEventId.current++,
            time: currentTime,
            duration: 1,
            resizable: false,
            layer: 1,
            ...partial,
        };
        setTracks((prev) => {
            if (prev.length === 0) return prev;
            const [first, ...rest] = prev;
            return [{ ...first, events: [...first.events, newEvent] }, ...rest];
        });
        setSelectedEvents([newEvent]);
    };

    const handleDeleteEvent = (trackId: string, eventId: number) => {
        setTracks((prev) =>
            prev.map((track) =>
                track.id === trackId
                    ? {
                          ...track,
                          events: track.events.filter((e) => e.id !== eventId),
                      }
                    : track
            )
        );
    };

    const handleUpdateEvent = (
        trackId: string,
        eventId: number,
        time: number,
        duration: number
    ) => {
        setTracks((prev) =>
            prev.map((track) =>
                track.id === trackId
                    ? {
                          ...track,
                          events: track.events.map((e) =>
                              e.id === eventId ? { ...e, time, duration } : e
                          ),
                      }
                    : track
            )
        );
    };

    const handleMoveEvent = (
        fromTrackId: string,
        toTrackId: string,
        eventId: number,
        newTime: number
    ) => {
        setTracks((prev) => {
            const sourceTrack = prev.find((t) => t.id === fromTrackId);
            const event = sourceTrack?.events.find((e) => e.id === eventId);
            if (!event) return prev;
            const updatedEvent = { ...event, time: newTime };

            return prev.map((track) => {
                if (fromTrackId === toTrackId && track.id === fromTrackId) {
                    return {
                        ...track,
                        events: track.events.map((e) =>
                            e.id === eventId ? updatedEvent : e
                        ),
                    };
                }
                if (track.id === fromTrackId) {
                    return {
                        ...track,
                        events: track.events.filter((e) => e.id !== eventId),
                    };
                }
                if (track.id === toTrackId) {
                    return {
                        ...track,
                        events: [...track.events, updatedEvent],
                    };
                }
                return track;
            });
        });
    };

    const handleMoveMultipleEvents = (
        moves: Array<{
            fromTrackId: string;
            toTrackId: string;
            eventId: number;
            newTime: number;
        }>
    ) => {
        setTracks((prev) => {
            let next = prev;
            for (const { fromTrackId, toTrackId, eventId, newTime } of moves) {
                const sourceTrack = next.find((t) => t.id === fromTrackId);
                const event = sourceTrack?.events.find((e) => e.id === eventId);
                if (!event) continue;
                const updatedEvent = { ...event, time: newTime };
                if (fromTrackId === toTrackId) {
                    next = next.map((track) =>
                        track.id === fromTrackId
                            ? {
                                  ...track,
                                  events: track.events.map((e) =>
                                      e.id === eventId ? updatedEvent : e
                                  ),
                              }
                            : track
                    );
                } else {
                    next = next.map((track) => {
                        if (track.id === fromTrackId)
                            return {
                                ...track,
                                events: track.events.filter(
                                    (e) => e.id !== eventId
                                ),
                            };
                        if (track.id === toTrackId)
                            return {
                                ...track,
                                events: [...track.events, updatedEvent],
                            };
                        return track;
                    });
                }
            }
            return next;
        });
    };

    return {
        tracks,
        handleCreateEvent,
        handleDeleteEvent,
        handleUpdateEvent,
        handleMoveEvent,
        handleMoveMultipleEvents,
    };
}
