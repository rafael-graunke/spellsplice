import type { VideoState } from '@/components/types/video';
import type { Player } from '@/components/types/player';
import { derivePlayerState, getActiveWindowedEvents } from './deriveState';
import { renderPlayerState } from '@/renders/renderPlayerState';
import { renderHandStack } from '@/renders/renderHandStack';
import { ensureImage } from './cardCache';
import { getVideoTrackMeta, getAudioTrackMeta, streamVideoChunks, streamAudioChunks } from './videoDemux';

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

type ContainerFormat = 'mp4' | 'webm';

async function pickCodec(fps: number): Promise<{ codec: string; format: ContainerFormat }> {
    for (const [codec, format] of [
        ['avc1.42001f', 'mp4'],
        ['vp09.00.10.08', 'webm'],
    ] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { supported } = await VideoEncoder.isConfigSupported({
            codec, width: 1920, height: 1080, framerate: fps,
            bitrateMode: 'variable', bitrate: 2_000_000,
        });
        if (supported) return { codec, format };
    }
    throw new Error('No supported video encoder found. Try Chrome on a recent OS.');
}

function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function renderOverlays(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    time: number,
    offsetX: number,
    offsetY: number,
    drawW: number,
    drawH: number,
    d20Img: HTMLImageElement | null,
    eyeImg: HTMLImageElement | null,
): void {
    const playerStates = players.map((p) => derivePlayerState(p, p.track.events, time));
    const activeEvents = players.map((p) => getActiveWindowedEvents(p.track.events, time));

    renderPlayerState(ctx, playerStates, offsetX, offsetY, drawW, drawH, d20Img);
    renderHandStack(ctx, playerStates, offsetX, offsetY, drawW, drawH, eyeImg);

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
}

export async function exportVideo(
    video: VideoState,
    players: Player[],
    onProgress: (p: ExportProgress) => void,
    signal: AbortSignal,
    options: ExportOptions = {},
): Promise<void> {
    const { fps = 30 } = options;
    const FLUSH_INTERVAL = 150;

    const totalFrames = Math.ceil(video.duration * fps);
    let framesEncoded = 0;
    let exportStartTime = 0;

    const emit = (phase: ExportProgress['phase'], message: string) => {
        const elapsedSec = exportStartTime > 0 ? (performance.now() - exportStartTime) / 1000 : 0;
        const rate = elapsedSec > 0 ? framesEncoded / elapsedSec : 0;
        const eta = rate > 0 ? (totalFrames - framesEncoded) / rate : 0;
        onProgress({ phase, currentFrame: framesEncoded, totalFrames, rate, eta, message });
    };

    const pendingFrames: VideoFrame[] = [];
    let writableStream: FileSystemWritableFileStream | null = null;

    try {
        emit('loading', 'Loading encoder…');
        const { codec, format } = await pickCodec(fps);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        // Show save dialog before encoding — no wasted work if user cancels.
        // showSaveFilePicker throws DOMException AbortError on cancel.
        const ext = format === 'mp4' ? 'mp4' : 'webm';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
            suggestedName: `spellsplice-export-${Date.now()}.${ext}`,
            types: [{ description: 'Video File', accept: { [`video/${ext}`]: [`.${ext}`] } }],
        });
        writableStream = await handle.createWritable();

        emit('loading', 'Parsing video…');
        const { config: decoderConfig, fps: sourceFps } = await getVideoTrackMeta(video.file);
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const decoderSupport = await VideoDecoder.isConfigSupported(decoderConfig);
        if (!decoderSupport.supported) {
            throw new Error(`VideoDecoder does not support codec "${decoderConfig.codec}" on this browser.`);
        }

        const imgResults = await Promise.allSettled([loadImg('/d20.svg'), loadImg('/eye.svg')]);
        const d20Img = imgResults[0].status === 'fulfilled' ? imgResults[0].value : null;
        const eyeImg = imgResults[1].status === 'fulfilled' ? imgResults[1].value : null;

        // Collect audio chunks upfront — AAC is small (~10 MB/hr), copying avoids re-encode
        emit('audio', 'Extracting audio…');
        const audioMeta = format === 'mp4' ? await getAudioTrackMeta(video.file) : null;
        const audioChunks: EncodedAudioChunk[] = [];
        if (audioMeta) {
            for await (const chunk of streamAudioChunks(video.file, signal)) {
                audioChunks.push(chunk);
            }
        }
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;

        let offsetX = 0, offsetY = 0, drawW = 1920, drawH = 1080, layoutReady = false;

        exportStartTime = performance.now();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mp4Muxer: import('mp4-muxer').Muxer<any> | null = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let webmMuxer: import('webm-muxer').Muxer<any> | null = null;

        if (format === 'mp4') {
            const { Muxer, FileSystemWritableFileStreamTarget } = await import('mp4-muxer');
            mp4Muxer = new Muxer({
                target: new FileSystemWritableFileStreamTarget(writableStream),
                video: { codec: 'avc', width: 1920, height: 1080, frameRate: fps },
                audio: audioMeta
                    ? { codec: 'aac', sampleRate: audioMeta.sampleRate, numberOfChannels: audioMeta.numberOfChannels }
                    : undefined,
                firstTimestampBehavior: 'offset',
                fastStart: false,
            });
        } else {
            const { Muxer, FileSystemWritableFileStreamTarget } = await import('webm-muxer');
            webmMuxer = new Muxer({
                target: new FileSystemWritableFileStreamTarget(writableStream),
                video: { codec: 'V_VP9', width: 1920, height: 1080, frameRate: fps },
                firstTimestampBehavior: 'offset',
            });
        }

        // WebCodecs errors don't propagate from callbacks into async context — collect and rethrow
        let pipelineError: unknown = null;

        const encoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (format === 'mp4') mp4Muxer!.addVideoChunk(chunk, meta);
                else webmMuxer!.addVideoChunk(chunk, meta);
            },
            error: (e) => { pipelineError = e; },
        });

        const encoderConfig: VideoEncoderConfig = {
            codec, width: 1920, height: 1080, framerate: fps,
            bitrateMode: 'variable', bitrate: 2_000_000,
        };
        if (format === 'mp4') encoderConfig.avc = { format: 'annexb' };
        encoder.configure(encoderConfig);

        const decoder = new VideoDecoder({
            output: (frame) => { pendingFrames.push(frame); },
            error: (e) => { pipelineError = e; },
        });
        decoder.configure(decoderConfig);

        const targetTimes = Array.from({ length: totalFrames }, (_, i) => i / fps);
        let targetIdx = 0;
        let audioIdx = 0;
        // Pass AudioSpecificConfig on the first addAudioChunk call so mp4-muxer writes the esds box correctly
        let audioMetaSent = false;

        const flushAudioUpTo = (videoTimestampUs: number) => {
            if (!audioMeta || format !== 'mp4') return;
            while (audioIdx < audioChunks.length && audioChunks[audioIdx].timestamp <= videoTimestampUs) {
                const meta = !audioMetaSent ? {
                    decoderConfig: {
                        codec: audioMeta.codec,
                        sampleRate: audioMeta.sampleRate,
                        numberOfChannels: audioMeta.numberOfChannels,
                        ...(audioMeta.description.byteLength > 0 ? { description: audioMeta.description } : {}),
                    },
                } : undefined;
                mp4Muxer!.addAudioChunk(audioChunks[audioIdx++], meta);
                audioMetaSent = true;
            }
        };

        const tolerance = 0.5 / (sourceFps || fps);

        const encodeFrame = (frame: VideoFrame, targetSec: number) => {
            flushAudioUpTo(Math.round(targetSec * 1e6));
            ctx.clearRect(0, 0, 1920, 1080);
            ctx.drawImage(frame, offsetX, offsetY, drawW, drawH);
            renderOverlays(ctx, players, targetSec, offsetX, offsetY, drawW, drawH, d20Img, eyeImg);
            const isKeyFrame = targetIdx % (Math.round(fps) * 2) === 0;
            const vf = new VideoFrame(canvas, {
                timestamp: Math.round(targetSec * 1e6),
                duration: Math.round(1e6 / fps),
            });
            encoder.encode(vf, { keyFrame: isKeyFrame });
            vf.close();
        };

        const drainPendingFrames = async () => {
            while (pendingFrames.length > 0 && targetIdx < totalFrames) {
                const frame = pendingFrames.shift()!;
                const frameSec = frame.timestamp / 1e6;

                if (!layoutReady) {
                    const scale = Math.min(1920 / frame.codedWidth, 1080 / frame.codedHeight);
                    drawW = Math.round(frame.codedWidth * scale);
                    drawH = Math.round(frame.codedHeight * scale);
                    offsetX = Math.round((1920 - drawW) / 2);
                    offsetY = Math.round((1080 - drawH) / 2);
                    layoutReady = true;
                }

                while (targetIdx < totalFrames && frameSec >= targetTimes[targetIdx] - tolerance) {
                    encodeFrame(frame, targetTimes[targetIdx]);
                    framesEncoded++;
                    targetIdx++;
                    emit('frames', `Frame ${framesEncoded} / ${totalFrames}`);

                    if (targetIdx % FLUSH_INTERVAL === 0 || targetIdx === totalFrames) {
                        await encoder.flush();
                        if (pipelineError) throw pipelineError;
                    }
                }

                frame.close();
            }
        };

        for await (const chunk of streamVideoChunks(video.file, signal)) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (pipelineError) throw pipelineError;
            if (targetIdx >= totalFrames) break;

            decoder.decode(chunk);

            // Back-pressure: yield to the macrotask queue so decodeQueueSize can decrease
            while (decoder.decodeQueueSize > 10) {
                await new Promise<void>(r => setTimeout(r, 0));
            }
            await drainPendingFrames();
        }

        await decoder.flush();
        if (pipelineError) throw pipelineError;
        await drainPendingFrames();

        // Flush remaining audio (tail beyond last video frame)
        flushAudioUpTo(Number.MAX_SAFE_INTEGER);

        await encoder.flush();
        if (pipelineError) throw pipelineError;
        encoder.close();
        decoder.close();

        if (format === 'mp4') mp4Muxer!.finalize();
        else webmMuxer!.finalize();

        await writableStream.close();
        writableStream = null;

    } finally {
        for (const frame of pendingFrames) frame.close();
        pendingFrames.length = 0;
        if (writableStream) {
            try { await writableStream.abort(); } catch { /* ignore */ }
        }
    }
}
