import type { Card } from '@/components/types/card';
import type { Player } from '@/components/types/player';
import type { TrackEvent } from '@/components/types/event';
import type { AnnotationSlot } from '@/components/types/config';
import type {
    LivePlayerInfo,
    LiveHandCard,
    LiveDisplayCard,
    LiveHandStackConfig,
    LiveCardDisplayConfig,
} from '@/lib/liveMode';
import type { OracleCard } from '@/lib/oracleCards';
import { findOracleCard } from '@/lib/oracleCards';
import type { CardImageRequest } from '@/lib/cardCache';
import type { HandAnim } from '@/renders/renderLiveHand';
import { HAND_ANIM_DURATION } from '@/renders/renderLiveHand';
import type { AnnotationAnim, LiveAnnotationData } from '@/renders/renderLiveAnnotation';
import { ANNOTATION_ANIM_DURATION } from '@/renders/renderLiveAnnotation';
import type { DisplayAnim } from '@/renders/renderLiveCardDisplay';
import {
    deriveHandWithTimestamps,
    deriveAnnotationsWithExits,
    getActiveWindowedEvents,
    type CardWithTimestamp,
} from '@/lib/deriveState';

// Bridges Timeline's derived state into the shapes Live Mode's overlay renderers
// consume, so both modes share one renderer set. Timeline time is deterministic,
// so animations are expressed as wall-clock-shaped values derived from event
// times: `now = time * 1000`, `start = eventTime * 1000`. The renderers only ever
// compute (now - start) / DURATION, so scrubbing and export reproduce exactly.

export const toNow = (time: number) => time * 1000;

// Every card image the overlay can need across the whole project, tagged with
// the variant it is drawn from: strips (hand + annotations) use the border crop,
// the card display uses the full art. Export preloads these so no placeholder is
// ever baked into the output.
export function collectCardImageRequests(players: Player[]): CardImageRequest[] {
    const out: CardImageRequest[] = [];
    const add = (cards: Card[] | undefined, key: CardImageRequest['key']) => {
        for (const c of cards ?? []) {
            if (c?.name) out.push({ name: c.name, edition: c.edition, key });
        }
    };

    for (const player of players) {
        add(player.cards, 'border_crop');
        for (const e of player.track.events) {
            switch (e.type) {
                case 'ADD_TO_HAND':
                case 'REMOVE_FROM_HAND':
                case 'REVEAL_FROM_HAND':
                case 'ANNOTATE_CARD':
                case 'UNANNOTATE_CARD':
                    add(e.meta?.cards, 'border_crop');
                    break;
                case 'DISPLAY_CARD':
                    add(e.meta?.cards, 'normal');
                    break;
            }
        }
    }
    return out;
}

// Largest configured card-display animation length, in seconds. Callers use it to
// keep repainting the overlay for the whole animation window.
export function cardDisplayAnimSeconds(config: LiveCardDisplayConfig): number {
    return Math.max(config.left.animation?.duration ?? 0, config.right.animation?.duration ?? 0) / 1000;
}

export function toPlayerInfo(player: Player): LivePlayerInfo {
    return {
        name: player.name,
        deckName: player.deckName ?? '',
        standing: player.standing ?? '',
        pronouns: player.pronouns ?? '',
        life: player.lifeTotal,
        wins: player.wins,
    };
}

// Timeline cards carry only name/edition/revealed; the renderers want an
// OracleCard for colors/mana_cost/layout (used for placeholders and DFC). Falls
// back to a bare name when the oracle DB isn't loaded — card art is unaffected,
// it comes from cardCache keyed by name+edition.
function toOracle(card: Card): OracleCard {
    return findOracleCard(card.name) ?? { name: card.name };
}

function toLiveCard(entry: CardWithTimestamp): LiveHandCard {
    return {
        id: entry.id,
        card: toOracle(entry.card),
        ...(entry.card.edition ? { edition: entry.card.edition } : {}),
        ...(entry.card.revealed ? { revealed: true } : {}),
    };
}

const side = (i: number): 'left' | 'right' => (i === 0 ? 'left' : 'right');

export interface HandSynthesis {
    cards: LiveHandCard[];
    anims: Map<string, HandAnim>;
}

// Current hand plus enter/exit animations, derived from event timestamps.
// `insert: 'prepend'` reverses the stack order (Live applies it when inserting;
// Timeline's order comes from event replay, so it is applied here instead).
export function toHand(
    player: Player,
    time: number,
    cfg: LiveHandStackConfig[keyof LiveHandStackConfig],
    sideName: 'left' | 'right',
): HandSynthesis {
    const events = player.track.events;
    const handTS = deriveHandWithTimestamps(player, events, time);
    const anims = new Map<string, HandAnim>();
    const animSec = HAND_ANIM_DURATION / 1000;

    for (const entry of handTS) {
        if (entry.enteredAt > 0 && time - entry.enteredAt < animSec) {
            anims.set(entry.id, {
                phase: 'enter',
                start: toNow(entry.enteredAt),
                card: toLiveCard(entry),
                side: sideName,
            });
        }
    }

    // Cards removed within the animation window still animate out; they are gone
    // from the snapshot, so the renderer finds them via the anims map + oldIndex.
    const prepend = cfg.insert === 'prepend';
    const exitAnim = (entry: CardWithTimestamp, at: number, i: number, preLen: number) =>
        anims.set(entry.id, {
            phase: 'exit',
            start: toNow(at),
            card: toLiveCard(entry),
            side: sideName,
            // Index within the *rendered* pre-removal stack, which prepend
            // reverses — otherwise the gap closes from the wrong end.
            oldIndex: prepend ? preLen - 1 - i : i,
        });

    for (const e of events) {
        if (e.time > time || e.time <= time - animSec) continue;
        if (e.type === 'REMOVE_FROM_HAND') {
            const pre = deriveHandWithTimestamps(player, events, e.time - 0.0001);
            const counts = new Map<string, number>();
            for (const c of e.meta?.cards ?? []) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
            pre.forEach((entry, i) => {
                const rem = counts.get(entry.card.name) ?? 0;
                if (rem <= 0) return;
                counts.set(entry.card.name, rem - 1);
                exitAnim(entry, e.time, i, pre.length);
            });
        } else if (e.type === 'RESET') {
            // RESET empties the hand; animate every card out rather than popping
            // them, matching how annotations clear on RESET.
            const pre = deriveHandWithTimestamps(player, events, e.time - 0.0001);
            pre.forEach((entry, i) => exitAnim(entry, e.time, i, pre.length));
        }
    }

    const cards = handTS.map(toLiveCard);
    if (prepend) cards.reverse();
    return { cards, anims };
}

export interface AnnotationSynthesis {
    annotations: Record<string, LiveAnnotationData>;
    anims: Map<string, AnnotationAnim>;
}

const humanize = (id: string) =>
    id
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

// Merges both players' annotation slots into the single per-slot {title,left,right}
// record the renderer expects, and builds enter/exit anims keyed by card id.
export function toAnnotations(
    players: Player[],
    time: number,
    slots: AnnotationSlot[],
    prepend: { left: boolean; right: boolean },
): AnnotationSynthesis {
    const annotations: Record<string, LiveAnnotationData> = {};
    const anims = new Map<string, AnnotationAnim>();
    const animSec = ANNOTATION_ANIM_DURATION / 1000;
    const titleFor = (id: string) => slots.find((s) => s.id === id)?.title ?? humanize(id);

    const ensure = (slotId: string): LiveAnnotationData => {
        annotations[slotId] ??= { title: titleFor(slotId), left: [], right: [] };
        return annotations[slotId];
    };

    players.forEach((player, i) => {
        const sideName = side(i);
        const { slots: derived, exits } = deriveAnnotationsWithExits(
            player.track.events,
            time,
            animSec,
        );

        for (const [slotId, entries] of Object.entries(derived)) {
            const list = entries.map(toLiveCard);
            if (prepend[sideName]) list.reverse();
            if (list.length > 0) ensure(slotId)[sideName] = list;

            for (const entry of entries) {
                if (entry.enteredAt > 0 && time - entry.enteredAt < animSec) {
                    anims.set(entry.id, {
                        phase: 'enter',
                        start: toNow(entry.enteredAt),
                        card: toLiveCard(entry),
                        side: sideName,
                        annotationId: slotId,
                    });
                }
            }
        }

        for (const [slotId, exit] of Object.entries(exits)) {
            if (exit.removed.length > 0) ensure(slotId);
            // Pre-removal length of this slot, to remap oldIndex when prepend
            // reverses the rendered order.
            const preLen = (derived[slotId]?.length ?? 0) + exit.removed.length;
            for (const { entry, oldIndex } of exit.removed) {
                anims.set(entry.id, {
                    phase: 'exit',
                    start: toNow(exit.time),
                    card: toLiveCard(entry),
                    side: sideName,
                    annotationId: slotId,
                    oldIndex: prepend[sideName] ? preLen - 1 - oldIndex : oldIndex,
                });
            }
        }
    });

    return { annotations, anims };
}

export interface DisplaySynthesis {
    left: LiveDisplayCard | null;
    right: LiveDisplayCard | null;
    anims: { left: DisplayAnim | null; right: DisplayAnim | null };
    frontSide: 'left' | 'right';
}

// The featured DISPLAY_CARD per player (most recently started wins, matching
// Live's one-card-per-side model), plus its enter/exit animation. `flipped` is
// wired as false until there is UI to set it.
export function toDisplayCards(
    players: Player[],
    time: number,
    animation: { left: DisplayAnim['anim']; right: DisplayAnim['anim'] },
): DisplaySynthesis {
    const out: DisplaySynthesis = {
        left: null,
        right: null,
        anims: { left: null, right: null },
        frontSide: 'right',
    };
    let latestStart = -Infinity;

    players.forEach((player, i) => {
        const sideName = side(i);
        const active = getActiveWindowedEvents(player.track.events, time)
            .filter((e): e is TrackEvent => e.type === 'DISPLAY_CARD' && !!e.meta?.cards?.[0]?.name)
            .sort((a, b) => a.time - b.time);
        const event = active[active.length - 1];
        if (!event) return;

        const card = event.meta!.cards![0];
        const anim = animation[sideName];
        const animSec = (anim?.duration ?? 0) / 1000;
        const liveCard: LiveDisplayCard = {
            id: `${event.id}`,
            card: toOracle(card),
            flipped: false,
            ...(card.edition ? { edition: card.edition } : {}),
        };
        out[sideName] = liveCard;

        const enterAge = time - event.time;
        const exitAge = event.duration != null ? event.time + event.duration - time : Infinity;
        if (animSec > 0 && enterAge < animSec) {
            out.anims[sideName] = { phase: 'enter', start: toNow(event.time), card: liveCard, anim };
        } else if (animSec > 0 && exitAge <= animSec) {
            const exitStart = event.time + (event.duration ?? 0) - animSec;
            out.anims[sideName] = { phase: 'exit', start: toNow(exitStart), card: liveCard, anim };
        }

        if (event.time > latestStart) {
            latestStart = event.time;
            out.frontSide = sideName;
        }
    });

    return out;
}
