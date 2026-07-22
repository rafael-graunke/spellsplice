import type { Card } from '@/components/types/card';
import type { Player } from '@/components/types/player';
import type { AnnotationSlot } from '@/components/types/config';
import { deriveAnnotationsWithExits } from '@/lib/deriveState';
import { STRIP_W, getStripH, drawCardStrip } from './renderCardStrips';

const CONT_PAD_X = 10;
const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;
const BOX_GAP = 16;

const ANIM_DURATION = 0.35;
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const CONT_W = STRIP_W + 2 * CONT_PAD_X;

function humanize(id: string): string {
    return id
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    contX: number,
    contY: number,
    contW: number,
    contH: number,
    title: string,
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

// Slot render modes mirror live mode (renderLiveAnnotation.ts):
// - enter: slot went empty -> non-empty; the whole box slides in as a unit.
// - exit: slot went non-empty -> empty; the whole box slides out as a unit.
// - per-card: box stays put, only the changed card slides.
type BoxMode = 'enter' | 'exit' | 'per-card';

interface Box {
    slotId: string;
    mode: BoxMode;
    containerT: number; // slide progress for container modes (0..1)
    current: { card: Card; enteredAt: number }[];
    exiting: Card[];
    exitTime: number | null;
    stripHs: number[]; // strip heights, current cards then exiting cards
    stackH: number; // reserved stack height (exiting height decays in per-card)
    contH: number;
}

export function renderAnnotations(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    time: number,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    slots: AnnotationSlot[] = [],
    uiVisibility = 1,
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const titleFor = (id: string) => slots.find((s) => s.id === id)?.title ?? humanize(id);

    players.forEach((player, i) => {
        const isLeft = i === 0;
        const { slots: annotations, exits } = deriveAnnotationsWithExits(
            player.track.events,
            time,
            ANIM_DURATION,
        );

        // Assemble boxes to draw, in registry order (unknown slots appended).
        const slotIds = [
            ...slots.map((s) => s.id),
            ...Object.keys(annotations).filter((id) => !slots.some((s) => s.id === id)),
        ];

        const boxes: Box[] = [];
        for (const slotId of slotIds) {
            const current = annotations[slotId] ?? [];
            const exit = exits[slotId];
            const exiting = exit ? exit.removed : [];
            if (current.length === 0 && exiting.length === 0) continue;

            // Determine mode. Container-enter: every current card is animating in
            // and nothing is leaving (the box just appeared). Container-exit: no
            // cards remain but some are still sliding out (the box is leaving).
            const allEntering =
                current.length > 0 && current.every((c) => time - c.enteredAt < ANIM_DURATION);
            let mode: BoxMode;
            let containerT = 1;
            if (current.length > 0 && !exit && allEntering) {
                mode = 'enter';
                const latest = current.reduce((m, c) => Math.max(m, c.enteredAt), -Infinity);
                containerT = easeOut(clamp01((time - latest) / ANIM_DURATION));
            } else if (current.length === 0 && exiting.length > 0 && exit) {
                mode = 'exit';
                containerT = easeOut(clamp01((time - exit.time) / ANIM_DURATION));
            } else {
                mode = 'per-card';
            }

            const stripHs = [
                ...current.map((c) => getStripH(c.card)),
                ...exiting.map((card) => getStripH(card)),
            ];
            const currentH = stripHs
                .slice(0, current.length)
                .reduce((a, b) => a + b, 0);
            const exitingH = stripHs.slice(current.length).reduce((a, b) => a + b, 0);

            // In container modes the riding cards are all of current (enter) or
            // all of exiting (exit). In per-card the exiting height decays as the
            // cards leave, so the box shrinks smoothly instead of snapping.
            let stackH: number;
            if (mode === 'enter') stackH = currentH;
            else if (mode === 'exit') stackH = exitingH;
            else {
                const te = exit ? easeOut(clamp01((time - exit.time) / ANIM_DURATION)) : 1;
                stackH = currentH + exitingH * (1 - te);
            }

            boxes.push({
                slotId,
                mode,
                containerT,
                current,
                exiting,
                exitTime: exit ? exit.time : null,
                stripHs,
                stackH,
                contH: CONT_PAD_Y + TITLE_AREA_H + stackH + CONT_PAD_Y,
            });
        }
        if (boxes.length === 0) return;

        // Vertically center the stack of boxes as a group.
        const totalH =
            boxes.reduce((a, b) => a + b.contH, 0) + BOX_GAP * (boxes.length - 1);

        const slideX = (isLeft ? -1 : 1) * 500 * (1 - uiVisibility);
        const finalX = isLeft ? offsetX + 8 : offsetX + drawW - CONT_W - 8;
        // Whole-container off-screen position (for enter/exit slides).
        const offscreenContX = isLeft ? offsetX - CONT_W : offsetX + drawW;
        // Single-strip off-screen position (for per-card slides).
        const offscreenStripX = isLeft ? offsetX - STRIP_W : offsetX + drawW;

        ctx.save();
        ctx.translate(slideX, 0);

        let boxY = offsetY + Math.round((drawH - totalH) / 2);
        for (const box of boxes) {
            const firstStripY = boxY + CONT_PAD_Y + TITLE_AREA_H;

            // Prefix sum of strip heights: cumY[k] is the top offset of strip k.
            const cum: number[] = [0];
            for (let m = 0; m < box.stripHs.length; m++) cum.push(cum[m] + box.stripHs[m]);
            const cumY = (k: number) => cum[k];

            if (box.mode === 'enter' || box.mode === 'exit') {
                // Whole box (background + all cards) slides as one unit.
                const contX =
                    box.mode === 'enter'
                        ? offscreenContX + (finalX - offscreenContX) * box.containerT
                        : finalX + (offscreenContX - finalX) * box.containerT;
                const stripX = contX + CONT_PAD_X;

                drawBackground(ctx, contX, boxY, CONT_W, box.contH, titleFor(box.slotId));

                const cards =
                    box.mode === 'enter'
                        ? box.current.map((c) => c.card)
                        : box.exiting;
                const base = box.mode === 'enter' ? 0 : box.current.length;
                cards.forEach((card, j) => {
                    drawCardStrip(ctx, card, stripX, firstStripY + cumY(base + j), isLeft);
                });

                boxY += box.contH + BOX_GAP;
                continue;
            }

            // Per-card: container fixed; individual cards slide.
            const stripX = finalX + CONT_PAD_X;
            drawBackground(ctx, finalX, boxY, CONT_W, box.contH, titleFor(box.slotId));

            box.current.forEach((entry, j) => {
                const y = firstStripY + cumY(j);
                const age = time - entry.enteredAt;
                if (age < ANIM_DURATION) {
                    const t = easeOut(age / ANIM_DURATION);
                    const x = offscreenStripX + (stripX - offscreenStripX) * t;
                    drawCardStrip(ctx, entry.card, x, y, isLeft, null, t);
                } else {
                    drawCardStrip(ctx, entry.card, stripX, y, isLeft);
                }
            });

            if (box.exiting.length > 0 && box.exitTime != null) {
                const t = easeOut(clamp01((time - box.exitTime) / ANIM_DURATION));
                const x = stripX + (offscreenStripX - stripX) * t;
                box.exiting.forEach((card, k) => {
                    drawCardStrip(ctx, card, x, firstStripY + cumY(box.current.length + k), isLeft, null, 1 - t);
                });
            }

            boxY += box.contH + BOX_GAP;
        }

        ctx.restore();
    });
}
