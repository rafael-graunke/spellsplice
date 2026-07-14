import { ensureBackImage, ensureImage } from '@/lib/cardCache';
import { isMultiFaceLayout } from '@/lib/oracleCards';
import type { LiveDisplayCard } from '@/lib/liveMode';

const TOP_GAP = 24;
const SIDE_GAP = 8; // matches the hand/annotation card strips' side padding
const CORNER_SCALE = 0.05;
const CARD_ASPECT = 223 / 310;

function drawCard(
    ctx: CanvasRenderingContext2D,
    liveCard: LiveDisplayCard | null,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    if (!liveCard) return;
    const img =
        liveCard.flipped && isMultiFaceLayout(liveCard.card.layout)
            ? (ensureBackImage(liveCard.card.name) ?? ensureImage(liveCard.card.name))
            : ensureImage(liveCard.card.name);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, w * CORNER_SCALE);
    ctx.clip();
    if (img instanceof HTMLImageElement) {
        ctx.drawImage(img, x, y, w, h);
    } else {
        ctx.fillStyle = '#3a0257';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(h * 0.05)}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(liveCard.card.name, x + 16, y + 16);
    }
    ctx.restore();
}

export function renderLiveCardDisplay(
    ctx: CanvasRenderingContext2D,
    left: LiveDisplayCard | null,
    right: LiveDisplayCard | null,
    offsetX: number,
    offsetY: number,
    drawW: number,
    stripW: number,
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cardW = stripW;
    const cardH = cardW / CARD_ASPECT;
    const y = offsetY + TOP_GAP;

    drawCard(ctx, left, offsetX + SIDE_GAP, y, cardW, cardH);
    drawCard(ctx, right, offsetX + drawW - cardW - SIDE_GAP, y, cardW, cardH);
}
