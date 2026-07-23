import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Player } from './types/player';
import type { Clip } from './types/clip';
import type { MediaSource } from './types/source';
import { getNextChangeTime, UI_FADE_MS } from '@/lib/deriveState';
import { Compositor } from '@/lib/export/compose';
import type { OverlayConfig } from '@/lib/export/compose';
import { cardDisplayAnimSeconds } from '@/lib/overlayData';
import { HAND_ANIM_DURATION } from '@/renders/renderLiveHand';
import { ANNOTATION_ANIM_DURATION } from '@/renders/renderLiveAnnotation';
import { subscribeImageLoad } from '@/lib/cardCache';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';

// Per-frame overlay-raster budget (dev warning only). ~half a 60fps frame,
// leaving headroom for video upload + GL draw.
const OVERLAY_FRAME_BUDGET_MS = 8;

export interface VideoPreviewHandle {
    // Seek from outside (timeline/skip buttons) without routing time through
    // App state. Paused -> paints one frame; playing -> re-detects clips.
    seek(t: number): void;
}

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTimeRef: RefObject<number>;
    setIsPlaying: (playing: boolean) => void;
    players: Player[];
    overlayConfig: OverlayConfig;
    duration?: number;
    videoClips?: Clip[];
    audioClips?: Clip[];
    sources?: MediaSource[];
    hiddenVideoTrackIds?: Set<string>;
    mutedAudioTrackIds?: Set<string>;
    volume?: number;
    onVolumeChange?: (v: number) => void;
}

const VideoPreview = forwardRef<VideoPreviewHandle, VideoPreviewProps>(function VideoPreview({
    isPlaying,
    currentTimeRef,
    setIsPlaying,
    players,
    overlayConfig,
    duration = Infinity,
    videoClips = [],
    audioClips = [],
    sources = [],
    hiddenVideoTrackIds,
    mutedAudioTrackIds,
    volume = 100,
    onVolumeChange,
}: VideoPreviewProps, ref) {
    const setVolume = onVolumeChange ?? NOOP;
    const [isHovered, setIsHovered] = useState(false);
    const volumeRef = useRef(volume / 100);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef(players);
    const overlayConfigRef = useRef(overlayConfig);
    const prevTimeRef = useRef(-1);
    const eyeRef = useRef<HTMLImageElement | null>(null);
    const compositorRef = useRef<Compositor | null>(null);
    const derivedCacheRef = useRef<{ validUntil: number } | null>(null);
    const isPlayingRef = useRef(isPlaying);
    const durationRef = useRef(duration);
    const renderFrameRef = useRef<() => void>(() => {});
    // Muted video elements — video frames only, no audio
    const sourceVideoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
    // Unmuted audio elements — audio playback from audio clips
    const sourceAudioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
    const videoClipsRef = useRef(videoClips);
    videoClipsRef.current = videoClips;
    const audioClipsRef = useRef(audioClips);
    audioClipsRef.current = audioClips;
    const activeVideoClipIdRef = useRef<string | null>(null);
    const activeVideoSourceIdRef = useRef<string | null>(null);
    const activeAudioClipIdRef = useRef<string | null>(null);
    const activeAudioSourceIdRef = useRef<string | null>(null);
    // Snapshot-anchored time: cursor is independent of live clip.time so dragging a clip
    // while playing doesn't move the playhead. clipTimeAtStart lets us detect clip drag
    // and re-seek when the clip's position changes.
    const clipPlaybackSnapshotRef = useRef<{
        clipId: string;
        clipTimeAtStart: number;
        outputTimeAtStart: number;
        sourceTimeAtStart: number;
    } | null>(null);
    const audioPlaybackSnapshotRef = useRef<{
        clipId: string;
        clipTimeAtStart: number;
        outputTimeAtStart: number;
        sourceTimeAtStart: number;
    } | null>(null);
    const hiddenVideoTrackIdsRef = useRef(new Set(hiddenVideoTrackIds ?? []));
    const mutedAudioTrackIdsRef = useRef(new Set(mutedAudioTrackIds ?? []));

    const getActiveVideoClip = (t: number) =>
        videoClipsRef.current.find((c) => c.time <= t && t < c.time + c.duration) ?? null;
    const getActiveAudioClip = (t: number) =>
        audioClipsRef.current.find((c) => c.time <= t && t < c.time + c.duration) ?? null;

    const pauseAllSourceVideos = () => {
        for (const el of sourceVideoEls.current.values()) el.pause();
        for (const el of sourceAudioEls.current.values()) el.pause();
        activeVideoClipIdRef.current = null;
        activeVideoSourceIdRef.current = null;
        activeAudioClipIdRef.current = null;
        activeAudioSourceIdRef.current = null;
    };

    const seekSourceEl = (el: HTMLVideoElement | HTMLAudioElement, clip: Clip, t: number, play: boolean) => {
        const targetTime = clip.sourceOffset + (t - clip.time);
        el.currentTime = targetTime;
        if (play) {
            el.play()?.catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
        } else {
            el.pause();
            if (el instanceof HTMLVideoElement) {
                el.addEventListener('seeked', () => renderFrameRef.current(), { once: true });
            }
        }
    };

    useEffect(() => {
        const img = new Image();
        img.onload = () => { eyeRef.current = img; };
        img.src = '/assets/eye.svg';
    }, []);

    // Manage per-source video/audio elements for clip playback.
    useEffect(() => {
        const videoPool = sourceVideoEls.current;
        const audioPool = sourceAudioEls.current;
        const activeIds = new Set(sources.map((s) => s.id));

        for (const src of sources) {
            if (!src.file) continue;
            if (src.type === 'video' && !videoPool.has(src.id)) {
                const el = document.createElement('video');
                el.src = URL.createObjectURL(src.file);
                el.preload = 'auto';
                el.muted = true;
                videoPool.set(src.id, el);
            }
            if (!audioPool.has(src.id)) {
                const el = document.createElement('audio');
                el.src = URL.createObjectURL(src.file);
                el.preload = 'auto';
                audioPool.set(src.id, el);
            }
        }
        for (const [id, el] of videoPool) {
            if (!activeIds.has(id)) { URL.revokeObjectURL(el.src); videoPool.delete(id); }
        }
        for (const [id, el] of audioPool) {
            if (!activeIds.has(id)) { URL.revokeObjectURL(el.src); audioPool.delete(id); }
        }
    }, [sources]);

    // Init compositor on mount — full-canvas layout + black frame.
    // Layout stays at 1920x1080 always; uploadVideoElement stretches the texture to fill.
    useEffect(() => {
        const canvas = canvasRef.current!;
        canvas.width = 1920;
        canvas.height = 1080;
        const comp = new Compositor(1920, 1080, canvas);
        comp.setLayout(1920, 1080, 0, 0);
        comp.uploadBlackFrame();
        compositorRef.current = comp;
        renderFrameRef.current();
        return () => {
            comp.dispose();
            compositorRef.current = null;
        };
    }, []);

    isPlayingRef.current = isPlaying;
    overlayConfigRef.current = overlayConfig;
    durationRef.current = duration;

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

        // Upload video frame — source element position is managed by seekSourceEl (paused scrub)
        // and the render loop (playback transitions + clip drag detection).
        const activeVideoClip = getActiveVideoClip(time);
        const frameEl = activeVideoClip ? sourceVideoEls.current.get(activeVideoClip.sourceId) : null;
        const videoHidden = !!activeVideoClip?.trackId && hiddenVideoTrackIdsRef.current.has(activeVideoClip.trackId);
        const videoLayerHidden = overlayConfigRef.current.layers.some((l) => l.id === 'video' && !l.visible);
        if (!videoHidden && !videoLayerHidden && frameEl?.videoWidth) {
            compositor.uploadVideoElement(frameEl);
        } else {
            compositor.uploadBlackFrame();
        }

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
        if (!activeAudioSourceIdRef.current) return;
        const audioEl = sourceAudioEls.current.get(activeAudioSourceIdRef.current);
        if (!audioEl) return;
        const clip = audioClipsRef.current.find((c) => c.id === activeAudioClipIdRef.current);
        const muted = clip?.trackId && mutedAudioTrackIdsRef.current.has(clip.trackId);
        audioEl.volume = muted ? 0 : volumeRef.current;
    }, [mutedAudioTrackIds]);

    useEffect(() => {
        volumeRef.current = volume / 100;
        if (!activeAudioSourceIdRef.current) return;
        const audioEl = sourceAudioEls.current.get(activeAudioSourceIdRef.current);
        if (!audioEl) return;
        const clip = audioClipsRef.current.find((c) => c.id === activeAudioClipIdRef.current);
        const muted = clip?.trackId && mutedAudioTrackIdsRef.current.has(clip.trackId);
        audioEl.volume = muted ? 0 : volumeRef.current;
    }, [volume]);

    // Source element play/pause + snapshot reset
    useEffect(() => {
        if (!isPlaying) {
            pauseAllSourceVideos();
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
        } else {
            // Force re-detection of active clips so the render loop captures fresh snapshots.
            activeVideoClipIdRef.current = null;
            activeAudioClipIdRef.current = null;
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
        }
    }, [isPlaying]);

    // Unified clock-driven render loop
    useEffect(() => {
        if (!isPlaying) return;

        // If playback starts at end of timeline (e.g. after reaching duration), restart from 0.
        if (currentTimeRef.current >= durationRef.current) {
            currentTimeRef.current = 0;
        }

        let handle: number;
        let lastTs = performance.now();

        const loop = (ts: number) => {
            const t = currentTimeRef.current;

            // --- Video clip transitions ---
            const activeVideoClip = getActiveVideoClip(t);
            const videoEl = activeVideoClip ? sourceVideoEls.current.get(activeVideoClip.sourceId) : null;
            const prevVideoId = activeVideoClipIdRef.current;
            const newVideoId = activeVideoClip?.id ?? null;

            if (newVideoId !== prevVideoId) {
                // Clip changed (or entered/exited a clip)
                if (prevVideoId && activeVideoSourceIdRef.current) {
                    sourceVideoEls.current.get(activeVideoSourceIdRef.current)?.pause();
                }
                if (activeVideoClip && videoEl) {
                    seekSourceEl(videoEl, activeVideoClip, t, true);
                    clipPlaybackSnapshotRef.current = {
                        clipId: activeVideoClip.id,
                        clipTimeAtStart: activeVideoClip.time,
                        outputTimeAtStart: t,
                        sourceTimeAtStart: activeVideoClip.sourceOffset + (t - activeVideoClip.time),
                    };
                    activeVideoClipIdRef.current = newVideoId;
                    activeVideoSourceIdRef.current = activeVideoClip.sourceId;
                } else {
                    activeVideoClipIdRef.current = null;
                    activeVideoSourceIdRef.current = null;
                    clipPlaybackSnapshotRef.current = null;
                }
            } else if (activeVideoClip && videoEl && clipPlaybackSnapshotRef.current) {
                // Same clip — detect if it was dragged to a new position
                if (activeVideoClip.time !== clipPlaybackSnapshotRef.current.clipTimeAtStart) {
                    seekSourceEl(videoEl, activeVideoClip, t, true);
                    clipPlaybackSnapshotRef.current = {
                        clipId: activeVideoClip.id,
                        clipTimeAtStart: activeVideoClip.time,
                        outputTimeAtStart: t,
                        sourceTimeAtStart: activeVideoClip.sourceOffset + (t - activeVideoClip.time),
                    };
                    // Forward seeks leave videoEl.currentTime briefly at the old position,
                    // causing a transient clock dip that can push audio out of sync. Resync
                    // audio to the current output time so any drift is corrected immediately.
                    const syncAudioClip = getActiveAudioClip(t);
                    const syncAudioEl = syncAudioClip
                        ? sourceAudioEls.current.get(syncAudioClip.sourceId)
                        : null;
                    if (syncAudioClip && syncAudioEl) {
                        seekSourceEl(syncAudioEl, syncAudioClip, t, true);
                        audioPlaybackSnapshotRef.current = {
                            clipId: syncAudioClip.id,
                            clipTimeAtStart: syncAudioClip.time,
                            outputTimeAtStart: t,
                            sourceTimeAtStart: syncAudioClip.sourceOffset + (t - syncAudioClip.time),
                        };
                        activeAudioClipIdRef.current = syncAudioClip.id;
                        activeAudioSourceIdRef.current = syncAudioClip.sourceId;
                    }
                }
            }

            // --- Audio clip transitions ---
            const activeAudioClip = getActiveAudioClip(t);
            const audioEl = activeAudioClip ? sourceAudioEls.current.get(activeAudioClip.sourceId) : null;
            const prevAudioId = activeAudioClipIdRef.current;
            const newAudioId = activeAudioClip?.id ?? null;

            if (newAudioId !== prevAudioId) {
                if (prevAudioId && activeAudioSourceIdRef.current) {
                    sourceAudioEls.current.get(activeAudioSourceIdRef.current)?.pause();
                }
                if (activeAudioClip && audioEl) {
                    seekSourceEl(audioEl, activeAudioClip, t, true);
                    audioEl.volume = activeAudioClip.trackId && mutedAudioTrackIdsRef.current.has(activeAudioClip.trackId) ? 0 : volumeRef.current;
                    audioPlaybackSnapshotRef.current = {
                        clipId: activeAudioClip.id,
                        clipTimeAtStart: activeAudioClip.time,
                        outputTimeAtStart: t,
                        sourceTimeAtStart: activeAudioClip.sourceOffset + (t - activeAudioClip.time),
                    };
                    activeAudioClipIdRef.current = newAudioId;
                    activeAudioSourceIdRef.current = activeAudioClip.sourceId;
                } else {
                    activeAudioClipIdRef.current = null;
                    activeAudioSourceIdRef.current = null;
                    audioPlaybackSnapshotRef.current = null;
                }
            } else if (activeAudioClip && audioEl && audioPlaybackSnapshotRef.current) {
                if (activeAudioClip.time !== audioPlaybackSnapshotRef.current.clipTimeAtStart) {
                    seekSourceEl(audioEl, activeAudioClip, t, true);
                    audioPlaybackSnapshotRef.current = {
                        clipId: activeAudioClip.id,
                        clipTimeAtStart: activeAudioClip.time,
                        outputTimeAtStart: t,
                        sourceTimeAtStart: activeAudioClip.sourceOffset + (t - activeAudioClip.time),
                    };
                }
            }

            // Advance output time from video element clock (via snapshot) or wall clock.
            // Using snapshot anchor means live clip.time changes (drag) don't move the cursor.
            let next: number;
            const snap = clipPlaybackSnapshotRef.current;
            if (videoEl && !videoEl.paused && snap) {
                const snapNext = snap.outputTimeAtStart + (videoEl.currentTime - snap.sourceTimeAtStart);
                // If video element hasn't finished seeking yet, currentTime is still at the old
                // position, making snapNext go backward. Fall back to wall clock until it catches up.
                next = snapNext >= t
                    ? Math.min(snapNext, durationRef.current)
                    : Math.min(t + (ts - lastTs) / 1000, durationRef.current);
            } else {
                next = Math.min(t + (ts - lastTs) / 1000, durationRef.current);
            }
            lastTs = ts;
            // currentTimeRef is the single source of truth; the playhead cursor
            // reads it imperatively (usePlayhead rAF), so no React state update
            // per tick -> App never re-renders during playback.
            currentTimeRef.current = next;
            if (next >= durationRef.current) {
                setIsPlaying(false);
                renderFrameRef.current();
                return;
            }
            renderFrameRef.current();
            handle = requestAnimationFrame(loop);
        };
        handle = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(handle);
    }, [isPlaying]);

    // Imperative seek — the timeline / skip buttons call this instead of routing
    // a currentTime value through App state (which re-rendered the whole tree
    // ~10Hz). Paused: seek source media + paint one frame. Playing: reset active-
    // clip tracking so the render loop re-detects from the new position. An
    // explicit call is unambiguously a user seek, so no delta heuristic is needed.
    const seek = (t: number) => {
        const time = Math.max(0, Math.min(durationRef.current, t));
        currentTimeRef.current = time;
        if (!isPlayingRef.current) {
            pauseAllSourceVideos();
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
            // Overlay must re-derive at the new time; the seek no longer rides a
            // React re-render, so invalidate the cache explicitly.
            derivedCacheRef.current = null;

            const activeVideoClip = getActiveVideoClip(time);
            if (activeVideoClip) {
                const el = sourceVideoEls.current.get(activeVideoClip.sourceId);
                // Repaints again via 'seeked' once the video lands on the frame.
                if (el) seekSourceEl(el, activeVideoClip, time, false);
            }
            const activeAudioClip = getActiveAudioClip(time);
            if (activeAudioClip) {
                const el = sourceAudioEls.current.get(activeAudioClip.sourceId);
                if (el) seekSourceEl(el, activeAudioClip, time, false);
            }
            // Always paint one frame now (overlay + current video texture), so a
            // paused seek is never silent even if 'seeked' doesn't fire.
            renderFrameRef.current();
        } else {
            activeVideoClipIdRef.current = null;
            activeAudioClipIdRef.current = null;
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
        }
    };
    useImperativeHandle(ref, () => ({ seek }));

    return (
        <div
            className="relative w-full h-full flex items-center justify-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: '16/9' }} />
            {isHovered && <VideoControls volume={volume} onVolumeChange={setVolume} />}
        </div>
    );
});

// Stable no-op fallback so the memo below isn't defeated by a fresh closure when
// no onVolumeChange is supplied.
const NOOP = () => {};

// Split out + memoized so hover/prop-driven re-renders of VideoPreview don't
// reconcile the controls (they only depend on `volume`).
const VideoControls = memo(function VideoControls({
    volume,
    onVolumeChange,
}: {
    volume: number;
    onVolumeChange: (v: number) => void;
}) {
    return (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md bg-black/60 px-3 py-2 backdrop-blur-sm">
            <button
                onClick={() => onVolumeChange(volume === 0 ? 100 : 0)}
                className="text-white/80 hover:text-white transition-colors"
            >
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <Slider
                value={[volume]}
                onValueChange={([v]) => onVolumeChange(v)}
                min={0}
                max={100}
                step={1}
                className="w-24"
            />
        </div>
    );
});

export default VideoPreview;
