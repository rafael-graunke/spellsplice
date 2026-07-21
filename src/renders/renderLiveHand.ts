import type { Card } from '@/components/types/card';
import type {
    LiveHandCard,
    LiveHandStackConfig,
    SingleHandStackConfig,
} from '@/lib/liveMode';
import { getStripH, drawCardStrip } from './renderCardStrips';
import {
    drawOverflowPill,
    stackAnchorX,
    stackAnchorY,
    stackFacesLeft,
    stackTopY,
    visibleStripCount,
} from './stackLayout';

// Per-card hand animation, keyed by card instance id in OverlayPage's registry.
// `enter` slides a newly added card in from the near edge; `exit` slides a
// removed card back out while the cards above it ease down to close the gap.
// Driven by wall-clock `now` (performance.now()). `oldIndex` is the removed
// card's position in the pre-removal stack, captured from the live snapshot
// before it was dropped (only meaningful for `exit`).
export interface HandAnim {
    phase: 'enter' | 'exit';
    start: number;
    card: LiveHandCard;
    side: 'left' | 'right';
    oldIndex?: number;
}

export const HAND_ANIM_DURATION = 250; // ms

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Number of cards actually rendered under `maxHeight`.
export function visibleHandCount(
    hand: LiveHandCard[],
    cfg: SingleHandStackConfig
): number {
    return visibleStripCount(hand, cfg.cardStripWidth, cfg.maxHeight);
}

// Top Y of the rendered stack (used to place annotations directly above it).
// Honors the max-height cap so annotations follow the visible top, not the
// full hand's would-be top.
export function getHandStackTopY(
    hand: LiveHandCard[],
    cfg: SingleHandStackConfig,
    offsetY: number,
    drawH: number
): number {
    const stripW = cfg.cardStripWidth;
    const visible = hand.slice(0, visibleHandCount(hand, cfg));
    const totalH = visible.reduce(
        (s, { card }) => s + getStripH({ name: card.name }, stripW),
        0
    );
    const anchorY = stackAnchorY(cfg.anchor, cfg.offset, offsetY, drawH);
    return stackTopY(anchorY, totalH, cfg.growth);
}

export function renderLiveHand(
    ctx: CanvasRenderingContext2D,
    left: LiveHandCard[],
    right: LiveHandCard[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    config: LiveHandStackConfig,
    anims: Map<string, HandAnim> = new Map(),
    now = 0
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sides: Array<{
        hand: LiveHandCard[];
        side: 'left' | 'right';
    }> = [
        { hand: left, side: 'left' },
        { hand: right, side: 'right' },
    ];

    for (const { hand: fullHand, side } of sides) {
        const cfg = config[side];
        const stripW = cfg.cardStripWidth;
        // Cap to the cards that fit under maxHeight; the tail is summarised by a
        // pill below. Rendering (and its enter/exit anims) only ever sees the
        // visible prefix.
        const visibleCount = visibleHandCount(fullHand, cfg);
        const hand = fullHand.slice(0, visibleCount);
        const hiddenCount = fullHand.length - visibleCount;
        // isLeft governs the revealed-eye-icon side; live hands pass no icon so
        // it only needs to be consistent.
        const isLeft = stackFacesLeft(cfg.anchor, side);
        const finalX = stackAnchorX(
            cfg.anchor,
            cfg.offset,
            offsetX,
            drawW,
            stripW
        );
        // Cards slide in from (and out to) the nearest horizontal edge.
        const offscreenX = isLeft ? offsetX - stripW : offsetX + drawW;
        const anchorY = stackAnchorY(cfg.anchor, cfg.offset, offsetY, drawH);

        const stripHOf = (c: LiveHandCard) =>
            getStripH({ name: c.card.name }, stripW);

        // Cards this side is animating out (already gone from the snapshot).
        const snapshotIds = new Set(hand.map((c) => c.id));
        const exiting = [...anims.values()].filter(
            (a) =>
                a.side === side &&
                a.phase === 'exit' &&
                !snapshotIds.has(a.card.id)
        );

        // Reconstruct the pre-removal stack by re-inserting each exiting card at
        // its captured oldIndex. Gives every card a "before" position so the gap
        // left by a removal can be animated closed (rather than snapping).
        const preHand: LiveHandCard[] = [...hand];
        for (const a of [...exiting].sort(
            (x, y) =>
                (x.oldIndex ?? preHand.length) - (y.oldIndex ?? preHand.length)
        )) {
            const oi = Math.min(a.oldIndex ?? preHand.length, preHand.length);
            preHand.splice(oi, 0, a.card);
        }
        const preIndexOf = new Map(preHand.map((c, idx) => [c.id, idx]));
        const cumH = (list: LiveHandCard[], upTo: number) =>
            list.slice(0, upTo).reduce((s, c) => s + stripHOf(c), 0);

        // Top Y of the card at `index` within `list`, honoring the growth mode.
        // top-down pins the stack top at anchorY (card 0 topmost); bottom-up
        // pins the bottom (card 0 bottommost, matching the legacy layout);
        // center pins the block's midpoint at anchorY.
        const slotY = (list: LiveHandCard[], index: number) => {
            if (cfg.growth === 'top-down') return anchorY + cumH(list, index);
            if (cfg.growth === 'center')
                return (
                    anchorY - cumH(list, list.length) / 2 + cumH(list, index)
                );
            return anchorY - cumH(list, index + 1); // bottom-up
        };

        // Reflow progress for a surviving card: the slowest of the removals that
        // sit below it (0 = just removed -> sit at old slot, 1 = settled).
        const reflowT = (preIndex: number) => {
            let t = 1;
            for (const a of exiting) {
                const oi = a.oldIndex ?? preHand.length;
                if (oi < preIndex)
                    t = Math.min(
                        t,
                        easeOut(clamp01((now - a.start) / HAND_ANIM_DURATION))
                    );
            }
            return t;
        };

        // Surviving + entering cards (everything still in the snapshot).
        for (let j = 0; j < hand.length; j++) {
            const hc = hand[j];
            const cardData: Card = { name: hc.card.name };
            const finalY = slotY(hand, j);

            let x = finalX;
            let alpha = 1;
            let y = finalY;
            const anim = anims.get(hc.id);
            if (anim && anim.side === side && anim.phase === 'enter') {
                const t = easeOut(
                    clamp01((now - anim.start) / HAND_ANIM_DURATION)
                );
                x = offscreenX + (finalX - offscreenX) * t;
                alpha = t;
            } else {
                const pi = preIndexOf.get(hc.id) ?? j;
                const preY = slotY(preHand, pi);
                const t = reflowT(pi);
                y = preY + (finalY - preY) * t;
            }

            drawCardStrip(
                ctx,
                cardData,
                x,
                y,
                isLeft,
                null,
                alpha,
                hc.card.mana_cost,
                hc.card.colors,
                stripW
            );
        }

        // Exiting cards: held at their old slot, sliding out and fading.
        for (const a of exiting) {
            const t = easeOut(clamp01((now - a.start) / HAND_ANIM_DURATION));
            const pi = preIndexOf.get(a.card.id) ?? preHand.length - 1;
            const preY = slotY(preHand, pi);
            const x = finalX + (offscreenX - finalX) * t;

            drawCardStrip(
                ctx,
                { name: a.card.card.name },
                x,
                preY,
                isLeft,
                null,
                1 - t,
                a.card.card.mana_cost,
                a.card.card.colors,
                stripW
            );
        }

        // Overflow pill: horizontally centered on the stack, straddling the
        // growth edge (top for bottom-up, bottom for top-down/center).
        if (hiddenCount > 0 && hand.length > 0) {
            const visTotalH = cumH(hand, hand.length);
            const topY =
                cfg.growth === 'top-down'
                    ? anchorY
                    : cfg.growth === 'center'
                      ? anchorY - visTotalH / 2
                      : anchorY - visTotalH;
            const edgeY = cfg.growth === 'bottom-up' ? topY : topY + visTotalH;
            drawOverflowPill(
                ctx,
                finalX + stripW / 2,
                edgeY,
                hiddenCount,
                stripW
            );
        }
    }
}
