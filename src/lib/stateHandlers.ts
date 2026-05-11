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

export function applyStackDeck(state: Player, trackEvent: TrackEvent): Player {
    if (!trackEvent.meta?.cards) return state;
    return {
        ...state,
        topStack: [...trackEvent.meta.cards],
    };
}

export function applyUnstackDeck(state: Player, _trackEvent: TrackEvent): Player {
    return {
        ...state,
        topStack: [],
    };
}

export function applyWin(state: Player): Player {
    return { ...state, wins: state.wins + 1 };
}

export function applyReset(state: Player): Player {
    return { ...state, lifeTotal: 20, topStack: [] };
}
