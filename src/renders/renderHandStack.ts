import type { derivePlayerState } from '@/lib/deriveState';
import { STRIP_W, STRIP_H, drawCardStrip } from './renderCardStrips';

export function renderHandStack(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    eyeIcon: HTMLImageElement | null
) {
    const bottomY = offsetY + drawH - 8;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    playerStates.forEach((state, i) => {
        if (!state || state.cards.length === 0) return;

        const isLeft = i === 0;
        const x = isLeft ? offsetX + 8 : offsetX + drawW - STRIP_W - 8;

        for (let j = 0; j < state.cards.length; j++) {
            const card = state.cards[j];
            const y = bottomY - (j + 1) * STRIP_H;
            drawCardStrip(ctx, card, x, y, isLeft, eyeIcon);
        }
    });
}
