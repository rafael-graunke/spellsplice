import type { derivePlayerState } from '@/lib/deriveState';

export function renderPlayerState(
    ctx: CanvasRenderingContext2D,
    playerStates: (ReturnType<typeof derivePlayerState> | null)[],
    offsetX: number,
    offsetY: number,
    drawW: number
) {
    playerStates.forEach((state, i) => {
        if (!state) return;

        const boxW = 140;
        const boxH = 72;
        const boxX = i === 0 ? offsetX + 12 : offsetX + drawW - boxW - 12;
        const boxY = offsetY + 12;

        ctx.save();
        ctx.beginPath();
        ctx.fillStyle = '#dadadaff';
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(state.name, boxX + 10, boxY + 20);

        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(`♥  ${state.lifeTotal}`, boxX + 10, boxY + 42);
        ctx.fillStyle = '#000000';
        ctx.fillText(`✋  ${state.handSize}`, boxX + 10, boxY + 62);
        ctx.restore();
    });
}
