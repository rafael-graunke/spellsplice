import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { RefObject } from 'react';
import type { Player } from '../../types/player';
import type { Clip } from '../../types/clip';
import { ClipType } from '../../types/clip';
import type { MediaSource } from '../../types/source';
import type { Resolution } from '../../types/config';
import { DEFAULT_RESOLUTION } from '../../types/config';
import { getNextChangeTime, UI_FADE_MS } from '@/lib/deriveState';
import { Compositor } from '@/features/export/compose';
import type { OverlayConfig } from '@/features/export/compose';
import type { BaseLayer } from '@/renders/composeClips';
import { resolveTransform, NO_CROP } from '@/lib/clipTransform';
import { AudioEngine } from './audioEngine';
import { cardDisplayAnimSeconds } from '@/lib/overlayData';
import { HAND_ANIM_DURATION } from '@/renders/renderLiveHand';
import { ANNOTATION_ANIM_DURATION } from '@/renders/renderLiveAnnotation';
import { subscribeImageLoad } from '@/lib/cardCache';
import PlaybackControls from './PlaybackControls';

// Per-frame overlay-raster budget (dev warning only). ~half a 60fps frame,
// leaving headroom for video upload + GL draw.
const OVERLAY_FRAME_BUDGET_MS = 8;

export interface ClipTransformOverride {
    clipId: string;
    transform: import('../../types/clip').ClipTransform;
    crop?: import('../../types/clip').ClipCrop;
}

export interface VideoPreviewHandle {
    // Seek from outside (timeline/skip buttons) without routing time through
    // App state. Paused -> paints one frame; playing -> re-detects clips.
    seek(t: number): void;
    // Live gizmo drag: override one clip's transform/crop imperatively (no App
    // re-render) and repaint. Pass null to clear.
    setTransformOverride(o: ClipTransformOverride | null): void;
    // Bounding rect of the on-screen canvas, for screen<->project mapping.
    getCanvasRect(): DOMRect | null;
    repaint(): void;
}

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTimeRef: RefObject<number>;
    setIsPlaying: (playing: boolean) => void;
    /** JKL shuttle speed. Forward only (>= 1); 1 is normal playback. */
    playbackRate?: number;
    setPlaybackRate?: (rate: number) => void;
    players: Player[];
    overlayConfig: OverlayConfig;
    duration?: number;
    videoClips?: Clip[];
    audioClips?: Clip[];
    sources?: MediaSource[];
    resolution?: Resolution;
    hiddenVideoTrackIds?: Set<string>;
    mutedAudioTrackIds?: Set<string>;
    volume?: number;
    onVolumeChange?: (v: number) => void;
    inPoint?: number | null;
    outPoint?: number | null;
    loop?: boolean;
    onToggleLoop?: () => void;
    // A click on the preview surface, reported in project (canvas) coordinates,
    // for hit-testing which clip was clicked.
    onCanvasClick?: (x: number, y: number) => void;
}

const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(function VideoPreview({
    isPlaying,
    currentTimeRef,
    setIsPlaying,
    playbackRate = 1,
    setPlaybackRate = NOOP_RATE,
    players,
    overlayConfig,
    duration = Infinity,
    videoClips = [],
    audioClips = [],
    sources = [],
    resolution = DEFAULT_RESOLUTION,
    hiddenVideoTrackIds,
    mutedAudioTrackIds,
    volume = 100,
    onVolumeChange,
    inPoint = null,
    outPoint = null,
    loop = false,
    onToggleLoop = NOOP,
    onCanvasClick,
}: VideoPreviewProps, ref) {
    const setVolume = onVolumeChange ?? NOOP;
    const volumeRef = useRef(volume / 100);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef(players);
    const overlayConfigRef = useRef(overlayConfig);
    const prevTimeRef = useRef(-1);
    const eyeRef = useRef<HTMLImageElement | null>(null);
    const compositorRef = useRef<Compositor | null>(null);
    const derivedCacheRef = useRef<{ validUntil: number } | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const rateRef = useRef(playbackRate);
    const durationRef = useRef(duration);
    const loopRef = useRef(loop);
    const inPointRef = useRef(inPoint);
    const outPointRef = useRef(outPoint);
    const renderFrameRef = useRef<() => void>(() => {});
    // One object URL per source file; shared by every clip that references it.
    const sourceUrls = useRef<Map<string, string>>(new Map());
    // Decoded still images, one per image source (no per-clip playback state).
    const sourceImageEls = useRef<Map<string, HTMLImageElement>>(new Map());
    // Per-CLIP video elements (not per-source): two clips of the same source at
    // different offsets need independent currentTime, so they can't share one
    // element. Created lazily when a clip first becomes active; pruned when the
    // clip leaves the timeline. Video elements are muted (frames only) — all
    // audible sound comes from the Web Audio engine below.
    const clipVideoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
    // Web Audio mixing engine: decodes each source once and schedules a buffer
    // source per audio clip, so overlapping / same-source clips mix cleanly with
    // no re-seeking. Created lazily on first play (needs a user gesture).
    const audioEngineRef = useRef<AudioEngine | null>(null);
    const getAudioEngine = () => {
        if (!audioEngineRef.current) audioEngineRef.current = new AudioEngine();
        return audioEngineRef.current;
    };
    const videoClipsRef = useRef(videoClips);
    videoClipsRef.current = videoClips;
    const audioClipsRef = useRef(audioClips);
    audioClipsRef.current = audioClips;
    const sourcesRef = useRef(sources);
    sourcesRef.current = sources;
    const resolutionRef = useRef(resolution);
    resolutionRef.current = resolution;
    const hiddenVideoTrackIdsRef = useRef(new Set(hiddenVideoTrackIds ?? []));
    const mutedAudioTrackIdsRef = useRef(new Set(mutedAudioTrackIds ?? []));
    // Live gizmo-drag override for a single clip's transform/crop (imperative).
    const transformOverrideRef = useRef<ClipTransformOverride | null>(null);

    // All clips whose [time, time+duration) window contains t, in array order
    // (bottom track first = back-to-front for compositing).
    const getActiveVideoClips = (t: number) =>
        videoClipsRef.current.filter((c) => c.time <= t && t < c.time + c.duration);

    const ensureVideoEl = (clip: Clip): HTMLVideoElement | null => {
        const existing = clipVideoEls.current.get(clip.id);
        if (existing) return existing;
        const url = sourceUrls.current.get(clip.sourceId);
        if (!url) return null;
        const el = document.createElement('video');
        el.src = url;
        el.preload = 'auto';
        el.muted = true;
        clipVideoEls.current.set(clip.id, el);
        return el;
    };

    const pauseAllVideo = () => {
        for (const el of clipVideoEls.current.values()) el.pause();
    };

    // The video clip whose element clock drives the master time when there is no
    // audio playing (audio, when present, is the master clock — see the loop).
    const pickVideoClock = (t: number): { clip: Clip; el: HTMLVideoElement } | null => {
        for (const c of getActiveVideoClips(t)) {
            if (c.type === ClipType.Image) continue;
            const el = clipVideoEls.current.get(c.id);
            if (el) return { clip: c, el };
        }
        return null;
    };

    // Chase every active VIDEO element to the master clock (audio is handled by
    // the engine), and pause every element whose clip is behind the playhead.
    // The clockClipId element is left to run free — it IS the clock.
    const DRIFT = 0.15;
    const reconcileMedia = (t: number, playing: boolean, clockClipId?: string) => {
        const videoActive = getActiveVideoClips(t);
        const activeIds = new Set(videoActive.map((c) => c.id));
        for (const [id, el] of clipVideoEls.current) if (!activeIds.has(id)) el.pause();

        for (const clip of videoActive) {
            if (clip.type === ClipType.Image) continue;
            const el = ensureVideoEl(clip);
            if (!el) continue;
            if (playing && clip.id === clockClipId) {
                el.playbackRate = rateRef.current;
                el.play()?.catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
                continue;
            }
            syncEl(el, clip, t, playing);
        }
    };

    const syncEl = (el: HTMLVideoElement, clip: Clip, t: number, playing: boolean) => {
        const target = clip.sourceOffset + (t - clip.time);
        if (playing) {
            // At 16x a fixed window is narrower than one rAF tick, so the chase
            // would re-seek every frame and stall the decoder.
            const drift = DRIFT * rateRef.current;
            if (el.paused || Math.abs(el.currentTime - target) > drift) el.currentTime = target;
            el.playbackRate = rateRef.current;
            el.play()?.catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
        } else {
            el.pause();
            el.playbackRate = 1;
            el.currentTime = target;
            el.addEventListener('seeked', () => renderFrameRef.current(), { once: true });
        }
    };

    useEffect(() => {
        const img = new Image();
        img.onload = () => { eyeRef.current = img; };
        img.src = '/assets/eye.svg';
    }, []);

    // Manage one object URL per source + a decoded image per image source. The
    // per-clip video/audio elements are created lazily on activation (they share
    // these URLs); they're pruned by the clip-lifecycle effect below.
    useEffect(() => {
        const urls = sourceUrls.current;
        const images = sourceImageEls.current;
        const activeIds = new Set(sources.map((s) => s.id));

        for (const src of sources) {
            if (!src.file) continue;
            if (!urls.has(src.id)) urls.set(src.id, URL.createObjectURL(src.file));
            if (src.type === 'image' && !images.has(src.id)) {
                const img = new Image();
                img.onload = () => {
                    if (!isPlayingRef.current) renderFrameRef.current();
                };
                img.src = urls.get(src.id)!;
                images.set(src.id, img);
            }
        }
        for (const [id, url] of urls) {
            if (!activeIds.has(id)) {
                URL.revokeObjectURL(url);
                urls.delete(id);
                images.delete(id);
            }
        }
    }, [sources]);

    // Prune per-clip video elements for clips that left the timeline.
    useEffect(() => {
        const liveIds = new Set(videoClips.map((c) => c.id));
        for (const [id, el] of clipVideoEls.current) {
            if (!liveIds.has(id)) { el.pause(); clipVideoEls.current.delete(id); }
        }
    }, [videoClips]);

    // Reschedule audio when clips change while playing (add/remove/drag/trim).
    // A gain-only edit skips the reschedule: tearing down and restarting every
    // voice mid-playback is audible, and the rubber band commits on every drag.
    const scheduleSigRef = useRef('');
    useEffect(() => {
        const sig = audioClips
            .map((c) => `${c.id}:${c.sourceId}:${c.time}:${c.duration}:${c.sourceOffset}`)
            .join('|');
        const layoutChanged = sig !== scheduleSigRef.current;
        scheduleSigRef.current = sig;
        if (!isPlayingRef.current) return;
        if (layoutChanged) audioEngineRef.current?.reschedule(audioClips, sourcesRef.current);
        else audioEngineRef.current?.setClipGains(audioClips);
    }, [audioClips]);

    // Init compositor on mount — full-canvas layout + black frame. Base video is
    // now a per-clip layer stack (uploadBaseLayers); the shader's uVideoRect stays
    // full-frame and each clip carries its own fit/transform.
    useEffect(() => {
        const canvas = canvasRef.current!;
        const { width, height } = resolutionRef.current;
        canvas.width = width;
        canvas.height = height;
        const comp = new Compositor(width, height, canvas);
        comp.setLayout(width, height, 0, 0);
        comp.uploadBlackFrame();
        compositorRef.current = comp;
        renderFrameRef.current();
        return () => {
            comp.dispose();
            compositorRef.current = null;
            audioEngineRef.current?.dispose();
            audioEngineRef.current = null;
        };
    }, []);

    isPlayingRef.current = isPlaying;
    rateRef.current = playbackRate;
    overlayConfigRef.current = overlayConfig;
    durationRef.current = duration;
    loopRef.current = loop;
    inPointRef.current = inPoint;
    outPointRef.current = outPoint;

    // Scoreboard SVGs decode asynchronously; when one becomes ready, invalidate
    // the overlay cache and repaint so it appears on the next frame.
    const onScoreboardReady = () => {
        derivedCacheRef.current = null;
        renderFrameRef.current();
    };

    const renderFrame = () => {
        const compositor = compositorRef.current;
        if (!compositor) return;

        const time = currentTimeRef.current;
        const cache = derivedCacheRef.current;
        const overlayStale = !cache || time >= cache.validUntil || time < prevTimeRef.current;

        // Composite every active visual clip (video + image), back-to-front, each
        // with its own transform/crop. Element positions are reconciled to the
        // master clock by reconcileMedia (loop) / seek (paused scrub).
        const videoLayerHidden = overlayConfigRef.current.layers.some((l) => l.id === 'video' && !l.visible);
        const layers: BaseLayer[] = [];
        if (!videoLayerHidden) {
            const res = resolutionRef.current;
            for (const clip of getActiveVideoClips(time)) {
                if (clip.trackId && hiddenVideoTrackIdsRef.current.has(clip.trackId)) continue;
                const source = sourcesRef.current.find((s) => s.id === clip.sourceId);
                let frame: CanvasImageSource | null = null;
                let srcW = source?.width ?? 0;
                let srcH = source?.height ?? 0;
                if (clip.type === ClipType.Image) {
                    const img = sourceImageEls.current.get(clip.sourceId);
                    if (img?.complete && img.naturalWidth) {
                        frame = img;
                        srcW = srcW || img.naturalWidth;
                        srcH = srcH || img.naturalHeight;
                    }
                } else {
                    const el = clipVideoEls.current.get(clip.id);
                    if (el?.videoWidth) {
                        frame = el;
                        srcW = srcW || el.videoWidth;
                        srcH = srcH || el.videoHeight;
                    }
                }
                if (!frame || !srcW || !srcH) continue;
                const ov = transformOverrideRef.current;
                const overridden = ov && ov.clipId === clip.id;
                layers.push({
                    frame,
                    srcWidth: srcW,
                    srcHeight: srcH,
                    transform: overridden ? ov.transform : resolveTransform(clip, source, res),
                    crop: overridden ? (ov.crop ?? clip.crop ?? NO_CROP) : (clip.crop ?? NO_CROP),
                });
            }
        }
        if (layers.length) compositor.uploadBaseLayers(layers);
        else compositor.uploadBlackFrame();

        if (overlayStale) {
            // Dev-only guard: updateOverlay runs every frame during animation, so
            // a slow one is jank. Warn if it blows the per-frame budget (see the
            // overlay performance invariants in CLAUDE.md).
            const t0 = import.meta.env.DEV ? performance.now() : 0;
            compositor.updateOverlay(playersRef.current, time, eyeRef.current, overlayConfigRef.current, onScoreboardReady);
            if (import.meta.env.DEV) {
                const ms = performance.now() - t0;
                if (ms > OVERLAY_FRAME_BUDGET_MS) {
                    console.warn(`[overlay] updateOverlay ${ms.toFixed(1)}ms > ${OVERLAY_FRAME_BUDGET_MS}ms budget @ t=${time.toFixed(2)}s`);
                }
            }
            // Shared renderer animation lengths (ms -> s); UI fade is separate.
            const HAND_ANIM = HAND_ANIM_DURATION / 1000;
            const ANNO_ANIM = ANNOTATION_ANIM_DURATION / 1000;
            const ANIM_DURATION = Math.max(HAND_ANIM, ANNO_ANIM, UI_FADE_MS / 1000);
            // DISPLAY_CARD uses its own configured enter/exit animation length.
            const cardAnim = cardDisplayAnimSeconds(overlayConfigRef.current.cardDisplay);
            const anyAnimating = playersRef.current.some((p) =>
                p.track.events.some((e) => {
                    if (
                        e.type === 'ADD_TO_HAND' ||
                        e.type === 'REMOVE_FROM_HAND' ||
                        e.type === 'ANNOTATE_CARD' ||
                        e.type === 'UNANNOTATE_CARD' ||
                        e.type === 'HIDE_UI' ||
                        e.type === 'SHOW_UI' ||
                        // RESET clears the hand and every annotation slot, both
                        // of which animate out.
                        e.type === 'RESET'
                    ) {
                        return e.time <= time && e.time > time - ANIM_DURATION;
                    }
                    if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                        const end = e.time + e.duration;
                        return (
                            e.time <= time &&
                            time < end &&
                            (time - e.time < cardAnim || end - time <= cardAnim)
                        );
                    }
                    return false;
                }),
            );
            let validUntil = anyAnimating
                ? time + 0.001
                : getNextChangeTime(playersRef.current.map((p) => p.track), time);
            if (!anyAnimating) {
                for (const p of playersRef.current) {
                    for (const e of p.track.events) {
                        if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                            const exitStart = e.time + e.duration - cardAnim;
                            if (exitStart > time && exitStart < validUntil) {
                                validUntil = exitStart;
                            }
                        }
                    }
                }
            }
            derivedCacheRef.current = { validUntil };
            if (anyAnimating && isPlayingRef.current) {
                requestAnimationFrame(renderFrameRef.current);
            }
        }

        prevTimeRef.current = time;
        compositor.draw();
    };

    renderFrameRef.current = renderFrame;

    useEffect(() => {
        playersRef.current = players;
        derivedCacheRef.current = null;
        if (!isPlaying) renderFrame();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players]);

    useEffect(() => {
        return subscribeImageLoad(() => {
            derivedCacheRef.current = null;
            if (!isPlayingRef.current) {
                renderFrameRef.current();
            }
        });
    }, []);

    useEffect(() => {
        hiddenVideoTrackIdsRef.current = new Set(hiddenVideoTrackIds);
        if (!isPlayingRef.current) renderFrameRef.current();
    }, [hiddenVideoTrackIds]);

    // Repaint once when overlay-appearance settings change, so edits are visible
    // without needing to play/pause.
    useEffect(() => {
        derivedCacheRef.current = null;
        if (!isPlayingRef.current) renderFrameRef.current();
    }, [overlayConfig]);

    useEffect(() => {
        mutedAudioTrackIdsRef.current = new Set(mutedAudioTrackIds);
        audioEngineRef.current?.setMuted(mutedAudioTrackIdsRef.current, audioClipsRef.current);
    }, [mutedAudioTrackIds]);

    useEffect(() => {
        volumeRef.current = volume / 100;
        audioEngineRef.current?.setVolume(volumeRef.current);
    }, [volume]);

    useEffect(() => {
        if (!isPlaying) pauseAllVideo();
    }, [isPlaying]);

    // Audio runs at 1x only: the engine's transport anchor maps AudioContext time
    // to output time 1:1. This is also why the loop below can't use the audio
    // clock while shuttling.
    useEffect(() => {
        if (isPlaying && playbackRate === 1) {
            getAudioEngine().play(
                currentTimeRef.current,
                audioClipsRef.current,
                sourcesRef.current,
                volumeRef.current,
                mutedAudioTrackIdsRef.current,
            );
        } else {
            audioEngineRef.current?.pause();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying, playbackRate]);

    // Unified clock-driven render loop
    useEffect(() => {
        if (!isPlaying) return;

        // In/out bounds playback only while looping. Plain play runs through to
        // the end of the content, as it does in Premiere and Resolve: marking a
        // range for export must not quietly shorten the transport.
        const stopAt = () =>
            (loopRef.current ? outPointRef.current : null) ?? durationRef.current;
        const wrapTo = () => (loopRef.current ? inPointRef.current : null) ?? 0;

        if (currentTimeRef.current >= stopAt()) {
            currentTimeRef.current = wrapTo();
        }

        let handle: number;
        let lastTs = performance.now();

        const loop = (ts: number) => {
            // Master clock: the Web Audio engine's AudioContext clock when audio is
            // playing (sample-accurate, monotonic — used even across audio gaps);
            // else a video element's clock; else wall time. Video elements are
            // chased to this clock (a video re-seek isn't audible). A clip drag
            // never drags the playhead (clock is media/context time, not clip.time).
            const t = currentTimeRef.current;
            const engine = audioEngineRef.current;
            const rate = rateRef.current;
            const hasAudio = audioClipsRef.current.length > 0;
            const videoClock = pickVideoClock(t);
            // Only this branch scales: the media clocks below already advance at
            // `rate` on their own.
            const wall = t + ((ts - lastTs) / 1000) * rate;
            let next: number;
            if (hasAudio && engine?.isPlaying) {
                // Audio present at 1x -> the AudioContext clock is authoritative.
                next = engine.getOutputTime();
                if (!isFinite(next) || next < t - 0.5) next = wall;
            } else if (videoClock && !videoClock.el.paused && videoClock.el.readyState >= 2) {
                // No audio (or shuttling) -> ride a video element's own clock.
                next = videoClock.clip.time + (videoClock.el.currentTime - videoClock.clip.sourceOffset);
                if (!isFinite(next) || next < t - 0.5) next = wall;
            } else {
                next = wall;
            }
            const limit = stopAt();
            next = Math.min(next, limit);
            lastTs = ts;
            // currentTimeRef is the single source of truth; the playhead cursor
            // reads it imperatively (usePlayhead rAF), so no React state update
            // per tick -> App never re-renders during playback.
            currentTimeRef.current = next;
            // When audio is the clock, chase every video element to it. Otherwise
            // the video clock element is left free and the rest are chased.
            reconcileMedia(next, true, hasAudio ? undefined : videoClock?.clip.id);
            if (next >= limit) {
                if (loopRef.current) {
                    const start = wrapTo();
                    currentTimeRef.current = start;
                    reconcileMedia(start, true);
                    audioEngineRef.current?.seek(start, audioClipsRef.current, sourcesRef.current);
                    derivedCacheRef.current = null;
                    renderFrameRef.current();
                    handle = requestAnimationFrame(loop);
                    return;
                }
                setIsPlaying(false);
                pauseAllVideo();
                audioEngineRef.current?.pause();
                renderFrameRef.current();
                return;
            }
            renderFrameRef.current();
            handle = requestAnimationFrame(loop);
        };
        handle = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(handle);
        // reconcileMedia/setIsPlaying are stable-by-ref closures; the loop is
        // (re)started only on play/pause, matching the ref-driven design.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    // Imperative seek — the timeline / skip buttons call this instead of routing
    // a currentTime value through App state (which re-rendered the whole tree
    // ~10Hz). Paused: seek source media + paint one frame. Playing: reset active-
    // clip tracking so the render loop re-detects from the new position. An
    // explicit call is unambiguously a user seek, so no delta heuristic is needed.
    const seek = (t: number) => {
        // Lower bound only: the timeline extends past the last clip, and playback
        // still stops at durationRef in the render loop.
        const time = Math.max(0, t);
        currentTimeRef.current = time;
        // Video: pause elements whose clip isn't active at `time`, seek the rest.
        // Audio: the engine re-anchors + reschedules (playing), or is silent (paused).
        reconcileMedia(time, isPlayingRef.current);
        if (isPlayingRef.current) {
            audioEngineRef.current?.seek(time, audioClipsRef.current, sourcesRef.current);
        }
        if (!isPlayingRef.current) {
            // Overlay must re-derive at the new time; the seek no longer rides a
            // React re-render, so invalidate the cache explicitly.
            derivedCacheRef.current = null;
            // Always paint one frame now, so a paused seek is never silent even if
            // no 'seeked' event fires.
            renderFrameRef.current();
        }
    };
    // Stable identity for the memoized transport bar; `seek` is a fresh closure
    // per render.
    const seekRef = useRef(seek);
    seekRef.current = seek;
    const stableSeek = useCallback((t: number) => seekRef.current(t), []);

    useImperativeHandle(ref, () => ({
        seek,
        setTransformOverride(o: ClipTransformOverride | null) {
            transformOverrideRef.current = o;
            renderFrameRef.current();
        },
        getCanvasRect: () => canvasRef.current?.getBoundingClientRect() ?? null,
        repaint: () => {
            derivedCacheRef.current = null;
            renderFrameRef.current();
        },
    }));

    // Repaint when clip data changes while paused (e.g. a committed transform),
    // so edits show without needing to play/pause.
    useEffect(() => {
        if (!isPlayingRef.current) renderFrameRef.current();
    }, [videoClips, audioClips]);

    return (
        <div className="w-full h-full flex flex-col">
            <div
                className="relative flex-1 min-h-0 flex items-center justify-center"
                onClick={(e) => {
                    if (!onCanvasClick) return;
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect || rect.width === 0) return;
                    onCanvasClick(
                        ((e.clientX - rect.left) / rect.width) * resolution.width,
                        ((e.clientY - rect.top) / rect.height) * resolution.height,
                    );
                }}
            >
                <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: '16/9' }} />
            </div>
            <PlaybackControls
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                playbackRate={playbackRate}
                setPlaybackRate={setPlaybackRate}
                onSeek={stableSeek}
                currentTimeRef={currentTimeRef}
                duration={duration}
                volume={volume}
                onVolumeChange={setVolume}
                loop={loop}
                onToggleLoop={onToggleLoop}
                inPoint={inPoint}
                outPoint={outPoint}
            />
        </div>
    );
});

// Stable no-op fallbacks so the memoized children below aren't defeated by a
// fresh closure when the optional callback isn't supplied.
const NOOP = () => {};
const NOOP_RATE = () => {};

export default VideoPreview;
