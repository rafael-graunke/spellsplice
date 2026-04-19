import type { TrackEvent } from '../components/types/event';
import type { Player } from '../components/types/player';
import {
    applyGainLife,
    applyLoseLife,
    applyAddToHand,
    applyRemoveFromHand,
    applyRevealFromHand,
    applyStackTop,
    applyShuffle,
} from './stateHandlers';

export function derivePlayerState(
    player: Player,
    events: TrackEvent[],
    time: number
): Player {
    const persistent = events
        .filter((e) => !e.resizable && e.time <= time)
        .sort((a, b) => a.time - b.time);

    return persistent.reduce(applyEvent, { ...player });
}

export function getActiveWindowedEvents(
    events: TrackEvent[],
    time: number
): TrackEvent[] {
    return events.filter(
        (e) => e.resizable && e.time <= time && time < e.time + e.duration!
    );
}

// Returns the next time after `time` at which derived state would change.
export function getNextChangeTime(
    tracks: { events: TrackEvent[] }[],
    time: number
): number {
    let next = Infinity;
    for (const track of tracks) {
        for (const e of track.events) {
            if (!e.resizable && e.time > time) {
                next = Math.min(next, e.time);
            } else if (e.resizable) {
                if (e.time > time) next = Math.min(next, e.time);
                else if (time < e.time + e.duration!)
                    next = Math.min(next, e.time + e.duration!);
            }
        }
    }
    return next;
}

function applyEvent(state: Player, event: TrackEvent): Player {
    switch (event.type) {
        case 'GAIN_LIFE':
            return applyGainLife(state, event);
        case 'LOSE_LIFE':
            return applyLoseLife(state, event);
        case 'ADD_TO_HAND':
            return applyAddToHand(state, event);
        case 'REMOVE_FROM_HAND':
            return applyRemoveFromHand(state, event);
        case 'REVEAL_FROM_HAND':
            return applyRevealFromHand(state, event);
        case 'STACK_TOP':
            return applyStackTop(state, event);
        case 'SHUFFLE':
            return applyShuffle(state, event);
        default:
            return state;
    }
}
