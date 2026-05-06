import type { Card } from '../components/types/card';
import type { TrackEvent } from '../components/types/event';
import type { Player } from '../components/types/player';
import {
    applyGainLife,
    applyLoseLife,
    applyAddToHand,
    applyRemoveFromHand,
    applyRevealFromHand,
    applyStackDeck,
    applyUnstackDeck,
} from './stateHandlers';

export interface CardWithTimestamp {
    card: Card;
    enteredAt: number;
}

export function deriveHandWithTimestamps(
    player: Player,
    events: TrackEvent[],
    time: number,
): CardWithTimestamp[] {
    const persistent = events
        .filter((e) => !e.resizable && e.time <= time)
        .sort((a, b) => a.time - b.time);

    let hand: CardWithTimestamp[] = player.cards.map((card) => ({ card, enteredAt: 0 }));

    for (const event of persistent) {
        if (event.type === 'ADD_TO_HAND' && event.meta?.cards) {
            const incoming = [...event.meta.cards]
                .reverse()
                .map((card) => ({ card, enteredAt: event.time }));
            hand = [...hand, ...incoming];
        } else if (event.type === 'REMOVE_FROM_HAND' && event.meta?.cards) {
            const counts = new Map<string, number>();
            for (const c of event.meta.cards) {
                counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
            }
            hand = hand.filter(({ card }) => {
                const remaining = counts.get(card.name) ?? 0;
                if (remaining > 0) {
                    counts.set(card.name, remaining - 1);
                    return false;
                }
                return true;
            });
        }
    }

    return hand;
}

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
        case 'STACK_DECK':
            return applyStackDeck(state, event);
        case 'UNSTACK_DECK':
            return applyUnstackDeck(state, event);
        default:
            return state;
    }
}
