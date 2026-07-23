import type { LiveAnnotationConfig, LiveHandCard } from '@/lib/liveMode';
import { getStripH, drawCardStrip } from './renderCardStrips';
import {
    drawOverflowPill,
    stackAnchorX,
    stackAnchorY,
    stackFacesLeft,
    stackTopY,
    visibleStripCount,
} from './stackLayout';

const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;
const GAP = 12;

export const ANNOTATION_ANIM_DURATION = 250; // ms

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export interface LiveAnnotationData {
    title: string;
    left: LiveHandCard[];
    right: LiveHandCard[];
}

// Per-card annotation animation, keyed by card instance id in OverlayPage's
// registry. Mirrors HandAnim but also carries the target slot (annotationId)
// since annotations render as separate stacked boxes. `oldIndex` is the exiting
// card's position within its slot's pre-removal stack.
export interface AnnotationAnim {
    phase: 'enter' | 'exit';
    start: number;
    card: LiveHandCard;
    side: 'left' | 'right';
    annotationId: string;
    oldIndex?: number;
}

// Slot render modes:
// - container-enter: the slot went empty -> non-empty. The whole container
//   (background + title + every card) slides in as one unit (matches the
//   timeline deck-stack "first STACK_DECK" animation). No per-card slide.
// - container-exit: the slot went non-empty -> empty. The whole container
//   slides out as one unit, all cards riding along.
// - per-card: a card was added to / removed from a slot that keeps other cards.
//   The container stays put; only the changed card slides, survivors reflow.
type BoxMode = 'container-enter' | 'container-exit' | 'per-card';

const stripHOf = (c: LiveHandCard, stripW: number) =>
    getStripH({ name: c.card.name }, stripW);

const animProgress = (a: AnnotationAnim, now: number) =>
    easeOut(clamp01((now - a.start) / ANNOTATION_ANIM_DURATION));

interface Box {
    title: string;
    contW: number;
    contH: number;
    mode: BoxMode;
    containerT: number; // slide progress for container modes (0..1)
    liveCards: LiveHandCard[]; // snapshot (surviving + entering) cards
    exiting: AnnotationAnim[]; // cards animating out of this slot+side
    preCards: LiveHandCard[]; // snapshot with exiting cards re-inserted
    hiddenCount: number; // cards past maxSlotHeight, summarised by a `+N` pill
}

// Rebuilds the stack as it was before the given cards were removed, by
// re-inserting each at its captured `oldIndex`. Gives every card a "before"
// position so the gap a removal leaves can be animated closed.
function insertByOldIndex(
    cards: LiveHandCard[],
    removed: AnnotationAnim[]
): LiveHandCard[] {
    const out = [...cards];
    for (const a of [...removed].sort(
        (x, y) => (x.oldIndex ?? out.length) - (y.oldIndex ?? out.length)
    )) {
        const oi = Math.min(a.oldIndex ?? out.length, out.length);
        out.splice(oi, 0, a.card);
    }
    return out;
}

// Builds the render boxes for one side. A slot is rendered when it holds cards
// in the snapshot OR still has a card animating out (so the exit can play even
// after the snapshot dropped it).
function buildBoxes(
    annotations: Record<string, LiveAnnotationData>,
    isLeft: boolean,
    stripW: number,
    maxSlotHeight: number | undefined,
    anims: Map<string, AnnotationAnim>,
    now: number
): Box[] {
    const side: 'left' | 'right' = isLeft ? 'left' : 'right';
    const boxes: Box[] = [];

    for (const [annotationId, data] of Object.entries(annotations)) {
        const allCards = isLeft ? data.left : data.right;
        // Cap this slot's cards to what fits under maxSlotHeight; the tail is
        // summarised by a pill. The cap is per slot, so a tall slot never steals
        // room from the ones below it in the column.
        const visibleCount = visibleStripCount(allCards, stripW, maxSlotHeight);
        const liveCards = allCards.slice(0, visibleCount);
        const hiddenCount = allCards.length - visibleCount;
        const snapshotIds = new Set(allCards.map((c) => c.id));
        const leaving = [...anims.values()].filter(
            (a) =>
                a.side === side &&
                a.phase === 'exit' &&
                a.annotationId === annotationId &&
                !snapshotIds.has(a.card.id)
        );
        // Whether a leaving card was on screen is a question about the stack it
        // left, not the one that remains: reconstruct the pre-removal list and
        // measure the cap against that. Testing against the post-removal count
        // drops the exit of any card that was last in its slot.
        const preAll = insertByOldIndex(allCards, leaving);
        const preVisible = visibleStripCount(preAll, stripW, maxSlotHeight);
        const exiting = leaving.filter(
            // A card removed from beyond the cap was never drawn, so it has no
            // exit to play; letting it through would pop a hidden card in.
            (a) => preAll.indexOf(a.card) < preVisible
        );
        if (liveCards.length === 0 && exiting.length === 0) continue;

        // Enter anims for the snapshot cards of this slot.
        const enterAnims = liveCards
            .map((c) => anims.get(c.id))
            .filter(
                (a): a is AnnotationAnim =>
                    !!a &&
                    a.phase === 'enter' &&
                    a.side === side &&
                    a.annotationId === annotationId
            );

        // Whole slot appearing (was empty): every current card is entering and
        // nothing is leaving. Whole slot disappearing: snapshot is empty but a
        // card is still sliding out.
        const isContainerEnter =
            exiting.length === 0 &&
            liveCards.length > 0 &&
            enterAnims.length === liveCards.length;
        const isContainerExit = liveCards.length === 0 && exiting.length > 0;

        const preCards = insertByOldIndex(liveCards, exiting);

        let mode: BoxMode = 'per-card';
        let containerT = 1;
        let stackH: number;

        if (isContainerEnter) {
            mode = 'container-enter';
            containerT = Math.min(
                ...enterAnims.map((a) => animProgress(a, now))
            );
            stackH = liveCards.reduce((s, c) => s + stripHOf(c, stripW), 0);
        } else if (isContainerExit) {
            mode = 'container-exit';
            containerT = Math.min(...exiting.map((a) => animProgress(a, now)));
            stackH = preCards.reduce((s, c) => s + stripHOf(c, stripW), 0);
        } else {
            // Per-card: reserve the exiting cards' height, decaying as they
            // leave, so the container shrinks smoothly instead of snapping.
            stackH =
                liveCards.reduce((s, c) => s + stripHOf(c, stripW), 0) +
                exiting.reduce(
                    (s, a) =>
                        s +
                        stripHOf(a.card, stripW) * (1 - animProgress(a, now)),
                    0
                );
        }

        boxes.push({
            title: data.title,
            contW: stripW,
            contH: CONT_PAD_Y + TITLE_AREA_H + stackH,
            mode,
            containerT,
            liveCards,
            exiting,
            preCards,
            hiddenCount,
        });
    }
    return boxes;
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    title: string,
    contX: number,
    contY: number,
    contW: number,
    contH: number
) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(contX, contY, contW, contH, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${TITLE_FONT_SIZE}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(title, contX + contW / 2, contY + CONT_PAD_Y);
    ctx.restore();
}

export function renderLiveAnnotations(
    ctx: CanvasRenderingContext2D,
    annotations: Record<string, LiveAnnotationData>,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    config: LiveAnnotationConfig,
    // Placement inherited from the hand stack, used when a side has
    // `follow: true`: the Y the column's bottom pins to (the hand's top edge)
    // and the hand's strip width, so annotations sit directly above the hand.
    followFrom: {
        anchorBottomY: { left: number; right: number };
        stripW: { left: number; right: number };
    },
    anims: Map<string, AnnotationAnim> = new Map(),
    now = 0
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const isLeft of [true, false]) {
        const side: 'left' | 'right' = isLeft ? 'left' : 'right';
        const cfg = config[side];
        // Following means matching the hand's strip width so the two align.
        const sw = cfg.follow ? followFrom.stripW[side] : cfg.cardStripWidth;
        // The per-slot cap is independent of `follow`: following inherits
        // placement and width from the hand, not how tall a slot may grow.
        const boxes = buildBoxes(
            annotations,
            isLeft,
            sw,
            cfg.maxSlotHeight,
            anims,
            now
        );
        if (boxes.length === 0) continue;

        const totalH =
            boxes.reduce((s, b) => s + b.contH, 0) + GAP * (boxes.length - 1);
        // Following pins the column's bottom to the hand's top edge; otherwise
        // the column is anchored and grown independently.
        let y = cfg.follow
            ? followFrom.anchorBottomY[side] - totalH
            : stackTopY(
                  stackAnchorY(cfg.anchor, cfg.offset, offsetY, drawH),
                  totalH,
                  cfg.growth
              );

        // Which frame edge cards slide in from (and out to). Following pins the
        // column to the hand's corner, so the player side is the near edge;
        // otherwise it follows the configured anchor, as the hand stack does.
        // Without this, a left player anchored right would slide its cards in
        // from the far side of the frame.
        const facesLeft = cfg.follow
            ? isLeft
            : stackFacesLeft(cfg.anchor, side);

        for (const box of boxes) {
            const finalX = cfg.follow
                ? isLeft
                    ? offsetX + 8
                    : offsetX + drawW - box.contW - 8
                : stackAnchorX(
                      cfg.anchor,
                      cfg.offset,
                      offsetX,
                      drawW,
                      box.contW
                  );
            const offscreenX = facesLeft
                ? offsetX - box.contW
                : offsetX + drawW;
            const firstStripY = y + CONT_PAD_Y + TITLE_AREA_H;
            const cumH = (list: LiveHandCard[], upTo: number) =>
                list.slice(0, upTo).reduce((s, c) => s + stripHOf(c, sw), 0);

            // Container modes: the whole box (background + all cards) slides as
            // one unit; cards do not animate individually.
            if (
                box.mode === 'container-enter' ||
                box.mode === 'container-exit'
            ) {
                const cards =
                    box.mode === 'container-enter'
                        ? box.liveCards
                        : box.preCards;
                const contX =
                    box.mode === 'container-enter'
                        ? offscreenX + (finalX - offscreenX) * box.containerT
                        : finalX + (offscreenX - finalX) * box.containerT;

                drawBackground(ctx, box.title, contX, y, box.contW, box.contH);
                for (let j = 0; j < cards.length; j++) {
                    const hc = cards[j];
                    drawCardStrip(
                        ctx,
                        { name: hc.card.name, ...(hc.edition ? { edition: hc.edition } : {}) },
                        contX,
                        firstStripY + cumH(cards, j),
                        isLeft,
                        null,
                        1,
                        hc.card.mana_cost,
                        hc.card.colors,
                        sw
                    );
                }
                if (box.hiddenCount > 0)
                    drawOverflowPill(
                        ctx,
                        contX + box.contW / 2,
                        y + box.contH,
                        box.hiddenCount,
                        sw
                    );
                y += box.contH + GAP;
                continue;
            }

            // Per-card: container fixed, individual cards enter/exit + reflow.
            drawBackground(ctx, box.title, finalX, y, box.contW, box.contH);

            const preIndexOf = new Map(
                box.preCards.map((c, idx) => [c.id, idx])
            );

            // Reflow progress for a surviving card: the slowest of the removals
            // sitting below it in the pre-stack (0 = just removed, 1 = settled).
            const reflowT = (preIndex: number) => {
                let t = 1;
                for (const a of box.exiting) {
                    const oi = a.oldIndex ?? box.preCards.length;
                    if (oi < preIndex) t = Math.min(t, animProgress(a, now));
                }
                return t;
            };

            // Surviving + entering cards (everything in the snapshot).
            for (let j = 0; j < box.liveCards.length; j++) {
                const hc = box.liveCards[j];
                const finalY = firstStripY + cumH(box.liveCards, j);

                let x = finalX;
                let alpha = 1;
                let cardY = finalY;
                const anim = anims.get(hc.id);
                if (anim && anim.phase === 'enter') {
                    const t = animProgress(anim, now);
                    x = offscreenX + (finalX - offscreenX) * t;
                    alpha = t;
                } else {
                    const pi = preIndexOf.get(hc.id) ?? j;
                    const preY = firstStripY + cumH(box.preCards, pi);
                    const t = reflowT(pi);
                    cardY = preY + (finalY - preY) * t;
                }

                drawCardStrip(
                    ctx,
                    { name: hc.card.name, ...(hc.edition ? { edition: hc.edition } : {}) },
                    x,
                    cardY,
                    isLeft,
                    null,
                    alpha,
                    hc.card.mana_cost,
                    hc.card.colors,
                    sw
                );
            }

            // Exiting cards: held at their old slot, sliding out and fading.
            for (const a of box.exiting) {
                const t = animProgress(a, now);
                const pi = preIndexOf.get(a.card.id) ?? box.preCards.length - 1;
                const preY = firstStripY + cumH(box.preCards, pi);
                const x = finalX + (offscreenX - finalX) * t;

                drawCardStrip(
                    ctx,
                    { name: a.card.card.name, ...(a.card.edition ? { edition: a.card.edition } : {}) },
                    x,
                    preY,
                    isLeft,
                    null,
                    1 - t,
                    a.card.card.mana_cost,
                    a.card.card.colors,
                    sw
                );
            }

            if (box.hiddenCount > 0)
                drawOverflowPill(
                    ctx,
                    finalX + box.contW / 2,
                    y + box.contH,
                    box.hiddenCount,
                    sw
                );

            y += box.contH + GAP;
        }
    }
}
