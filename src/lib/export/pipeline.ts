const debug = (msg: string) => {
    if ((window as unknown as Record<string, unknown>).__exportDebug) console.log('[export]', msg);
};

import type { VideoState } from '@/components/types/video';
import type { Player } from '@/components/types/player';
import { getNextChangeTime } from '@/lib/deriveState';
import { getVideoTrackMeta, getAudioTrackMeta, streamVideoChunks, streamAudioChunks } from './demux';
import type { AudioTrackMeta } from './demux';
import { transcodeToOpus } from './transcode';
import { pickCodec, openSaveDialog } from './codec';
import { Encoder } from './encode';
import { createMuxer } from './mux';
import { Compositor } from './compose';

export interface ExportOptions {
    fps?: number;
}

export interface ExportProgress {
    phase: 'loading' | 'audio' | 'frames';
    currentFrame: number;
    totalFrames: number;
    rate: number;
    eta: number;
    message: string;
}

const OUT_W = 1920;
const OUT_H = 1080;

function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

async function collectAudioChunks(file: File, signal: AbortSignal): Promise<EncodedAudioChunk[]> {
    const chunks: EncodedAudioChunk[] = [];
    for await (const chunk of streamAudioChunks(file, signal)) {
        chunks.push(chunk);
    }
    return chunks;
}

export async function exportVideo(
    video: VideoState,
    players: Player[],
    onProgress: (p: ExportProgress) => void,
    signal: AbortSignal,
    options: ExportOptions = {},
): Promise<void> {
    const { fps = 60 } = options;
    const totalFrames = Math.ceil(video.duration * fps);
    let framesEncoded = 0;
    let exportStartTime = 0;

    const emit = (phase: ExportProgress['phase'], message: string) => {
        const elapsedSec = exportStartTime > 0 ? (performance.now() - exportStartTime) / 1000 : 0;
        const rate = elapsedSec > 0 ? framesEncoded / elapsedSec : 0;
        const eta = rate > 0 ? (totalFrames - framesEncoded) / rate : 0;
        onProgress({ phase, currentFrame: framesEncoded, totalFrames, rate, eta, message });
    };

    emit('loading', 'Loading encoder…');
    const { codec, format } = await pickCodec(fps);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const writableStream = await openSaveDialog(format);

    emit('loading', 'Parsing video…');
    const { config: decoderConfig, fps: sourceFps } = await getVideoTrackMeta(video.file);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const decoderSupport = await VideoDecoder.isConfigSupported(decoderConfig);
    if (!decoderSupport.supported)
        throw new Error(`VideoDecoder does not support codec "${decoderConfig.codec}" on this browser.`);

    const scale = Math.min(OUT_W / decoderConfig.codedWidth!, OUT_H / decoderConfig.codedHeight!);
    const drawW = Math.round(decoderConfig.codedWidth! * scale);
    const drawH = Math.round(decoderConfig.codedHeight! * scale);
    const offsetX = Math.round((OUT_W - drawW) / 2);
    const offsetY = Math.round((OUT_H - drawH) / 2);

    const imgResults = await Promise.allSettled([loadImg('/assets/d20.svg'), loadImg('/assets/eye.svg')]);
    const d20Img = imgResults[0].status === 'fulfilled' ? imgResults[0].value : null;
    const eyeImg = imgResults[1].status === 'fulfilled' ? imgResults[1].value : null;

    emit('audio', 'Extracting audio…');
    const audioMeta: AudioTrackMeta | null = await getAudioTrackMeta(video.file);
    const rawAudioChunks: EncodedAudioChunk[] = audioMeta ? await collectAudioChunks(video.file, signal) : [];
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    let audioChunks = rawAudioChunks;
    let muxerAudioMeta = audioMeta;
    if (format === 'webm' && audioMeta && rawAudioChunks.length > 0) {
        emit('audio', 'Transcoding audio to Opus…');
        const opus = await transcodeToOpus(audioMeta, rawAudioChunks);
        audioChunks = opus.chunks;
        muxerAudioMeta = opus.meta;
    }

    const muxer = await createMuxer(format, writableStream, { fps, width: OUT_W, height: OUT_H, audioMeta: muxerAudioMeta });
    const encoder = new Encoder(codec, fps, OUT_W, OUT_H, (chunk, meta) => muxer.addVideoChunk(chunk, meta));
    const compositor = new Compositor(OUT_W, OUT_H);
    compositor.setLayout(drawW, drawH, offsetX, offsetY);

    const tracks = players.map((p) => p.track);
    let overlayValidUntil = -Infinity;
    let frameIdx = 0;
    const targetTimes = Array.from({ length: totalFrames }, (_, i) => i / fps);
    const tolerance = 0.5 / (sourceFps || fps);
    const pendingFrames: VideoFrame[] = [];
    let decoderError: unknown = null;

    const decoder = new VideoDecoder({
        output: (f) => pendingFrames.push(f),
        error: (e) => { decoderError = e; },
    });
    decoder.configure(decoderConfig);

    exportStartTime = performance.now();

    try {
        const drainFrames = async () => {
            while (pendingFrames.length > 0 && frameIdx < totalFrames) {
                const frame = pendingFrames.shift()!;
                const frameSec = frame.timestamp / 1e6;

                while (frameIdx < totalFrames && frameSec >= targetTimes[frameIdx] - tolerance) {
                    const targetSec = targetTimes[frameIdx];
                    const timestampUs = Math.round(targetSec * 1e6);

                    if (targetSec >= overlayValidUntil) {
                        compositor.updateOverlay(players, targetSec, d20Img, eyeImg);
                        overlayValidUntil = getNextChangeTime(tracks, targetSec);

                        const ANIM_DURATION = 0.35;
                        const anyAnimating = players.some((p) =>
                            p.track.events.some((e) => {
                                if (
                                    e.type === 'ADD_TO_HAND' ||
                                    e.type === 'REMOVE_FROM_HAND' ||
                                    e.type === 'STACK_DECK' ||
                                    e.type === 'UNSTACK_DECK'
                                ) {
                                    return e.time <= targetSec && e.time > targetSec - ANIM_DURATION;
                                }
                                if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                                    const end = e.time + e.duration;
                                    return (
                                        e.time <= targetSec &&
                                        targetSec < end &&
                                        (targetSec - e.time < ANIM_DURATION ||
                                            end - targetSec <= ANIM_DURATION)
                                    );
                                }
                                return false;
                            }),
                        );
                        if (anyAnimating) {
                            overlayValidUntil = targetSec + 0.001;
                        } else {
                            for (const p of players) {
                                for (const e of p.track.events) {
                                    if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                                        const exitStart = e.time + e.duration - ANIM_DURATION;
                                        if (exitStart > targetSec && exitStart < overlayValidUntil) {
                                            overlayValidUntil = exitStart;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    compositor.uploadVideoFrame(frame);
                    const composed = compositor.compose(timestampUs, Math.round(1e6 / fps));
                    encoder.encode(composed, frameIdx % (Math.round(fps) * 10) === 0);
                    composed.close();

                    muxer.feedAudioUpTo(audioChunks, timestampUs);

                    framesEncoded++;
                    frameIdx++;
                    emit('frames', `Frame ${framesEncoded} / ${totalFrames}`);
                    await encoder.drainIfNeeded(frameIdx, 150);
                    if (encoder.error) throw encoder.error;
                    if (decoderError) throw decoderError;
                }

                frame.close();
            }
        };

        for await (const chunk of streamVideoChunks(video.file, signal)) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (decoderError) throw decoderError;
            if (frameIdx >= totalFrames) break;

            decoder.decode(chunk);
            while (decoder.decodeQueueSize > 10)
                await new Promise<void>((r) => setTimeout(r, 0));
            await drainFrames();
        }

        debug(`loop done — frameIdx=${frameIdx} totalFrames=${totalFrames}`);
        decoder.reset();
        if (decoderError) throw decoderError;
        await drainFrames();
        debug('drainFrames done');

        muxer.feedAudioUpTo(audioChunks, Number.MAX_SAFE_INTEGER);
        debug('calling encoder.flush');
        await encoder.flush();
        debug('encoder.flush done');
        if (encoder.error) throw encoder.error;
        encoder.close();
        decoder.close();
        muxer.finalize();
        debug('muxer finalized — closing stream');
        await writableStream.close();
        debug('done');
    } finally {
        for (const f of pendingFrames) f.close();
        pendingFrames.length = 0;
        compositor.dispose();
        try { await writableStream.abort(); } catch { /* ignore — already closed on success */ }
    }
}
