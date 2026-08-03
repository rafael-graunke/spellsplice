const debug = (msg: string) => {
    if ((window as unknown as Record<string, unknown>).__exportDebug) console.log('[export]', msg);
};

import type { Clip } from '@/types/clip';
import { ClipType } from '@/types/clip';
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
import { getVideoTrackMeta, streamAudioChunks, getAudioTrackMeta, mixClipAudio } from './demux';
import type { AudioTrackMeta } from './demux';
import { transcodeToOpus } from './transcode';
import { pickCodec, openSaveDialog } from './codec';
import { Encoder } from './encode';
import { createMuxer } from './mux';
import { Compositor } from './compose';
import type { BaseLayer } from '@/renders/composeClips';
import { VideoClipProvider } from './videoClipProvider';
import { resolveTransform, NO_CROP } from '@/lib/clipTransform';
import type { Resolution } from '@/types/config';

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
const EXPORT_RESOLUTION: Resolution = { width: OUT_W, height: OUT_H };
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

// A lone video clip keeps the mp4box passthrough: nothing can overlap it, so it avoids a
// re-encode and never holds the whole timeline as PCM. Everything else must be mixed.
async function collectClipAudio(
    clips: Clip[],
    sourceMap: Map<string, MediaSource>,
    signal: AbortSignal,
    targetCodec: 'mp4a.40.2' | 'opus' = 'mp4a.40.2',
): Promise<{ chunks: EncodedAudioChunk[]; meta: AudioTrackMeta } | null> {
    const usable = clips.filter((c) => sourceMap.get(c.sourceId)?.file);
    if (usable.length === 0) return null;

    const soleSource = usable.length === 1 ? sourceMap.get(usable[0].sourceId) : undefined;
    // Opus is excluded: WebCodecs AudioDecoder for mp4a.40.2 is unavailable on Linux Chromium
    // (patent licensing), so those builds can only decode AAC via decodeAudioData in the mix path.
    if (soleSource?.file && soleSource.type === 'video' && targetCodec !== 'opus') {
        const clip = usable[0];
        const meta = await getAudioTrackMeta(soleSource.file);
        if (meta) {
            const result: EncodedAudioChunk[] = [];
            const clipEnd = clip.sourceOffset + clip.duration;
            const shift = clip.time - clip.sourceOffset;
            for await (const chunk of streamAudioChunks(soleSource.file, signal)) {
                if (signal.aborted) break;
                const srcSec = chunk.timestamp / 1e6;
                if (srcSec < clip.sourceOffset) continue;
                if (srcSec >= clipEnd) break;
                const outputTs = Math.round((srcSec + shift) * 1e6);
                const data = new Uint8Array(chunk.byteLength);
                chunk.copyTo(data);
                result.push(new EncodedAudioChunk({ type: chunk.type, timestamp: outputTs, duration: chunk.duration ?? undefined, data }));
            }
            return { chunks: result, meta };
        }
    }

    const files = new Map<string, File>();
    for (const clip of usable) {
        const file = sourceMap.get(clip.sourceId)?.file;
        if (file) files.set(clip.sourceId, file);
    }
    return mixClipAudio(usable, files, signal, targetCodec);
}

export async function exportVideo(
    videoClips: Clip[],
    audioClips: Clip[],
    sources: MediaSource[],
    players: Player[],
    onProgress: (p: ExportProgress) => void,
    signal: AbortSignal,
    options: ExportOptions,
    hiddenVideoTrackIds?: Set<string>,
): Promise<void> {
    const { fps = 60, overlay } = options;
    const videoLayerHidden = overlay.layers.some((l) => l.id === 'video' && !l.visible);
    // DISPLAY_CARD uses its own configured enter/exit animation length.
    const cardAnim = cardDisplayAnimSeconds(overlay.cardDisplay);
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    // Visual clips = video + image (both live on the Video track group), sorted
    // by output start. Composited together, back-to-front, per output frame.
    const sortedVisualClips = [...videoClips].sort((a, b) => a.time - b.time);
    const sortedAudioClips = [...audioClips].sort((a, b) => a.time - b.time);
    // Audio can only be extracted from actual video sources (images have none).
    const videoOnlyClips = sortedVisualClips.filter((c) => c.type === ClipType.Video);

    if (sortedVisualClips.length === 0 && sortedAudioClips.length === 0)
        throw new Error('Nothing to export — add video, image, or audio clips.');

    for (const clip of [...sortedVisualClips, ...sortedAudioClips]) {
        const src = sourceMap.get(clip.sourceId);
        if (!src?.file) {
            throw new Error(`Source "${src?.name ?? clip.sourceId}" is not linked. Use Relink Media to restore it.`);
        }
    }

    const totalDuration = Math.max(
        0,
        ...sortedVisualClips.map(c => c.time + c.duration),
        ...sortedAudioClips.map(c => c.time + c.duration),
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

    // Per-source decoder config, fetched + support-checked lazily on first use so
    // clips from different-codec sources each decode with their own config.
    const videoConfigs = new Map<string, VideoDecoderConfig>();
    const ensureVideoConfig = async (source: MediaSource): Promise<VideoDecoderConfig> => {
        const cached = videoConfigs.get(source.id);
        if (cached) return cached;
        const { config } = await getVideoTrackMeta(source.file!);
        const support = await VideoDecoder.isConfigSupported(config);
        if (!support.supported)
            throw new Error(`VideoDecoder does not support codec "${config.codec}" for source "${source.name}".`);
        videoConfigs.set(source.id, config);
        return config;
    };

    // Decode every image source once to an ImageBitmap (a valid CanvasImageSource).
    emit('loading', 'Loading images…');
    const imageBitmaps = new Map<string, ImageBitmap>();
    for (const source of sources) {
        if (source.type === 'image' && source.file) {
            try {
                imageBitmaps.set(source.id, await createImageBitmap(source.file));
            } catch {
                // Undecodable image — its clips will simply be skipped.
            }
        }
    }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

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
    const audioSourceClips = sortedAudioClips.length > 0 ? sortedAudioClips : videoOnlyClips;
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
    // One decode cursor per active video clip, created lazily / disposed on exit.
    const providers = new Map<string, VideoClipProvider>();

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

    // Composite the given layer stack (back-to-front) into one output frame and
    // encode it. Empty layers -> black (letterbox / gap).
    const encodeFrame = async (layers: BaseLayer[]) => {
        const targetSec = targetTimes[frameIdx];
        const timestampUs = Math.round(targetSec * 1e6);
        await updateOverlay(targetSec);
        if (layers.length > 0) compositor.uploadBaseLayers(layers);
        else compositor.uploadBlackFrame();
        const composed = compositor.compose(timestampUs, Math.round(1e6 / fps));
        encoder.encode(composed, frameIdx % (Math.round(fps) * 10) === 0);
        composed.close();
        muxer.feedAudioUpTo(audioChunks, timestampUs);
        framesEncoded++;
        emit('frames', `Frame ${framesEncoded} / ${totalFrames}`);
        await encoder.drainIfNeeded(frameIdx + 1, 150);
        if (encoder.error) throw encoder.error;
    };

    exportStartTime = performance.now();

    try {
        // Output-frame-driven: for each frame, composite EVERY clip active at that
        // time (video via a per-clip decode cursor, images via a decoded bitmap),
        // back-to-front, mirroring the live preview's renderFrame.
        for (frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const t = targetTimes[frameIdx];
            const active = sortedVisualClips.filter((c) => c.time <= t && t < c.time + c.duration);
            const activeIds = new Set(active.map((c) => c.id));
            // Retire decoders for clips that just went inactive.
            for (const [id, p] of providers) {
                if (!activeIds.has(id)) { p.dispose(); providers.delete(id); }
            }

            const layers: BaseLayer[] = [];
            if (!videoLayerHidden) {
                for (const clip of active) {
                    if (clip.trackId && hiddenVideoTrackIds?.has(clip.trackId)) continue;
                    const source = sourceMap.get(clip.sourceId);
                    if (!source) continue;
                    let frame: CanvasImageSource | null = null;
                    let srcW = source.width ?? 0;
                    let srcH = source.height ?? 0;
                    if (clip.type === ClipType.Image) {
                        const bmp = imageBitmaps.get(clip.sourceId);
                        if (!bmp) continue;
                        frame = bmp;
                        srcW = srcW || bmp.width;
                        srcH = srcH || bmp.height;
                    } else {
                        let provider = providers.get(clip.id);
                        if (!provider) {
                            const config = await ensureVideoConfig(source);
                            provider = new VideoClipProvider(source.file!, config, signal);
                            providers.set(clip.id, provider);
                        }
                        const vf = await provider.frameAt(clip.sourceOffset + (t - clip.time));
                        if (!vf) continue;
                        frame = vf;
                        srcW = srcW || vf.displayWidth;
                        srcH = srcH || vf.displayHeight;
                    }
                    if (!frame || !srcW || !srcH) continue;
                    layers.push({
                        frame,
                        srcWidth: srcW,
                        srcHeight: srcH,
                        transform: resolveTransform(clip, source, EXPORT_RESOLUTION),
                        crop: clip.crop ?? NO_CROP,
                    });
                }
            }
            await encodeFrame(layers);
        }

        debug(`loop done — frameIdx=${frameIdx} totalFrames=${totalFrames}`);
        muxer.feedAudioUpTo(audioChunks, Number.MAX_SAFE_INTEGER);
        debug('calling encoder.flush');
        await encoder.flush();
        debug('encoder.flush done');
        if (encoder.error) throw encoder.error;
        encoder.close();
        muxer.finalize();
        debug('muxer finalized — closing stream');
        await writableStream.close();
        debug('done');
    } finally {
        for (const p of providers.values()) p.dispose();
        providers.clear();
        for (const b of imageBitmaps.values()) b.close();
        imageBitmaps.clear();
        compositor.dispose();
        try { await writableStream.abort(); } catch { /* ignore — already closed on success */ }
    }
}
