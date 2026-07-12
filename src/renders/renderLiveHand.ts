import type { Card } from '@/components/types/card';
import type { LiveHandCard } from '@/lib/liveMode';
import { STRIP_W, getStripH, drawCardStrip } from './renderCardStrips';

export function getHandStackTopY(hand: LiveHandCard[], offsetY: number, drawH: number): number {
    const bottomY = offsetY + drawH - 20;
    const totalH = hand.reduce((s, { card }) => s + getStripH({ name: card.name }), 0);
    return bottomY - totalH;
}

export function renderLiveHand(
    ctx: CanvasRenderingContext2D,
    left: LiveHandCard[],
    right: LiveHandCard[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
) {
    const bottomY = offsetY + drawH - 20;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sides: Array<{ hand: LiveHandCard[]; isLeft: boolean }> = [
        { hand: left, isLeft: true },
        { hand: right, isLeft: false },
    ];

    for (const { hand, isLeft } of sides) {
        const finalX = isLeft ? offsetX + 8 : offsetX + drawW - STRIP_W - 8;
        const cards: Card[] = hand.map(({ card }) => ({ name: card.name }));
        const stackH = (upTo: number) => cards.slice(0, upTo).reduce((s, c) => s + getStripH(c), 0);

        for (let j = 0; j < cards.length; j++) {
            const y = bottomY - stackH(j + 1);
            drawCardStrip(ctx, cards[j], finalX, y, isLeft, null, 1, hand[j].card.mana_cost, hand[j].card.colors);
        }
    }
}
