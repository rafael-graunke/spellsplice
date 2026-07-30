const debug = (msg: string) => {
    if ((window as unknown as Record<string, unknown>).__exportDebug) console.log('[export]', msg);
};

import type { Clip } from '@/types/clip';
import type { MediaSource } from '@/types/source';
import type { Player } from '@/types/player';
import { derivePlayerState, getNextChangeTime } from '@/lib/deriveState';
import { toPlayerInfo } from '@/lib/overlayData';
import { preloadScoreboardImage } from '@/renders/renderLiveScoreboard';
import { cardDisplayAnimSeconds, collectCardImageRequests } from '@/lib/overlayData';
import { preloadCardImages } from '@/lib/cardCache';
import { HAND_ANIM_DURATION } from '@/renders/renderLiveHand';
import { ANNOTATION_ANIM_DURATION } from '@/renders/renderLiveAnnotation';
import { UI_FADE_MS } from '@/lib/deriveState';
import type { OverlayConfig } from './compose';
import { getVideoTrackMeta, streamVideoChunks, streamAudioChunks, getAudioTrackMeta, extractAudioFromFile } from './demux';
import type { AudioTrackMeta } from './demux';
import { transcodeToOpus } from './transcode';
import { pickCodec, openSaveDialog } from './codec';
import { Encoder } from './encode';
import { createMuxer } from './mux';
import { Compositor } from './compose';

export interface ExportOptions {
    fps?: number;
    overlay: OverlayConfig;
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
// Longest shared-renderer animation, so the overlay keeps repainting through it.
const ANIM_DURATION = Math.max(
    HAND_ANIM_DURATION / 1000,
    ANNOTATION_ANIM_DURATION / 1000,
    UI_FADE_MS / 1000,
);

function loadImg(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Collects audio chunks for all clips, routing by source type:
//   video sources → mp4box streaming (handles large files without loading into RAM), one pass per clip
//   audio sources → WebAudio decode (handles any format: MP3, WAV, OGG, FLAC, etc.), one decode per source
async function collectClipAudio(
    clips: Clip[],
    sourceMap: Map<string, MediaSource>,
    signal: AbortSignal,
    targetCodec: 'mp4a.40.2' | 'opus' = 'mp4a.40.2',
): Promise<{ chunks: EncodedAudioChunk[]; meta: AudioTrackMeta } | null> {
    const result: EncodedAudioChunk[] = [];
    let firstMeta: AudioTrackMeta | null = null;

    const bySource = new Map<string, Clip[]>();
    for (const clip of clips) {
        const arr = bySource.get(clip.sourceId) ?? [];
        arr.push(clip);
        bySource.set(clip.sourceId, arr);
    }

    for (const [sourceId, sourceClips] of bySource) {
        const source = sourceMap.get(sourceId);
        if (!source?.file) continue;

        const sorted = [...sourceClips].sort((a, b) => a.sourceOffset - b.sourceOffset);

        if (source.type === 'video' && targetCodec !== 'opus') {
            // mp4box streaming path: memory-efficient for large video files. Yields native codec
            // chunks (AAC for MP4). Not used when targeting Opus because WebCodecs AudioDecoder
            // for mp4a.40.2 is unavailable on Linux Chromium (patent licensing); those builds
            // only decode AAC via the browser media stack (audioCtx.decodeAudioData below).
            const meta = await getAudioTrackMeta(source.file);
            if (!meta) continue;
            if (!firstMeta) firstMeta = meta;

            for (const clip of sorted) {
                const clipStart = clip.sourceOffset;
                const clipEnd = clip.sourceOffset + clip.duration;
                const shift = clip.time - clip.sourceOffset;
                for await (const chunk of streamAudioChunks(source.file, signal)) {
                    if (signal.aborted) break;
                    const srcSec = chunk.timestamp / 1e6;
                    if (srcSec < clipStart) continue;
                    if (srcSec >= clipEnd) break;
                    const outputTs = Math.round((srcSec + shift) * 1e6);
                    const data = new Uint8Array(chunk.byteLength);
                    chunk.copyTo(data);
                    result.push(new EncodedAudioChunk({ type: chunk.type, timestamp: outputTs, duration: chunk.duration ?? undefined, data }));
                }
            }
        } else {
            // WebAudio path: decode via audioCtx.decodeAudioData (handles any format the browser
            // media stack supports, including AAC on Linux). Used for all audio sources and for
            // video sources when targeting Opus.
            const extracted = await extractAudioFromFile(source.file, sorted, signal, targetCodec);
            if (!extracted) continue;
            if (!firstMeta) firstMeta = extracted.meta;
            result.push(...extracted.chunks);
        }
    }

    if (!firstMeta) return null;
    return { chunks: result.sort((a, b) => a.timestamp - b.timestamp), meta: firstMeta };
}

export async function exportVideo(
    videoClips: Clip[],
    audioClips: Clip[],
    sources: MediaSource[],
    players: Player[],
    onProgress: (p: ExportProgress) => void,
    signal: AbortSignal,
    options: ExportOptions,
): Promise<void> {
    const { fps = 60, overlay } = options;
    const videoLayerHidden = overlay.layers.some((l) => l.id === 'video' && !l.visible);
    // DISPLAY_CARD uses its own configured enter/exit animation length.
    const cardAnim = cardDisplayAnimSeconds(overlay.cardDisplay);
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    const sortedVideoClips = [...videoClips].sort((a, b) => a.time - b.time);
    const sortedAudioClips = [...audioClips].sort((a, b) => a.time - b.time);

    if (sortedVideoClips.length === 0) throw new Error('No video clips to export.');

    for (const clip of [...sortedVideoClips, ...sortedAudioClips]) {
        const src = sourceMap.get(clip.sourceId);
        if (!src?.file) {
            throw new Error(`Source "${src?.name ?? clip.sourceId}" is not linked. Use Relink Media to restore it.`);
        }
    }

    const totalDuration = Math.max(
        ...sortedVideoClips.map(c => c.time + c.duration),
        ...(sortedAudioClips.length > 0 ? sortedAudioClips.map(c => c.time + c.duration) : [0]),
    );
    const totalFrames = Math.ceil(totalDuration * fps);

    let framesEncoded = 0;
    let exportStartTime = 0;

    const emit = (phase: ExportProgress['phase'], message: string) => {
        const elapsed = exportStartTime > 0 ? (performance.now() - exportStartTime) / 1000 : 0;
        const rate = elapsed > 0 ? framesEncoded / elapsed : 0;
        const eta = rate > 0 ? (totalFrames - framesEncoded) / rate : 0;
        onProgress({ phase, currentFrame: framesEncoded, totalFrames, rate, eta, message });
    };

    emit('loading', 'Loading encoder…');
    const { codec, format } = await pickCodec(fps);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const writableStream = await openSaveDialog(format);

    emit('loading', 'Parsing video…');
    const firstVideoSource = sourceMap.get(sortedVideoClips[0].sourceId)!;
    const { config: decoderConfig, fps: sourceFps } = await getVideoTrackMeta(firstVideoSource.file!);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const decoderSupport = await VideoDecoder.isConfigSupported(decoderConfig);
    if (!decoderSupport.supported)
        throw new Error(`VideoDecoder does not support codec "${decoderConfig.codec}" on this browser.`);

    const eyeImg = await loadImg('/assets/eye.svg').catch(() => null);

    // Every card image must be decoded before the first frame: the preview can
    // draw a placeholder and repaint once the art arrives, but a placeholder
    // baked into the output is permanent.
    emit('loading', 'Loading card images…');
    const { missing } = await preloadCardImages(
        collectCardImageRequests(players),
        (done, total) => emit('loading', `Loading card images… ${done}/${total}`),
        signal,
    );
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (missing.length > 0) {
        const names = [...new Set(missing.map((m) => (m.edition ? `${m.name} (${m.edition})` : m.name)))];
        const shown = names.slice(0, 5).join(', ');
        throw new Error(
            `Could not load art for ${names.length} card${names.length > 1 ? 's' : ''}: ` +
                `${shown}${names.length > 5 ? ', …' : ''}. ` +
                'Exporting now would bake placeholders into the video — check the card names/printings and retry.',
        );
    }

    emit('audio', 'Extracting audio…');
    // For WebM, encode audio-file sources directly to Opus (avoids AAC which is unavailable on Linux Chromium).
    // For MP4, encode to AAC. Video sources always go through mp4box streaming regardless.
    const audioTargetCodec = format === 'webm' ? 'opus' : 'mp4a.40.2';
    // Prefer explicit audio clips; fall back to extracting audio from video clip sources.
    const audioSourceClips = sortedAudioClips.length > 0 ? sortedAudioClips : sortedVideoClips;
    const audioResult = await collectClipAudio(audioSourceClips, sourceMap, signal, audioTargetCodec);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    let audioChunks: EncodedAudioChunk[] = audioResult?.chunks ?? [];
    let muxerAudioMeta: AudioTrackMeta | null = audioResult?.meta ?? null;
    // Only transcode to Opus if not already Opus (video-source audio still comes out as AAC from mp4box).
    if (format === 'webm' && muxerAudioMeta && muxerAudioMeta.codec !== 'opus' && audioChunks.length > 0) {
        emit('audio', 'Transcoding audio to Opus…');
        const opus = await transcodeToOpus(muxerAudioMeta, audioChunks);
        audioChunks = opus.chunks;
        muxerAudioMeta = opus.meta;
    }

    const muxer = await createMuxer(format, writableStream, { fps, width: OUT_W, height: OUT_H, audioMeta: muxerAudioMeta });
    const encoder = new Encoder(codec, fps, OUT_W, OUT_H, (chunk, meta) => muxer.addVideoChunk(chunk, meta));
    const compositor = new Compositor(OUT_W, OUT_H);
    // Fixed 1920x1080 layout, matching the preview, so anchored overlay layers
    // land identically in the exported file. Video stretches to fill.
    compositor.setLayout(OUT_W, OUT_H, 0, 0);

    const tracks = players.map(p => p.track);
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

    const preloadScoreboards = async (targetSec: number) => {
        const states = players.map((p) => derivePlayerState(p, p.track.events, targetSec));
        const left = states[0] ? toPlayerInfo(states[0]) : null;
        const right = states[1] ? toPlayerInfo(states[1]) : left;
        if (!left || !right) return;
        const sb = overlay.scoreboard;
        const cfgs = sb.mode === 'shared'
            ? ([['shared', sb.shared]] as const)
            : ([['left', sb.left], ['right', sb.right]] as const);
        await Promise.all(
            cfgs
                .filter(([, c]) => c.svg)
                .map(([slot, c]) => preloadScoreboardImage(slot, c.svg!, c.fieldMappings, left, right)),
        );
    };

    const updateOverlay = async (targetSec: number) => {
        if (targetSec < overlayValidUntil) return;
        await preloadScoreboards(targetSec);
        compositor.updateOverlay(players, targetSec, eyeImg, overlay);
        overlayValidUntil = getNextChangeTime(tracks, targetSec);
        const anyAnimating = players.some(p =>
            p.track.events.some(e => {
                if (e.type === 'ADD_TO_HAND' || e.type === 'REMOVE_FROM_HAND' ||
                    e.type === 'ANNOTATE_CARD' || e.type === 'UNANNOTATE_CARD' ||
                    e.type === 'HIDE_UI' || e.type === 'SHOW_UI' ||
                    // RESET clears hand + annotations, both of which animate out.
                    e.type === 'RESET') {
                    return e.time <= targetSec && e.time > targetSec - ANIM_DURATION;
                }
                if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                    const end = e.time + e.duration;
                    return e.time <= targetSec && targetSec < end &&
                        (targetSec - e.time < cardAnim || end - targetSec <= cardAnim);
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
                        const exitStart = e.time + e.duration - cardAnim;
                        if (exitStart > targetSec && exitStart < overlayValidUntil) {
                            overlayValidUntil = exitStart;
                        }
                    }
                }
            }
        }
    };

    // Encode the output frame at frameIdx. Pass a VideoFrame to upload new video content,
    // or null to hold the previous frame's texture (used for gaps between clips).
    const encodeAt = async (frame: VideoFrame | null) => {
        const targetSec = targetTimes[frameIdx];
        const timestampUs = Math.round(targetSec * 1e6);
        await updateOverlay(targetSec);
        if (frame && !videoLayerHidden) compositor.uploadVideoFrame(frame);
        else compositor.uploadBlackFrame();
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
    };

    exportStartTime = performance.now();

    try {
        for (const clip of sortedVideoClips) {
            // Fill any gap before this clip with the previous frame's texture.
            while (frameIdx < totalFrames && targetTimes[frameIdx] < clip.time - tolerance) {
                await encodeAt(null);
            }
            if (frameIdx >= totalFrames) break;

            const source = sourceMap.get(clip.sourceId)!;
            const clipEndOutputFrame = Math.min(totalFrames, Math.ceil((clip.time + clip.duration) * fps));

            decoder.reset();
            decoder.configure(decoderConfig);

            const drainFrames = async () => {
                while (pendingFrames.length > 0 && frameIdx < clipEndOutputFrame) {
                    const frame = pendingFrames[0];
                    const srcSec = frame.timestamp / 1e6;

                    if (srcSec < clip.sourceOffset - tolerance) {
                        pendingFrames.shift()!.close();
                        continue;
                    }
                    if (srcSec >= clip.sourceOffset + clip.duration + tolerance) break;

                    const outputSec = clip.time + (srcSec - clip.sourceOffset);
                    while (frameIdx < clipEndOutputFrame && targetTimes[frameIdx] <= outputSec + tolerance) {
                        await encodeAt(frame);
                    }

                    pendingFrames.shift()!.close();
                }
            };

            for await (const chunk of streamVideoChunks(source.file!, signal)) {
                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
                if (decoderError) throw decoderError;
                if (frameIdx >= clipEndOutputFrame) break;

                decoder.decode(chunk);
                while (decoder.decodeQueueSize > 10)
                    await new Promise<void>(r => setTimeout(r, 0));
                await drainFrames();
            }

            decoder.reset();
            if (decoderError) throw decoderError;
            await drainFrames();
        }

        // Fill frames beyond last video clip (e.g. trailing audio).
        while (frameIdx < totalFrames) {
            await encodeAt(null);
        }

        debug(`loop done — frameIdx=${frameIdx} totalFrames=${totalFrames}`);
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
