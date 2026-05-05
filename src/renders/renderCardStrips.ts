import { ensureBorderCrop } from '@/lib/cardCache';
import type { Card } from '@/components/types/card';

interface CropConfig {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scaleHeight?: true;
}

export const EDITION_CROPS: Record<
    string,
    CropConfig
> = {
    lea: { sx: 15, sy: 19, sw: 450, sh: 35 },
    leb: { sx: 15, sy: 19, sw: 450, sh: 35 },
    '2ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
    '3ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
};

export const FRAME_CROPS: Record<
    string,
    CropConfig
> = {
    '1993': { sx: 12, sy: 12, sw: 460, sh: 38, scaleHeight: true },
    '1997': { sx: 12, sy: 12, sw: 460, sh: 38, scaleHeight: true },
    '2003': { sx: 12, sy: 19, sw: 454, sh: 49 },
    '2015': { sx: 12, sy: 19, sw: 454, sh: 49 },
};

export const DEFAULT_CROP = { sx: 17, sy: 21, sw: 454, sh: 49 };
export const STRIP_W = 430;
export const STRIP_H_SCALE = 1.2;

export const ICON_GAP = 6;

export function getCardCrop(card: Card): CropConfig {
    const { frame } = ensureBorderCrop(card.name, card.edition);
    return (
        (card.edition ? EDITION_CROPS[card.edition] : undefined) ??
        FRAME_CROPS[frame ?? ''] ??
        DEFAULT_CROP
    );
}

export function getStripH(card: Card): number {
    const crop = getCardCrop(card);
    let stripH = Math.round((STRIP_W * crop.sh) / crop.sw);
    if (crop.scaleHeight) {
        stripH = Math.round(stripH * STRIP_H_SCALE);
    }
    return stripH;
}

export function drawCardStrip(
    ctx: CanvasRenderingContext2D,
    card: Card,
    x: number,
    y: number,
    isLeft: boolean,
    eyeIcon: HTMLImageElement | null = null,
    alpha = 1,
) {
    const { img } = ensureBorderCrop(card.name, card.edition);
    const crop = getCardCrop(card);
    const stripH = getStripH(card);
    const iconSize = Math.round(stripH * 0.7);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.rect(x, y, STRIP_W, stripH);
    ctx.clip();

    if (img instanceof HTMLImageElement) {
        ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x, y, STRIP_W, stripH);
    } else {
        ctx.fillStyle = '#3a0257';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(card.name, x + 10, Math.round(y + stripH / 2));
    }

    ctx.restore();

    if (card.revealed && eyeIcon) {
        const iconX = isLeft ? x + STRIP_W + ICON_GAP : x - ICON_GAP - iconSize;
        const iconY = y + Math.round((stripH - iconSize) / 2);
        ctx.save();
        ctx.globalAlpha = 0.6 * alpha;
        ctx.drawImage(eyeIcon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    }
}
