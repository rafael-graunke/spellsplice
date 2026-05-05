import type { derivePlayerState } from '@/lib/deriveState';
import { STRIP_W, STRIP_H, drawCardStrip } from './renderCardStrips';

const CONT_PAD_X = 10;
const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;

export function renderDeckStack(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    playerStates.forEach((state, i) => {
        if (!state || !state.topStack || state.topStack.length === 0) return;

        const isLeft = i === 0;
        const cards = state.topStack;

        const contW = STRIP_W + 2 * CONT_PAD_X;
        const contH = CONT_PAD_Y + TITLE_AREA_H + cards.length * STRIP_H + CONT_PAD_Y;
        const contX = isLeft
            ? offsetX + 8
            : offsetX + drawW - contW - 8;
        const contY = offsetY + Math.round((drawH - contH) / 2);

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
        ctx.fillText('Cards on top of the deck', contX + contW / 2, contY + CONT_PAD_Y);
        ctx.restore();

        const stripX = contX + CONT_PAD_X;
        const firstStripY = contY + CONT_PAD_Y + TITLE_AREA_H;

        for (let j = 0; j < cards.length; j++) {
            drawCardStrip(ctx, cards[j], stripX, firstStripY + j * STRIP_H, isLeft);
        }
    });
}
