import type { derivePlayerState } from '@/lib/deriveState';
import { ensureImage } from '@/lib/cardCache';

const STRIP_W = 240;
const TITLE_CROP = 0.10;
const BORDER_RADIUS = STRIP_W * 0.05;
// Expected strip height for standard Scryfall normal images (488×680)
const STRIP_H = Math.round(STRIP_W * (680 * TITLE_CROP) / 488);
// Extra height drawn below each strip to fill under the rounded corners of the card above
const OVERLAP = BORDER_RADIUS;

export function renderHandStack(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number
) {
    const bottomY = offsetY + drawH - 8;

    playerStates.forEach((state, i) => {
        if (!state || state.cards.length === 0) return;

        const isLeft = i === 0;
        const x = isLeft ? offsetX + 8 : offsetX + drawW - STRIP_W - 8;

        // Render newest first so older cards paint on top, covering rounded corner gaps
        for (let j = state.cards.length - 1; j >= 0; j--) {
            const cardName = state.cards[j];
            const y = bottomY - (j + 1) * STRIP_H;
            const img = ensureImage(cardName);

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, STRIP_W, STRIP_H + OVERLAP, [BORDER_RADIUS, BORDER_RADIUS, 0, 0]);
            ctx.clip();

            if (img instanceof HTMLImageElement) {
                const destH = STRIP_H + OVERLAP;
                const srcH = (destH / STRIP_W) * img.naturalWidth;
                ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, x, y, STRIP_W, destH);
            } else {
                ctx.fillStyle = '#2e4a6b';
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(cardName, x + 10, y + STRIP_H / 2);
            }

            ctx.restore();
        }
    });
}
