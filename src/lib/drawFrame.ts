import type { Player } from '@/components/types/player';
import { derivePlayerState, getActiveWindowedEvents } from './deriveState';
import { renderPlayerState } from '@/renders/renderPlayerState';
import { renderHandStack } from '@/renders/renderHandStack';
import { renderDeckStack } from '@/renders/renderDeckStack';
import { ensureImage } from './cardCache';

export interface DrawFrameOptions {
    canvas: HTMLCanvasElement;
    videoEl: HTMLVideoElement;
    players: Player[];
    time: number;
    d20Img: HTMLImageElement | null;
    eyeImg: HTMLImageElement | null;
}

export function drawFrame({ canvas, videoEl, players, time, d20Img, eyeImg }: DrawFrameOptions): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasW = 1920;
    const canvasH = 1080;
    const videoW = videoEl.videoWidth;
    const videoH = videoEl.videoHeight;
    if (!videoW || !videoH) return;

    const scale = Math.min(canvasW / videoW, canvasH / videoH);
    const drawW = Math.round(videoW * scale);
    const drawH = Math.round(videoH * scale);
    const offsetX = Math.round((canvasW - drawW) / 2);
    const offsetY = Math.round((canvasH - drawH) / 2);

    ctx.save();
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.drawImage(videoEl, offsetX, offsetY, drawW, drawH);

    const playerStates = players.map((p) => derivePlayerState(p, p.track.events, time));
    const activeEvents = players.map((p) => getActiveWindowedEvents(p.track.events, time));

    renderPlayerState(ctx, playerStates, offsetX, offsetY, drawW, drawH, d20Img);
    renderHandStack(ctx, playerStates, offsetX, offsetY, drawW, drawH, eyeImg);
    renderDeckStack(ctx, playerStates, offsetX, offsetY, drawW, drawH);

    const cardH = drawH * 0.5;
    const cardW = cardH * (223 / 310);
    let cardOffset = 0;

    activeEvents.forEach((events) => {
        events.forEach((event) => {
            const card = event.meta?.cards?.[0];
            if (!card?.name) return;

            const cached = ensureImage(card.name, card.edition);
            if (cached === 'loading' || cached === 'error') return;

            const cardX = offsetX + drawW / 2 - cardW / 2 + cardOffset * (cardW + 8);
            const cardY = offsetY + drawH / 2 - cardH / 2;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(cardX, cardY, cardW, cardH, 20);
            ctx.clip();
            ctx.drawImage(cached, cardX, cardY, cardW, cardH);
            ctx.restore();

            cardOffset++;
        });
    });

    ctx.restore();
}
