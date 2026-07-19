import type { LiveHandCard } from '@/lib/liveMode';
import { getStripH, drawCardStrip } from './renderCardStrips';

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
}

// Builds the render boxes for one side. A slot is rendered when it holds cards
// in the snapshot OR still has a card animating out (so the exit can play even
// after the snapshot dropped it).
function buildBoxes(
    annotations: Record<string, LiveAnnotationData>,
    isLeft: boolean,
    stripW: number,
    anims: Map<string, AnnotationAnim>,
    now: number
): Box[] {
    const side: 'left' | 'right' = isLeft ? 'left' : 'right';
    const boxes: Box[] = [];

    for (const [annotationId, data] of Object.entries(annotations)) {
        const liveCards = isLeft ? data.left : data.right;
        const snapshotIds = new Set(liveCards.map((c) => c.id));
        const exiting = [...anims.values()].filter(
            (a) =>
                a.side === side &&
                a.phase === 'exit' &&
                a.annotationId === annotationId &&
                !snapshotIds.has(a.card.id)
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

        const preCards: LiveHandCard[] = [...liveCards];
        for (const a of [...exiting].sort(
            (x, y) =>
                (x.oldIndex ?? preCards.length) -
                (y.oldIndex ?? preCards.length)
        )) {
            const oi = Math.min(a.oldIndex ?? preCards.length, preCards.length);
            preCards.splice(oi, 0, a.card);
        }

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
    drawW: number,
    anchorBottomY: { left: number; right: number },
    stripW: { left: number; right: number },
    anims: Map<string, AnnotationAnim> = new Map(),
    now = 0
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const isLeft of [true, false]) {
        // Match this side's hand strip width so annotations align with the hand.
        const sw = isLeft ? stripW.left : stripW.right;
        const boxes = buildBoxes(annotations, isLeft, sw, anims, now);
        if (boxes.length === 0) continue;

        const totalH =
            boxes.reduce((s, b) => s + b.contH, 0) + GAP * (boxes.length - 1);
        let y = (isLeft ? anchorBottomY.left : anchorBottomY.right) - totalH;

        for (const box of boxes) {
            const finalX = isLeft
                ? offsetX + 8
                : offsetX + drawW - box.contW - 8;
            const offscreenX = isLeft ? offsetX - box.contW : offsetX + drawW;
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
                        { name: hc.card.name },
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
                    { name: hc.card.name },
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
                    { name: a.card.card.name },
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

            y += box.contH + GAP;
        }
    }
}
