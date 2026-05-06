import type { Card } from '@/components/types/card';
import type { Player } from '@/components/types/player';
import { derivePlayerState } from '@/lib/deriveState';
import { STRIP_W, STRIP_H, drawCardStrip } from './renderCardStrips';

const CONT_PAD_X = 10;
const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;

const ANIM_DURATION = 0.35;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function contDims(cards: Card[]) {
    return {
        contW: STRIP_W + 2 * CONT_PAD_X,
        contH: CONT_PAD_Y + TITLE_AREA_H + cards.length * STRIP_H + CONT_PAD_Y,
    };
}

function drawContainer(
    ctx: CanvasRenderingContext2D,
    cards: Card[],
    contX: number,
    contY: number,
    contW: number,
    contH: number,
    isLeft: boolean,
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
    ctx.fillText('Cards on top of the deck', contX + contW / 2, contY + CONT_PAD_Y);
    ctx.restore();

    const stripX = contX + CONT_PAD_X;
    const firstStripY = contY + CONT_PAD_Y + TITLE_AREA_H;
    for (let j = 0; j < cards.length; j++) {
        drawCardStrip(ctx, cards[j], stripX, firstStripY + j * STRIP_H, isLeft);
    }
}

export function renderDeckStack(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    time: number,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    players.forEach((player, i) => {
        const isLeft = i === 0;
        const events = player.track.events;
        const state = derivePlayerState(player, events, time);

        const finalContX = (contW: number) =>
            isLeft ? offsetX + 8 : offsetX + drawW - contW - 8;
        const offscreenContX = (contW: number) =>
            isLeft ? offsetX - contW : offsetX + drawW;

        // Render current deck stack with enter animation.
        if (state.topStack && state.topStack.length > 0) {
            const cards = state.topStack;
            const { contW, contH } = contDims(cards);
            const finalX = finalContX(contW);
            const contY = offsetY + Math.round((drawH - contH) / 2);

            const lastStack = events
                .filter((e) => e.type === 'STACK_DECK' && e.time <= time)
                .sort((a, b) => b.time - a.time)[0];

            let contX = finalX;
            if (lastStack && time - lastStack.time < ANIM_DURATION) {
                const t = easeOut((time - lastStack.time) / ANIM_DURATION);
                contX = offscreenContX(contW) + (finalX - offscreenContX(contW)) * t;
            }

            drawContainer(ctx, cards, contX, contY, contW, contH, isLeft);
        }

        // Render exiting deck stack on UNSTACK_DECK.
        const recentUnstack = events.find(
            (e) => e.type === 'UNSTACK_DECK' && e.time <= time && e.time > time - ANIM_DURATION,
        );
        if (recentUnstack) {
            const preState = derivePlayerState(player, events, recentUnstack.time - 0.0001);
            if (preState.topStack && preState.topStack.length > 0) {
                const cards = preState.topStack;
                const { contW, contH } = contDims(cards);
                const finalX = finalContX(contW);
                const contY = offsetY + Math.round((drawH - contH) / 2);
                const t = easeOut((time - recentUnstack.time) / ANIM_DURATION);
                const contX = finalX + (offscreenContX(contW) - finalX) * t;
                drawContainer(ctx, cards, contX, contY, contW, contH, isLeft);
            }
        }
    });
}
