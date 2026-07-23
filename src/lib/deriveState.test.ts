import { describe, it, expect } from 'vitest';
import { deriveHandWithTimestamps, deriveAnnotationsWithExits } from './deriveState';
import type { Player } from '@/components/types/player';
import type { TrackEvent, EventType } from '@/components/types/event';

// Minimal builders. The overlay renderers key animation + reflow on the stable
// `id` these derivations emit, so these tests lock that contract (and the
// determinism the deterministic export depends on).
function ev(id: number, type: EventType, time: number, cards?: string[], annotationId?: string): TrackEvent {
    return {
        id,
        time,
        layer: 0,
        type,
        resizable: false,
        meta: {
            ...(cards ? { cards: cards.map((name) => ({ name })) } : {}),
            ...(annotationId ? { annotationId } : {}),
        },
    };
}

function player(cards: string[], events: TrackEvent[]): Player {
    return {
        id: 'p',
        name: 'P',
        lifeTotal: 20,
        handSize: 0,
        wins: 0,
        cards: cards.map((name) => ({ name })),
        track: { id: 't', layers: 4, events },
    };
}

describe('deriveHandWithTimestamps', () => {
    it('gives the starting hand deterministic init ids', () => {
        const p = player(['Brainstorm', 'Ponder'], []);
        const hand = deriveHandWithTimestamps(p, p.track.events, 10);
        expect(hand.map((h) => h.id)).toEqual(['init:0', 'init:1']);
    });

    it('ids added cards by their event, and keeps them stable across time', () => {
        const events = [ev(5, 'ADD_TO_HAND', 1, ['A', 'B'])];
        const p = player([], events);
        const at2 = deriveHandWithTimestamps(p, events, 2);
        const at9 = deriveHandWithTimestamps(p, events, 9);
        const ids = at2.map((h) => h.id).sort();
        expect(ids).toEqual(['5:0', '5:1']);
        // Same id set, unchanged, as time advances.
        expect(at9.map((h) => h.id).sort()).toEqual(ids);
    });

    it('gives duplicate copies of one card distinct ids', () => {
        const events = [ev(7, 'ADD_TO_HAND', 1, ['Island', 'Island'])];
        const p = player([], events);
        const hand = deriveHandWithTimestamps(p, events, 2);
        const ids = hand.map((h) => h.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('removing one of two identical cards leaves the other with its id intact', () => {
        const events = [
            ev(1, 'ADD_TO_HAND', 1, ['Island', 'Island']),
            ev(2, 'REMOVE_FROM_HAND', 2, ['Island']),
        ];
        const p = player([], events);
        const before = deriveHandWithTimestamps(p, events, 1.5);
        const after = deriveHandWithTimestamps(p, events, 2.5);
        expect(after).toHaveLength(1);
        // The survivor is one of the original instances, not a re-minted id.
        expect(before.map((h) => h.id)).toContain(after[0].id);
    });

    it('is deterministic for the same (events, time)', () => {
        const events = [
            ev(1, 'ADD_TO_HAND', 1, ['A', 'B']),
            ev(2, 'REMOVE_FROM_HAND', 2, ['A']),
        ];
        const p = player(['C'], events);
        expect(deriveHandWithTimestamps(p, events, 3)).toEqual(deriveHandWithTimestamps(p, events, 3));
    });
});

describe('deriveAnnotationsWithExits', () => {
    it('ids annotated cards and records removals with their old index', () => {
        const events = [
            ev(3, 'ANNOTATE_CARD', 1, ['A', 'B'], 'graveyard'),
            ev(4, 'UNANNOTATE_CARD', 2, ['A'], 'graveyard'),
        ];
        const { slots, exits } = deriveAnnotationsWithExits(events, 2.1, 0.5);
        expect(slots.graveyard.map((c) => c.card.name)).toEqual(['B']);
        expect(exits.graveyard.time).toBe(2);
        expect(exits.graveyard.removed).toHaveLength(1);
        expect(exits.graveyard.removed[0].oldIndex).toBe(0);
        expect(exits.graveyard.removed[0].entry.card.name).toBe('A');
        expect(exits.graveyard.removed[0].entry.id).toBe('3:0');
    });

    it('RESET clears every slot and reports the removed instances', () => {
        const events = [
            ev(1, 'ANNOTATE_CARD', 1, ['A'], 'graveyard'),
            ev(2, 'RESET', 2),
        ];
        const { slots, exits } = deriveAnnotationsWithExits(events, 2.1, 0.5);
        expect(slots.graveyard).toEqual([]);
        expect(exits.graveyard.removed.map((r) => r.entry.card.name)).toEqual(['A']);
    });

    it('drops stale exits outside the animation window', () => {
        const events = [
            ev(1, 'ANNOTATE_CARD', 1, ['A'], 'graveyard'),
            ev(2, 'UNANNOTATE_CARD', 2, [], 'graveyard'),
        ];
        // 2.0 removal, window 0.5, sampled at 3.0 -> outside.
        const { exits } = deriveAnnotationsWithExits(events, 3.0, 0.5);
        expect(exits.graveyard).toBeUndefined();
    });
});
