import { ensureBackImage, ensureImage } from '@/lib/cardCache';
import { isMultiFaceLayout } from '@/lib/oracleCards';
import type {
    LiveDisplayCard,
    SingleCardDisplayConfig,
    LiveCardDisplayConfig,
    CardDisplayAnimation,
    SlideDirection,
} from '@/lib/liveMode';
import { defaultLiveCardDisplayConfig } from '@/lib/liveMode';

const CORNER_SCALE = 0.05;
const CARD_ASPECT = 223 / 310;

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Enter slides the card in from its off-edge to the anchored spot / fades it up;
// exit reverses. `card` is held here so the exiting card can still draw after
// the snapshot has already cleared it. `anim` is a snapshot of the side's
// animation config taken when the animation started.
export interface DisplayAnim {
    phase: 'enter' | 'exit';
    start: number;
    card: LiveDisplayCard;
    anim: CardDisplayAnimation;
}

interface Point {
    x: number;
    y: number;
}

// Resolve the top-left draw origin for a card of size cardW x cardH from a
// 9-anchor + signed offset config, within the drawW x drawH region. The anchor
// gives the flush base position; the offset (+x right, +y down) nudges from it.
function anchorOrigin(
    config: SingleCardDisplayConfig,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    cardW: number,
    cardH: number
): Point {
    const { anchor } = config;
    const dx = config.offset?.x ?? 0;
    const dy = config.offset?.y ?? 0;
    const baseX = anchor.endsWith('left')
        ? offsetX
        : anchor.endsWith('right')
          ? offsetX + drawW - cardW
          : offsetX + (drawW - cardW) / 2;
    const baseY = anchor.startsWith('top')
        ? offsetY
        : anchor.startsWith('bottom')
          ? offsetY + drawH - cardH
          : offsetY + (drawH - cardH) / 2;
    return { x: baseX + dx, y: baseY + dy };
}

// Fully off the given edge, other axis held at the final position, so the card
// always starts/ends completely offscreen regardless of the anchor.
function offscreenOrigin(
    direction: SlideDirection,
    final: Point,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    cardW: number,
    cardH: number
): Point {
    switch (direction) {
        case 'left':
            return { x: offsetX - cardW, y: final.y };
        case 'right':
            return { x: offsetX + drawW, y: final.y };
        case 'top':
            return { x: final.x, y: offsetY - cardH };
        case 'bottom':
            return { x: final.x, y: offsetY + drawH };
    }
}

function drawCard(
    ctx: CanvasRenderingContext2D,
    liveCard: LiveDisplayCard | null,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha = 1
) {
    if (!liveCard) return;
    const img =
        liveCard.flipped && isMultiFaceLayout(liveCard.card.layout)
            ? (ensureBackImage(liveCard.card.name, liveCard.edition) ??
              ensureImage(liveCard.card.name, liveCard.edition))
            : ensureImage(liveCard.card.name, liveCard.edition);

    ctx.save();
    ctx.globalAlpha = alpha;
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

function drawSide(
    ctx: CanvasRenderingContext2D,
    sideCard: LiveDisplayCard | null,
    config: SingleCardDisplayConfig,
    animEntry: DisplayAnim | null,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    cardW: number,
    cardH: number,
    now: number
) {
    const final = anchorOrigin(
        config,
        offsetX,
        offsetY,
        drawW,
        drawH,
        cardW,
        cardH
    );

    if (!animEntry) {
        drawCard(ctx, sideCard, final.x, final.y, cardW, cardH, 1);
        return;
    }

    const { phase, start, card, anim } = animEntry;
    const e = easeOut(
        anim.duration > 0 ? clamp01((now - start) / anim.duration) : 1
    );

    if (anim.type === 'fade') {
        const alpha = phase === 'enter' ? e : 1 - e;
        drawCard(ctx, card, final.x, final.y, cardW, cardH, alpha);
        return;
    }

    const off = offscreenOrigin(
        anim.direction,
        final,
        offsetX,
        offsetY,
        drawW,
        drawH,
        cardW,
        cardH
    );
    const from = phase === 'enter' ? off : final;
    const to = phase === 'enter' ? final : off;
    drawCard(
        ctx,
        card,
        from.x + (to.x - from.x) * e,
        from.y + (to.y - from.y) * e,
        cardW,
        cardH,
        1
    );
}

export function renderLiveCardDisplay(
    ctx: CanvasRenderingContext2D,
    left: LiveDisplayCard | null,
    right: LiveDisplayCard | null,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    // A single width (Live Mode) or per-side widths (Timeline, whose card strip
    // width is configured per player).
    stripW: number | { left: number; right: number },
    config: LiveCardDisplayConfig = defaultLiveCardDisplayConfig(),
    anims: { left: DisplayAnim | null; right: DisplayAnim | null } = {
        left: null,
        right: null,
    },
    now = 0,
    frontSide: 'left' | 'right' = 'right'
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const widthFor = (side: 'left' | 'right') =>
        typeof stripW === 'number' ? stripW : stripW[side];

    // Paint the non-front side first, front side last (on top) so the most
    // recently activated card wins when the two displays overlap.
    const paint = (side: 'left' | 'right') => {
        const cardW = widthFor(side);
        const cardH = cardW / CARD_ASPECT;
        if (side === 'left') {
            // prettier-ignore
            drawSide(ctx, left, config.left, anims.left, offsetX, offsetY, drawW, drawH, cardW, cardH, now);
        } else {
            // prettier-ignore
            drawSide(ctx, right, config.right, anims.right, offsetX, offsetY, drawW, drawH, cardW, cardH, now);
        }
    };
    paint(frontSide === 'left' ? 'right' : 'left');
    paint(frontSide);
}
