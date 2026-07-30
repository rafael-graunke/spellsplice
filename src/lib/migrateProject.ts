import type { Player } from '@/types/player';
import type { TrackEvent } from '@/types/event';
import { DEFAULT_ANNOTATION_SLOT_ID } from '@/types/config';

// Legacy event type strings, removed from the EventType union but still present
// in previously-saved projects.
const LEGACY_STACK = 'STACK_DECK';
const LEGACY_UNSTACK = 'UNSTACK_DECK';

// Converts legacy deck-stack events into annotation events targeting the
// default 'top-deck' slot. STACK_DECK replaced the whole stack, so under the
// additive annotation model it becomes a clear (UNANNOTATE, empty) followed by
// an append (ANNOTATE); the tiny time epsilon keeps them ordered in the
// time-sorted replay. UNSTACK_DECK becomes a clear.
export function migrateLegacyEvents(players: Player[]): Player[] {
    return players.map((player) => {
        const events = player.track.events;
        if (!events.some((e) => (e.type as string) === LEGACY_STACK || (e.type as string) === LEGACY_UNSTACK)) {
            return player;
        }

        let nextId = events.reduce((max, e) => Math.max(max, e.id), 0) + 1;
        const migrated: TrackEvent[] = [];

        for (const e of events) {
            if ((e.type as string) === LEGACY_STACK) {
                migrated.push({
                    id: nextId++,
                    time: e.time,
                    layer: e.layer,
                    type: 'UNANNOTATE_CARD',
                    resizable: false,
                    duration: 1,
                    meta: { annotationId: DEFAULT_ANNOTATION_SLOT_ID, cards: [] },
                });
                migrated.push({
                    id: nextId++,
                    time: e.time + 0.0001,
                    layer: e.layer,
                    type: 'ANNOTATE_CARD',
                    resizable: false,
                    duration: 1,
                    meta: {
                        annotationId: DEFAULT_ANNOTATION_SLOT_ID,
                        cards: e.meta?.cards ?? [],
                    },
                });
            } else if ((e.type as string) === LEGACY_UNSTACK) {
                migrated.push({
                    id: nextId++,
                    time: e.time,
                    layer: e.layer,
                    type: 'UNANNOTATE_CARD',
                    resizable: false,
                    duration: 1,
                    meta: { annotationId: DEFAULT_ANNOTATION_SLOT_ID, cards: [] },
                });
            } else {
                migrated.push(e);
            }
        }

        return { ...player, track: { ...player.track, events: migrated } };
    });
}
