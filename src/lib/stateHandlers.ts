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
    _trackEvent: TrackEvent
): Player {
    return state;
}

export function applyStackTop(state: Player, _trackEvent: TrackEvent): Player {
    return state;
}

export function applyShuffle(state: Player, _trackEvent: TrackEvent): Player {
    return state;
}
