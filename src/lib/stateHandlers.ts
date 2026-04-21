import type { Player } from '../components/types/player';
import type { TrackEvent } from '../components/types/event';

export function applyGainLife(state: Player, trackEvent: TrackEvent): Player {
    if (!trackEvent.meta?.amount) return state;
    return { ...state, lifeTotal: state.lifeTotal + trackEvent.meta.amount };
}

export function applyLoseLife(state: Player, trackEvent: TrackEvent): Player {
    if (!trackEvent.meta?.amount) return state;
    return { ...state, lifeTotal: state.lifeTotal - trackEvent.meta.amount };
}

export function applyAddToHand(state: Player, trackEvent: TrackEvent): Player {
    if (!trackEvent.meta?.cards) return state;
    return {
        ...state,
        handSize: state.handSize + trackEvent.meta.cards.length,
        cards: [...state.cards, ...trackEvent.meta.cards],
    };
}

export function applyRemoveFromHand(
    state: Player,
    trackEvent: TrackEvent
): Player {
    if (!trackEvent.meta?.cards) return state;
    const namesToRemove = new Set(trackEvent.meta.cards.map((c) => c.name));
    return {
        ...state,
        handSize: Math.max(0, state.handSize - trackEvent.meta.cards.length),
        cards: state.cards.filter((card) => !namesToRemove.has(card.name)),
    };
}

export function applyRevealFromHand(
    state: Player,
    trackEvent: TrackEvent
): Player {

    if (!trackEvent.meta?.cards) return state;
    const revealCounts = new Map<string, number>();
    for (const c of trackEvent.meta.cards) {
        revealCounts.set(c.name, (revealCounts.get(c.name) ?? 0) + 1);
    }
    return {
        ...state,
        cards: state.cards.map((card) => {
            const remaining = revealCounts.get(card.name) ?? 0;
            if (remaining > 0) {
                revealCounts.set(card.name, remaining - 1);
                return { ...card, revealed: true };
            }
            return card;
        }),
    };
}


export function applyStackTop(state: Player, _trackEvent: TrackEvent): Player {
    return state;
}

export function applyShuffle(state: Player, _trackEvent: TrackEvent): Player {
    return state;
}
