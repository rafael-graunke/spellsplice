import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import type { VideoState } from '@/components/types/video';
import type { Player } from '@/components/types/player';
import { derivePlayerState, getActiveWindowedEvents } from './deriveState';
import { renderPlayerState } from '@/renders/renderPlayerState';
import { renderHandStack } from '@/renders/renderHandStack';
import { ensureImage } from './cardCache';
import { getVideoTrackMeta, streamVideoChunks } from './videoDemux';

export interface ExportOptions {
    fps?: number;
    framesPerSegment?: number;
}

export interface ExportProgress {
    phase: 'loading' | 'audio' | 'frames' | 'segments' | 'concat';
    currentFrame: number;
    totalFrames: number;
    rate: number;
    eta: number;
    message: string;
}

type ContainerFormat = 'mp4' | 'webm';

let ff: FFmpeg | null = null;
let ffLoadPromise: Promise<boolean> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
    if (ff?.loaded) return ff;
    if (!ffLoadPromise) {
        const newFf = new FFmpeg();
        ff = newFf;
        ffLoadPromise = Promise.all([
            toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript'),
            toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
            toBlobURL('/ffmpeg/ffmpeg-core.worker.js', 'text/javascript'),
        ])
            .then(([coreURL, wasmURL, workerURL]) =>
                newFf.load({ coreURL, wasmURL, workerURL })
            )
            .catch((err) => {
                ffLoadPromise = null;
                ff = null;
                throw err;
            });
    }
    await ffLoadPromise;
    return ff!;
}

async function pickCodec(fps: number): Promise<{ codec: string; format: ContainerFormat }> {
    for (const [codec, format] of [
        ['avc1.42001f', 'mp4'],
        ['vp09.00.10.08', 'webm'],
    ] as const) {
        const { supported } = await VideoEncoder.isConfigSupported({
            codec, width: 1920, height: 1080, bitrate: 8_000_000, framerate: fps,
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

function pad(n: number, digits: number): string {
    return String(n).padStart(digits, '0');
}

function concatenateChunks(chunks: Uint8Array[]): Uint8Array {
    const total = chunks.reduce((s, c) => s + c.byteLength, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    return out;
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
    const {
        fps = 30,
        framesPerSegment = 150,
    } = options;

    const totalFrames = Math.ceil(video.duration * fps);
    const totalSegments = Math.ceil(totalFrames / framesPerSegment);

    let framesEncoded = 0;
    let exportStartTime = 0;

    const emit = (phase: ExportProgress['phase'], message: string) => {
        const elapsedSec = exportStartTime > 0 ? (performance.now() - exportStartTime) / 1000 : 0;
        const rate = elapsedSec > 0 ? framesEncoded / elapsedSec : 0;
        const eta = rate > 0 ? (totalFrames - framesEncoded) / rate : 0;
        onProgress({ phase, currentFrame: framesEncoded, totalFrames, rate, eta, message });
    };

    const tempFiles: string[] = [];
    const pendingFrames: VideoFrame[] = [];
    let writableStream: FileSystemWritableFileStream | null = null;
    const tryDelete = async (name: string) => {
        try { await ff!.deleteFile(name); } catch { /* already gone */ }
    };

    try {
        emit('loading', 'Loading encoder…');
        const ffmpeg = await getFFmpeg();
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const { codec, format } = await pickCodec(fps);

        // Show save dialog before encoding begins — no wasted work if user cancels.
        // showSaveFilePicker throws DOMException AbortError on cancel, same as our signal.
        if (format === 'webm') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handle: FileSystemFileHandle = await (window as any).showSaveFilePicker({
                suggestedName: `spellsplice-export-${Date.now()}.webm`,
                types: [{ description: 'WebM Video', accept: { 'video/webm': ['.webm'] } }],
            });
            writableStream = await handle.createWritable();
        }

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

        // Audio extraction — MP4 only; AAC in WebM is non-standard
        let hasAudio = false;
        const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

        if (format === 'mp4' && video.file.size <= MAX_AUDIO_BYTES) {
            emit('audio', 'Extracting audio…');
            try {
                await ffmpeg.writeFile('src_video', await fetchFile(video.file));
                tempFiles.push('src_video');

                const ret = await ffmpeg.exec([
                    '-i', 'src_video', '-vn', '-c:a', 'aac', '-b:a', '192k', 'audio.aac',
                ]);

                await tryDelete('src_video');
                tempFiles.splice(tempFiles.indexOf('src_video'), 1);

                if (ret === 0) {
                    hasAudio = true;
                    tempFiles.push('audio.aac');
                } else {
                    await tryDelete('audio.aac');
                }
            } catch {
                await tryDelete('src_video');
                await tryDelete('audio.aac');
            }
        }

        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d')!;

        let offsetX = 0;
        let offsetY = 0;
        let drawW = 1920;
        let drawH = 1080;
        let layoutReady = false;

        exportStartTime = performance.now();

        // webm-muxer for VP9 path — streams directly to disk, no in-memory buffer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let webmMuxer: import('webm-muxer').Muxer<any> | null = null;
        if (format === 'webm') {
            const { Muxer, FileSystemWritableFileStreamTarget } = await import('webm-muxer');
            webmMuxer = new Muxer({
                target: new FileSystemWritableFileStreamTarget(writableStream!),
                video: { codec: 'V_VP9', width: 1920, height: 1080, frameRate: fps },
                firstTimestampBehavior: 'offset',
            });
        }

        const segmentChunksH264: Uint8Array[] = [];

        // WebCodecs errors don't propagate from callbacks into async context — collect and rethrow
        let pipelineError: unknown = null;

        const encoder = new VideoEncoder({
            output: (chunk, meta) => {
                if (format === 'mp4') {
                    const buf = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(buf);
                    segmentChunksH264.push(buf);
                } else {
                    webmMuxer!.addVideoChunk(chunk, meta);
                }
            },
            error: (e) => { pipelineError = e; },
        });

        const encoderConfig: VideoEncoderConfig = {
            codec,
            width: 1920,
            height: 1080,
            bitrate: 8_000_000,
            framerate: fps,
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
        let segIdx = 0;
        const segmentFiles: string[] = [];

        const flushSegment = async () => {
            emit('segments', `Encoding segment ${segIdx + 1} of ${totalSegments}…`);
            await encoder.flush();
            if (pipelineError) throw pipelineError;

            const raw = concatenateChunks(segmentChunksH264);
            segmentChunksH264.length = 0;
            const segName = `seg${pad(segIdx, 4)}.mp4`;
            await ffmpeg.writeFile('raw.h264', raw);
            tempFiles.push('raw.h264');
            const ret = await ffmpeg.exec(['-f', 'h264', '-framerate', String(fps), '-i', 'raw.h264', '-c:v', 'copy', segName]);
            await tryDelete('raw.h264');
            tempFiles.splice(tempFiles.indexOf('raw.h264'), 1);
            if (ret !== 0) throw new Error(`Segment ${segIdx} mux failed (ffmpeg exit ${ret})`);
            tempFiles.push(segName);
            segmentFiles.push(segName);
            segIdx++;
        };

        const encodeFrame = (frame: VideoFrame, targetSec: number) => {
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

        const tolerance = 0.5 / (sourceFps || fps);

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

                    if ((targetIdx % framesPerSegment === 0 || targetIdx === totalFrames)) {
                        if (format === 'mp4' && segmentChunksH264.length > 0) {
                            await flushSegment();
                        } else if (format === 'webm') {
                            // Drain encoder queue so output callback fires and
                            // encode queue doesn't grow to totalFrames → OOM
                            await encoder.flush();
                            if (pipelineError) throw pipelineError;
                        }
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

            // Back-pressure: yield to the macrotask queue (where WebCodecs fires output
            // callbacks) so decodeQueueSize can actually decrease.
            while (decoder.decodeQueueSize > 10) {
                await new Promise<void>(r => setTimeout(r, 0));
            }
            await drainPendingFrames();
        }

        await decoder.flush();
        if (pipelineError) throw pipelineError;
        await drainPendingFrames();

        if (format === 'webm') {
            await encoder.flush();
            if (pipelineError) throw pipelineError;
            encoder.close();
            decoder.close();

            webmMuxer!.finalize();
            await writableStream!.close();
            writableStream = null;  // mark closed so finally doesn't abort it
        } else {
            if (segmentChunksH264.length > 0 || encoder.encodeQueueSize > 0) {
                await flushSegment();
            }

            decoder.close();
            encoder.close();

            // Concatenate segments and mux audio
            emit('concat', 'Concatenating segments…');
            const outputFile = 'output.mp4';
            const concatList = segmentFiles.map((f) => `file '${f}'`).join('\n');
            await ffmpeg.writeFile('segs.txt', concatList);
            tempFiles.push('segs.txt');

            const concatArgs: string[] = ['-f', 'concat', '-safe', '0', '-i', 'segs.txt'];
            if (hasAudio) concatArgs.push('-i', 'audio.aac');
            concatArgs.push('-c:v', 'copy');
            if (hasAudio) concatArgs.push('-c:a', 'copy', '-shortest');
            concatArgs.push(outputFile);

            const ret = await ffmpeg.exec(concatArgs);
            if (ret !== 0) throw new Error(`Concat failed (ffmpeg exit ${ret})`);
            tempFiles.push(outputFile);

            const data = await ffmpeg.readFile(outputFile) as Uint8Array;
            const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spellsplice-export-${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } finally {
        for (const frame of pendingFrames) frame.close();
        pendingFrames.length = 0;
        if (writableStream) {
            try { await writableStream.abort(); } catch { /* ignore */ }
        }
        if (ff?.loaded) {
            for (const f of tempFiles) await tryDelete(f);
        }
    }
}
