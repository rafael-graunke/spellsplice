import type { derivePlayerState } from '@/lib/deriveState';

export function renderPlayerState(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number,
    _drawH: number,
    d20Img: HTMLImageElement | null
) {
    playerStates.forEach((state, i) => {
        if (!state) return;

        const isLeft = i === 0;
        const boxH = 100;
        const boxW = 350;
        const slantW = 44;
        const topY = offsetY;
        const bottomY = topY + boxH;
        const rx = offsetX + drawW;

        ctx.save();
        ctx.beginPath();

        if (isLeft) {
            ctx.moveTo(offsetX, topY);
            ctx.lineTo(offsetX + boxW + slantW, topY);
            ctx.lineTo(offsetX + boxW, bottomY);
            ctx.lineTo(offsetX, bottomY);
        } else {
            ctx.moveTo(rx - boxW - slantW, topY);
            ctx.lineTo(rx, topY);
            ctx.lineTo(rx, bottomY);
            ctx.lineTo(rx - boxW, bottomY);
        }

        ctx.closePath();
        ctx.fillStyle = '#3a0257';
        ctx.fill();

        const d20Size = boxH - 12;
        const midY = topY + boxH / 2;

        // Player 1: D20 right, name left. Player 2: D20 left, name right.
        const d20X = isLeft
            ? offsetX + boxW - d20Size - 16
            : rx - boxW + 16;
        const d20Y = topY + 6;

        if (d20Img) ctx.drawImage(d20Img, d20X, d20Y, d20Size, d20Size);

        ctx.font = `bold ${Math.round(d20Size * 0.35)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#3a0257';
        ctx.fillText(String(state.lifeTotal), d20X + d20Size / 2, d20Y + d20Size / 2);

        const nameX = isLeft
            ? offsetX + 16
            : rx - boxW + d20Size + 28;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = isLeft ? 'left' : 'left';
        ctx.fillText(state.name.toUpperCase(), nameX, midY - 15);
        ctx.fillStyle = '#bbbbbb';
        ctx.fillText(`(${state.deckName || 'Unnamed Deck'})`, nameX, midY + 15);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.restore();
    });
}
