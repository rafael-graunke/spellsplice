import type { Card } from '../components/types/card';
import type { TrackEvent } from '../components/types/event';
import type { Player } from '../components/types/player';
import {
    applyGainLife,
    applyLoseLife,
    applyWin,
    applyReset,
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
        } else if (event.type === 'REVEAL_FROM_HAND' && event.meta?.cards) {
            const counts = new Map<string, number>();
            for (const c of event.meta.cards) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
            hand = hand.map(({ card, enteredAt }) => {
                const rem = counts.get(card.name) ?? 0;
                if (rem > 0) { counts.set(card.name, rem - 1); return { card: { ...card, revealed: true }, enteredAt }; }
                return { card, enteredAt };
            });
        } else if (event.type === 'RESET') {
            hand = [];
        }
    }

    return hand;
}

// Derives the current contents of every annotation slot for a player by
// replaying persistent ANNOTATE_CARD / UNANNOTATE_CARD events up to `time`.
// Additive model: ANNOTATE appends cards, UNANNOTATE removes cards (empty
// cards clears the whole slot). Cards carry `enteredAt` for slide-in animation.
export function deriveAnnotations(
    events: TrackEvent[],
    time: number,
): Record<string, CardWithTimestamp[]> {
    const persistent = events
        .filter((e) => !e.resizable && e.time <= time)
        .sort((a, b) => a.time - b.time);

    const slots: Record<string, CardWithTimestamp[]> = {};

    for (const event of persistent) {
        if (event.type === 'RESET') {
            for (const id of Object.keys(slots)) slots[id] = [];
            continue;
        }
        const slotId = event.meta?.annotationId;
        if (!slotId) continue;

        if (event.type === 'ANNOTATE_CARD' && event.meta?.cards) {
            const incoming = event.meta.cards.map((card) => ({ card, enteredAt: event.time }));
            slots[slotId] = [...(slots[slotId] ?? []), ...incoming];
        } else if (event.type === 'UNANNOTATE_CARD') {
            if (!event.meta?.cards?.length) {
                slots[slotId] = [];
                continue;
            }
            const counts = new Map<string, number>();
            for (const c of event.meta.cards) {
                counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
            }
            slots[slotId] = (slots[slotId] ?? []).filter(({ card }) => {
                const remaining = counts.get(card.name) ?? 0;
                if (remaining > 0) {
                    counts.set(card.name, remaining - 1);
                    return false;
                }
                return true;
            });
        }
    }

    return slots;
}

export interface AnnotationExit {
    removed: Card[];
    time: number;
}

export interface DerivedAnnotations {
    slots: Record<string, CardWithTimestamp[]>;
    // Most recent removal per slot that falls within `window` seconds of `time`,
    // for exit animation. Overwritten as later removals are replayed, so it holds
    // the latest.
    exits: Record<string, AnnotationExit>;
}

// Single-pass variant used by the renderer: derives current slot contents AND
// the cards recently removed from each slot (for slide-out animation) in one
// replay, avoiding a full re-derive per UNANNOTATE event.
export function deriveAnnotationsWithExits(
    events: TrackEvent[],
    time: number,
    window: number,
): DerivedAnnotations {
    const persistent = events
        .filter((e) => !e.resizable && e.time <= time)
        .sort((a, b) => a.time - b.time);

    const slots: Record<string, CardWithTimestamp[]> = {};
    const exits: Record<string, AnnotationExit> = {};
    const cutoff = time - window;

    for (const event of persistent) {
        if (event.type === 'RESET') {
            for (const id of Object.keys(slots)) {
                const before = slots[id];
                if (before.length > 0 && event.time > cutoff) {
                    exits[id] = { removed: before.map((c) => c.card), time: event.time };
                }
                slots[id] = [];
            }
            continue;
        }
        const slotId = event.meta?.annotationId;
        if (!slotId) continue;

        if (event.type === 'ANNOTATE_CARD' && event.meta?.cards) {
            const bucket = (slots[slotId] ??= []);
            for (const card of event.meta.cards) bucket.push({ card, enteredAt: event.time });
        } else if (event.type === 'UNANNOTATE_CARD') {
            const before = slots[slotId] ?? [];
            let removed: Card[];
            if (!event.meta?.cards?.length) {
                removed = before.map((c) => c.card);
                slots[slotId] = [];
            } else {
                const counts = new Map<string, number>();
                for (const c of event.meta.cards) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
                removed = [];
                slots[slotId] = before.filter(({ card }) => {
                    const rem = counts.get(card.name) ?? 0;
                    if (rem > 0) {
                        counts.set(card.name, rem - 1);
                        removed.push(card);
                        return false;
                    }
                    return true;
                });
            }
            if (event.time > cutoff && removed.length > 0) {
                exits[slotId] = { removed, time: event.time };
            }
        }
    }

    return { slots, exits };
}

export function derivePlayerState(
    player: Player,
    events: TrackEvent[],
    time: number
): Player {
    const persistent = events
        .filter((e) => !e.resizable && e.time <= time)
        .sort((a, b) => a.time - b.time);

    const state = persistent.reduce(applyEvent, { ...player });
    const handTS = deriveHandWithTimestamps(player, events, time);
    return { ...state, cards: handTS.map((h) => h.card), handSize: handTS.length };
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
const UI_ANIM_DURATION = 0.35;
const uiEaseOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function deriveUIVisibility(players: Player[], time: number, startHidden = false): number {
    const events = players
        .flatMap((p) => p.track.events)
        .filter((e) => !e.resizable && (e.type === 'HIDE_UI' || e.type === 'SHOW_UI') && e.time <= time)
        .sort((a, b) => a.time - b.time);

    let state: 'visible' | 'hidden' = startHidden ? 'hidden' : 'visible';
    let lastTransition: TrackEvent | null = null;

    for (const e of events) {
        if (e.type === 'HIDE_UI' && state === 'visible') {
            state = 'hidden';
            lastTransition = e;
        } else if (e.type === 'SHOW_UI' && state === 'hidden') {
            state = 'visible';
            lastTransition = e;
        }
    }

    if (!lastTransition) return startHidden ? 0 : 1;

    const t = Math.min(1, (time - lastTransition.time) / UI_ANIM_DURATION);
    const ease = uiEaseOut(t);
    return state === 'visible' ? ease : 1 - ease;
}

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
        case 'WIN':
            return applyWin(state);
        case 'HIDE_UI':
        case 'SHOW_UI':
            return state;
        case 'RESET':
            return applyReset(state);
        default:
            return state;
    }
}
