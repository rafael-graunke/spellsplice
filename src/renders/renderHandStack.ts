import type { Player } from '@/components/types/player';
import { deriveHandWithTimestamps } from '@/lib/deriveState';
import { STRIP_W, STRIP_H, drawCardStrip } from './renderCardStrips';

const ANIM_DURATION = 0.35;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function renderHandStack(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    time: number,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    eyeIcon: HTMLImageElement | null,
) {
    const bottomY = offsetY + drawH - 8;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    players.forEach((player, i) => {
        const events = player.track.events;
        const isLeft = i === 0;
        const finalX = isLeft ? offsetX + 8 : offsetX + drawW - STRIP_W - 8;
        const offscreenX = isLeft ? offsetX - STRIP_W : offsetX + drawW;

        const handTS = deriveHandWithTimestamps(player, events, time);
        if (handTS.length === 0) return;

        // Find recent REMOVE_FROM_HAND events still within animation window.
        const recentRemovals = events.filter(
            (e) =>
                e.type === 'REMOVE_FROM_HAND' &&
                e.time <= time &&
                e.time > time - ANIM_DURATION,
        );

        // Build per-card y offsets for reflow caused by each active removal.
        // Cards at current index j_new >= j_removed shift down during animation.
        const reflowDelta: number[] = new Array(handTS.length).fill(0);
        for (const removalEvent of recentRemovals) {
            const t_r = Math.min(easeOut((time - removalEvent.time) / ANIM_DURATION), 1);
            const preHand = deriveHandWithTimestamps(player, events, removalEvent.time - 0.0001);
            const removedCards = removalEvent.meta?.cards ?? [];

            // Find lowest index among removed cards in pre-removal hand.
            const counts = new Map<string, number>();
            for (const c of removedCards) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
            let j_removed = Infinity;
            for (let k = 0; k < preHand.length; k++) {
                const rem = counts.get(preHand[k].card.name) ?? 0;
                if (rem > 0) {
                    counts.set(preHand[k].card.name, rem - 1);
                    if (k < j_removed) j_removed = k;
                }
            }

            // Cards at j_new >= j_removed started one slot higher; ease down.
            for (let j = 0; j < handTS.length; j++) {
                if (j >= j_removed) {
                    reflowDelta[j] = Math.max(reflowDelta[j], STRIP_H * (1 - t_r));
                }
            }
        }

        // Render current hand cards (entering or static).
        for (let j = 0; j < handTS.length; j++) {
            const { card, enteredAt } = handTS[j];
            const finalY = bottomY - (j + 1) * STRIP_H - reflowDelta[j];
            const age = time - enteredAt;

            let x = finalX;
            let alpha = 1;
            if (enteredAt > 0 && age < ANIM_DURATION) {
                const t_e = easeOut(age / ANIM_DURATION);
                x = offscreenX + (finalX - offscreenX) * t_e;
                alpha = t_e;
            }

            drawCardStrip(ctx, card, x, finalY, isLeft, eyeIcon, alpha);
        }

        // Render exiting cards on top (sliding off-screen).
        for (const removalEvent of recentRemovals) {
            const t_r = Math.min(easeOut((time - removalEvent.time) / ANIM_DURATION), 1);
            const preHand = deriveHandWithTimestamps(player, events, removalEvent.time - 0.0001);
            const removedCards = removalEvent.meta?.cards ?? [];

            const counts = new Map<string, number>();
            for (const c of removedCards) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);

            for (let k = 0; k < preHand.length; k++) {
                const name = preHand[k].card.name;
                const rem = counts.get(name) ?? 0;
                if (rem > 0) {
                    counts.set(name, rem - 1);
                    const oldY = bottomY - (k + 1) * STRIP_H;
                    const x = finalX + (offscreenX - finalX) * t_r;
                    const alpha = 1 - t_r;
                    drawCardStrip(ctx, preHand[k].card, x, oldY, isLeft, eyeIcon, alpha);
                }
            }
        }
    });
}
