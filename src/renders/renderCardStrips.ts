import { ensureBorderCrop } from '@/lib/cardCache';
import { CARD_COLOR_HEX, getCardColorKey } from '@/lib/cardColors';
import { drawManaCostRow, ensureManaFontLoaded } from '@/lib/manaGlyphs';
import type { Card } from '@/components/types/card';

const PLACEHOLDER_TEXT = '#262626';

interface CropConfig {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
    scaleHeight?: boolean;
    curveClip?: boolean;
}

export const EDITION_CROPS: Record<
    string,
    CropConfig
> = {
    lea: { sx: 15, sy: 19, sw: 450, sh: 35, scaleHeight: true },
    leb: { sx: 15, sy: 19, sw: 450, sh: 35, scaleHeight: true },
    '2ed': { sx: 15, sy: 19, sw: 450, sh: 35, scaleHeight: true },
    '3ed': { sx: 15, sy: 19, sw: 450, sh: 35, scaleHeight: true },
};

export const FRAME_CROPS: Record<
    string,
    CropConfig
> = {
    '1993': { sx: 12, sy: 12, sw: 458, sh: 38, scaleHeight: true },
    '1997': { sx: 12, sy: 12, sw: 458, sh: 38, scaleHeight: true },
    '2003': { sx: 14, sy: 19, sw: 450, sh: 49, curveClip: true },
    '2015': { sx: 14, sy: 19, sw: 450, sh: 49, curveClip: true },
};

export const DEFAULT_CROP: CropConfig = { sx: 14, sy: 19, sw: 450, sh: 49, curveClip: false };
export const STRIP_W = 430;
export const STRIP_H_SCALE = 1.15;
export const STRIP_CURVE_W = 13;

export const ICON_GAP = 6;

function clipStripPath(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    curveW: number,
) {
    ctx.moveTo(x + curveW, y);
    ctx.ellipse(x + curveW, y + h / 2, curveW, h / 2, 0, -Math.PI / 2, Math.PI / 2, true);
    ctx.lineTo(x + w - curveW, y + h);
    ctx.ellipse(x + w - curveW, y + h / 2, curveW, h / 2, 0, Math.PI / 2, -Math.PI / 2, true);
    ctx.closePath();
}

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
    manaCost?: string,
    colors?: string[],
) {
    const { img } = ensureBorderCrop(card.name, card.edition);
    const crop = getCardCrop(card);
    const stripH = getStripH(card);
    const iconSize = Math.round(stripH * 0.7);
    const placeholderBg = CARD_COLOR_HEX[getCardColorKey(colors)];
    if (manaCost && !(img instanceof HTMLImageElement)) ensureManaFontLoaded();

    if (crop.curveClip) {
        // fill() is anti-aliased; clip() is not. Use an offscreen canvas + destination-in mask.
        const tmp = new OffscreenCanvas(STRIP_W, stripH);
        const tmpCtx = tmp.getContext('2d')!;
        tmpCtx.imageSmoothingEnabled = true;
        tmpCtx.imageSmoothingQuality = 'high';

        if (img instanceof HTMLImageElement) {
            tmpCtx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, STRIP_W, stripH);
        } else {
            tmpCtx.fillStyle = placeholderBg;
            tmpCtx.fillRect(0, 0, STRIP_W, stripH);
            tmpCtx.fillStyle = PLACEHOLDER_TEXT;
            tmpCtx.font = 'bold 22px sans-serif';
            tmpCtx.textBaseline = 'middle';
            tmpCtx.textAlign = 'left';
            tmpCtx.fillText(card.name, 10, Math.round(stripH / 2));
            if (manaCost) {
                drawManaCostRow(tmpCtx, manaCost, STRIP_W - 10, Math.round(stripH / 2), stripH * 0.32);
            }
        }

        tmpCtx.globalCompositeOperation = 'destination-in';
        tmpCtx.beginPath();
        clipStripPath(tmpCtx, 0, 0, STRIP_W, stripH, STRIP_CURVE_W);
        tmpCtx.fill();

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(tmp, x, y);
        ctx.restore();
    } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.rect(x, y, STRIP_W, stripH);
        ctx.clip();

        if (img instanceof HTMLImageElement) {
            ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, x, y, STRIP_W, stripH);
        } else {
            ctx.fillStyle = placeholderBg;
            ctx.fill();
            ctx.fillStyle = PLACEHOLDER_TEXT;
            ctx.font = 'bold 22px sans-serif';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            ctx.fillText(card.name, x + 10, Math.round(y + stripH / 2));
            if (manaCost) {
                drawManaCostRow(ctx, manaCost, x + STRIP_W - 10, Math.round(y + stripH / 2), stripH * 0.32);
            }
        }

        ctx.restore();
    }

    if (card.revealed && eyeIcon) {
        const iconX = isLeft ? x + STRIP_W + ICON_GAP : x - ICON_GAP - iconSize;
        const iconY = y + Math.round((stripH - iconSize) / 2);
        ctx.save();
        ctx.globalAlpha = 0.6 * alpha;
        ctx.drawImage(eyeIcon, iconX, iconY, iconSize, iconSize);
        ctx.restore();
    }
}
