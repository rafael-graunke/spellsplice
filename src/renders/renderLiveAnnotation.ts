import type { Card } from '@/components/types/card';
import type { LiveHandCard } from '@/lib/liveMode';
import { getStripH, drawCardStrip } from './renderCardStrips';

const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;
const GAP = 12;

export interface LiveAnnotationData {
    title: string;
    left: LiveHandCard[];
    right: LiveHandCard[];
}

const stackH = (cards: Card[], stripW: number, upTo = cards.length) =>
    cards.slice(0, upTo).reduce((s, c) => s + getStripH(c, stripW), 0);

function contDims(cards: Card[], stripW: number) {
    return {
        contW: stripW,
        contH: CONT_PAD_Y + TITLE_AREA_H + stackH(cards, stripW),
    };
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    title: string,
    contX: number,
    contY: number,
    contW: number,
    contH: number,
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

interface Box {
    title: string;
    liveCards: LiveHandCard[];
    cards: Card[];
    contW: number;
    contH: number;
}

function buildBoxes(annotations: LiveAnnotationData[], isLeft: boolean, stripW: number): Box[] {
    const boxes: Box[] = [];
    for (const { title, left, right } of annotations) {
        const liveCards = isLeft ? left : right;
        if (liveCards.length === 0) continue;
        const cards: Card[] = liveCards.map(({ card }) => ({ name: card.name }));
        const { contW, contH } = contDims(cards, stripW);
        boxes.push({ title, liveCards, cards, contW, contH });
    }
    return boxes;
}

export function renderLiveAnnotations(
    ctx: CanvasRenderingContext2D,
    annotations: LiveAnnotationData[],
    offsetX: number,
    drawW: number,
    anchorBottomY: { left: number; right: number },
    stripW: number,
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (const isLeft of [true, false]) {
        const boxes = buildBoxes(annotations, isLeft, stripW);
        if (boxes.length === 0) continue;

        const totalH = boxes.reduce((s, b) => s + b.contH, 0) + GAP * (boxes.length - 1);
        let y = (isLeft ? anchorBottomY.left : anchorBottomY.right) - totalH;

        for (const box of boxes) {
            const contX = isLeft ? offsetX + 8 : offsetX + drawW - box.contW - 8;

            drawBackground(ctx, box.title, contX, y, box.contW, box.contH);

            const stripX = contX;
            const firstStripY = y + CONT_PAD_Y + TITLE_AREA_H;
            for (let j = 0; j < box.cards.length; j++) {
                const sy = firstStripY + stackH(box.cards, stripW, j);
                drawCardStrip(
                    ctx,
                    box.cards[j],
                    stripX,
                    sy,
                    isLeft,
                    null,
                    1,
                    box.liveCards[j].card.mana_cost,
                    box.liveCards[j].card.colors,
                    stripW,
                );
            }

            y += box.contH + GAP;
        }
    }
}
