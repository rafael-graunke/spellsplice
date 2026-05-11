import type { Card } from '@/components/types/card';
import type { Player } from '@/components/types/player';
import { derivePlayerState } from '@/lib/deriveState';
import { STRIP_W, getStripH, drawCardStrip } from './renderCardStrips';

const CONT_PAD_X = 10;
const CONT_PAD_Y = 10;
const TITLE_FONT_SIZE = 20;
const TITLE_BOTTOM_GAP = 6;
const TITLE_AREA_H = TITLE_FONT_SIZE + TITLE_BOTTOM_GAP;

const ANIM_DURATION = 0.35;
const easeOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const stackH = (cards: Card[], upTo = cards.length) =>
    cards.slice(0, upTo).reduce((s, c) => s + getStripH(c), 0);

function contDims(cards: Card[]) {
    return {
        contW: STRIP_W + 2 * CONT_PAD_X,
        contH: CONT_PAD_Y + TITLE_AREA_H + stackH(cards) + CONT_PAD_Y,
    };
}

function drawBackground(
    ctx: CanvasRenderingContext2D,
    contX: number,
    contY: number,
    contW: number,
    contH: number,
) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(contX, contY, contW, contH, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${TITLE_FONT_SIZE}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText('Cards on top of the deck', contX + contW / 2, contY + CONT_PAD_Y);
    ctx.restore();
}

export function renderDeckStack(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    time: number,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    uiVisibility = 1,
) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    players.forEach((player, i) => {
        const isLeft = i === 0;
        const events = player.track.events;
        const state = derivePlayerState(player, events, time);
        const currentCards = state.topStack ?? [];

        const finalContX = (contW: number) =>
            isLeft ? offsetX + 8 : offsetX + drawW - contW - 8;
        const offscreenContX = (contW: number) =>
            isLeft ? offsetX - contW : offsetX + drawW;
        const offscreenStripX = isLeft ? offsetX - STRIP_W : offsetX + drawW;

        // Most recent STACK_DECK within animation window
        const recentStack = events
            .filter((e) => e.type === 'STACK_DECK' && e.time <= time && e.time > time - ANIM_DURATION)
            .sort((a, b) => b.time - a.time)[0];

        // Most recent UNSTACK_DECK within animation window
        const recentUnstack = events.find(
            (e) => e.type === 'UNSTACK_DECK' && e.time <= time && e.time > time - ANIM_DURATION,
        );

        // Pre-event state for each recent event
        const preStackCards = recentStack
            ? (derivePlayerState(player, events, recentStack.time - 0.0001).topStack ?? [])
            : recentUnstack
              ? (derivePlayerState(player, events, recentUnstack.time - 0.0001).topStack ?? [])
              : [];

        const hasContent = currentCards.length > 0 || !!recentUnstack;
        if (!hasContent) return;

        // Container dimensions: use preStackCards when unstacking (to keep size while sliding out)
        const displayCards = currentCards.length > 0 ? currentCards : preStackCards;
        if (displayCards.length === 0) return;

        const { contW, contH } = contDims(displayCards);
        const contY = offsetY + Math.round((drawH - contH) / 2);

        // Container x: slides in only on first appearance (preStack was empty), else stays put
        let contX = finalContX(contW);
        if (recentUnstack) {
            const t = easeOut((time - recentUnstack.time) / ANIM_DURATION);
            contX = finalContX(contW) + (offscreenContX(contW) - finalContX(contW)) * t;
        } else if (recentStack && preStackCards.length === 0) {
            const t = easeOut((time - recentStack.time) / ANIM_DURATION);
            contX = offscreenContX(contW) + (finalContX(contW) - offscreenContX(contW)) * t;
        }

        const slideX = (isLeft ? -1 : 1) * 500 * (1 - uiVisibility);
        ctx.save();
        ctx.translate(slideX, 0);

        drawBackground(ctx, contX, contY, contW, contH);

        const stripX = contX + CONT_PAD_X;
        const firstStripY = contY + CONT_PAD_Y + TITLE_AREA_H;

        // UNSTACK: all pre-unstack cards follow container sliding out
        if (recentUnstack) {
            for (let j = 0; j < preStackCards.length; j++) {
                drawCardStrip(ctx, preStackCards[j], stripX, firstStripY + stackH(preStackCards, j), isLeft);
            }
            ctx.restore();
            return;
        }

        // STACK with container entering (preStack empty): all cards follow container, no per-card anim
        if (recentStack && preStackCards.length === 0) {
            for (let j = 0; j < currentCards.length; j++) {
                drawCardStrip(ctx, currentCards[j], stripX, firstStripY + stackH(currentCards, j), isLeft);
            }
            ctx.restore();
            return;
        }

        // STACK replacing existing cards: container stays, cards animate individually
        if (recentStack && preStackCards.length > 0) {
            const t = easeOut((time - recentStack.time) / ANIM_DURATION);

            // Track which preStack cards are accounted for by current cards
            const preMap = new Map<string, number>();
            for (const c of preStackCards) preMap.set(c.name, (preMap.get(c.name) ?? 0) + 1);

            // Draw current cards; new ones slide in from edge
            const matchedPre = new Map(preMap);
            for (let j = 0; j < currentCards.length; j++) {
                const card = currentCards[j];
                const y = firstStripY + stackH(currentCards, j);
                const rem = matchedPre.get(card.name) ?? 0;
                if (rem > 0) {
                    matchedPre.set(card.name, rem - 1);
                    drawCardStrip(ctx, card, stripX, y, isLeft);
                } else {
                    const x = offscreenStripX + (stripX - offscreenStripX) * t;
                    drawCardStrip(ctx, card, x, y, isLeft, null, t);
                }
            }

            // Draw exiting cards (in preStack but not current)
            const currentMap = new Map<string, number>();
            for (const c of currentCards) currentMap.set(c.name, (currentMap.get(c.name) ?? 0) + 1);
            for (let k = 0; k < preStackCards.length; k++) {
                const card = preStackCards[k];
                const rem = currentMap.get(card.name) ?? 0;
                if (rem > 0) {
                    currentMap.set(card.name, rem - 1);
                } else {
                    const y = firstStripY + stackH(preStackCards, k);
                    const x = stripX + (offscreenStripX - stripX) * t;
                    drawCardStrip(ctx, card, x, y, isLeft, null, 1 - t);
                }
            }
            ctx.restore();
            return;
        }

        // Static: no recent events
        for (let j = 0; j < currentCards.length; j++) {
            drawCardStrip(ctx, currentCards[j], stripX, firstStripY + stackH(currentCards, j), isLeft);
        }
        ctx.restore();
    });
}
