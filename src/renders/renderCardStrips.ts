import { ensureBorderCrop } from '@/lib/cardCache';
import type { Card } from '@/components/types/card';

export const EDITION_CROPS: Record<
    string,
    { sx: number; sy: number; sw: number; sh: number }
> = {
    lea: { sx: 15, sy: 19, sw: 450, sh: 35 },
    leb: { sx: 15, sy: 19, sw: 450, sh: 35 },
    '2ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
    '3ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
};

export const FRAME_CROPS: Record<
    string,
    { sx: number; sy: number; sw: number; sh: number }
> = {
    '1993': { sx: 12, sy: 12, sw: 460, sh: 38 },
    '1997': { sx: 12, sy: 12, sw: 460, sh: 38 },
    '2003': { sx: 17, sy: 21, sw: 446, sh: 42 },
    '2015': { sx: 17, sy: 21, sw: 446, sh: 42 },
};

export const DEFAULT_CROP = { sx: 17, sy: 21, sw: 446, sh: 42 };

export const STRIP_W = 430;
export const STRIP_H = Math.round((STRIP_W * 42) / 446);

export const ICON_SIZE = Math.round(STRIP_H * 0.7);
export const ICON_GAP = 6;

export function drawCardStrip(
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    isLeft: boolean,
    eyeIcon: HTMLImageElement | null = null,
    alpha = 1,
) {
    const { img, frame } = ensureBorderCrop(card.name, card.edition);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.rect(x, y, STRIP_W, STRIP_H);
    ctx.clip();

    if (img instanceof HTMLImageElement) {
        const crop =
            (card.edition ? EDITION_CROPS[card.edition] : undefined) ??
            FRAME_CROPS[frame ?? ''] ??
            DEFAULT_CROP;
        ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x, y, STRIP_W, STRIP_H);
    } else {
        ctx.fillStyle = '#3a0257';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(card.name, x + 10, Math.round(y + STRIP_H / 2));
    }

    ctx.restore();

    if (card.revealed && eyeIcon) {
        const iconX = isLeft ? x + STRIP_W + ICON_GAP : x - ICON_GAP - ICON_SIZE;
        const iconY = y + Math.round((STRIP_H - ICON_SIZE) / 2);
        ctx.save();
        ctx.globalAlpha = 0.6 * alpha;
        ctx.drawImage(eyeIcon, iconX, iconY, ICON_SIZE, ICON_SIZE);
        ctx.restore();
    }
}
