import type {
    CardDisplayAnchor,
    HandStackGrowth,
    Offset,
} from '@/lib/liveMode';
import { getStripH } from './renderCardStrips';

// Placement helpers shared by the hand stack and the annotation column. Both
// pin a vertical stack of card strips to a point on the 9-anchor grid, then
// grow it from that point, so the anchor math lives here rather than being
// duplicated (and drifting) between the two renderers.

// X of the stack's left edge, from the anchor's horizontal band plus its offset.
export function stackAnchorX(
    anchor: CardDisplayAnchor,
    offset: Offset | undefined,
    offsetX: number,
    drawW: number,
    stripW: number
): number {
    const horizontal = anchor.split('-')[1]; // left | center | right
    const base =
        horizontal === 'left'
            ? offsetX
            : horizontal === 'right'
              ? offsetX + drawW - stripW
              : offsetX + (drawW - stripW) / 2;
    return base + (offset?.x ?? 0);
}

// Y of the anchor line the stack is pinned to, before growth is applied.
// Independent of card count so the pinned edge stays put as cards come and go.
export function stackAnchorY(
    anchor: CardDisplayAnchor,
    offset: Offset | undefined,
    offsetY: number,
    drawH: number
): number {
    const vertical = anchor.split('-')[0]; // top | middle | bottom
    const base =
        vertical === 'top'
            ? offsetY
            : vertical === 'bottom'
              ? offsetY + drawH
              : offsetY + drawH / 2;
    return base + (offset?.y ?? 0);
}

// Whether cards face left (governs the revealed-eye icon side and the edge that
// enter/exit animations slide from). Center anchors face by player side.
export function stackFacesLeft(
    anchor: CardDisplayAnchor,
    side: 'left' | 'right'
): boolean {
    const horizontal = anchor.split('-')[1];
    return horizontal === 'center' ? side === 'left' : horizontal === 'left';
}

// Top Y of a stack of total height `totalH` pinned at `anchorY`. top-down grows
// down from the anchor, bottom-up grows up, center straddles it.
export function stackTopY(
    anchorY: number,
    totalH: number,
    growth: HandStackGrowth
): number {
    if (growth === 'top-down') return anchorY;
    if (growth === 'center') return anchorY - totalH / 2;
    return anchorY - totalH; // bottom-up
}

// How many cards fit under a height cap, in px. Cards nearest the anchor (the
// array prefix) are kept; once the cumulative strip height would exceed the cap
// the rest are hidden. At least one card always shows. cap <= 0 = no cap.
export function visibleStripCount(
    cards: Array<{ card: { name: string } }>,
    stripW: number,
    cap: number | undefined
): number {
    if (!cap || cap <= 0) return cards.length;
    let acc = 0;
    let count = 0;
    for (const { card } of cards) {
        const h = getStripH({ name: card.name }, stripW);
        if (acc + h > cap && count > 0) break;
        acc += h;
        count++;
    }
    return count;
}

// Small rounded `+N` pill summarising a hidden overflow tail, centered
// horizontally on the stack and straddling the growth (overflow) edge.
export function drawOverflowPill(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    count: number,
    stripW: number
) {
    const text = `+${count}`;
    const fontSize = Math.max(14, Math.round(stripW * 0.05));
    ctx.save();
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const padX = fontSize * 0.6;
    const w = ctx.measureText(text).width + padX * 2;
    const h = Math.round(fontSize * 1.5);
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, cy + 1);
    ctx.restore();
}
