import type { derivePlayerState } from '@/lib/deriveState';
import { ensureBorderCrop } from '@/lib/cardCache';

const EDITION_CROPS: Record<
    string,
    { sx: number; sy: number; sw: number; sh: number }
> = {
    lea: { sx: 15, sy: 19, sw: 450, sh: 35 },
    leb: { sx: 15, sy: 19, sw: 450, sh: 35 },
    '2ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
    '3ed': { sx: 15, sy: 19, sw: 450, sh: 35 },
};

const FRAME_CROPS: Record<
    string,
    { sx: number; sy: number; sw: number; sh: number }
> = {
    '1993': { sx: 12, sy: 12, sw: 460, sh: 38 },
    '1997': { sx: 12, sy: 12, sw: 460, sh: 38 },
    '2003': { sx: 17, sy: 21, sw: 446, sh: 42 },
    '2015': { sx: 17, sy: 21, sw: 446, sh: 42 },
};
const DEFAULT_CROP = { sx: 17, sy: 21, sw: 446, sh: 42 };

const STRIP_W = 430;
const STRIP_H = Math.round((STRIP_W * 42) / 446);

const ICON_SIZE = Math.round(STRIP_H * 0.7);
const ICON_GAP = 6;

export function renderHandStack(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    eyeIcon: HTMLImageElement | null
) {
    const bottomY = offsetY + drawH;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    playerStates.forEach((state, i) => {
        if (!state || state.cards.length === 0) return;

        const isLeft = i === 0;
        const x = isLeft ? offsetX : offsetX + drawW - STRIP_W;

        for (let j = 0; j < state.cards.length; j++) {
            const card = state.cards[j];
            const cardName = card.name;
            const y = bottomY - (j + 1) * STRIP_H;
            const { img, frame } = ensureBorderCrop(cardName, card.edition);

            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, STRIP_W, STRIP_H);
            ctx.clip();

            if (img instanceof HTMLImageElement) {
                const crop =
                    (card.edition ? EDITION_CROPS[card.edition] : undefined) ??
                    FRAME_CROPS[frame ?? ''] ??
                    DEFAULT_CROP;
                ctx.drawImage(
                    img,
                    crop.sx,
                    crop.sy,
                    crop.sw,
                    crop.sh,
                    x,
                    y,
                    STRIP_W,
                    STRIP_H
                );
            } else {
                ctx.fillStyle = '#3a0257';
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 18px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(cardName, x + 10, Math.round(y + STRIP_H / 2));
            }

            ctx.restore();

            if (card.revealed && eyeIcon) {
                const iconX = isLeft
                    ? x + STRIP_W + ICON_GAP
                    : x - ICON_GAP - ICON_SIZE;
                const iconY = y + Math.round((STRIP_H - ICON_SIZE) / 2);
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.drawImage(eyeIcon, iconX, iconY, ICON_SIZE, ICON_SIZE);
                ctx.restore();
            }
        }
    });
}
