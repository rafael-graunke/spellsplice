import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Player } from './types/player';
import type { Clip } from './types/clip';
import type { MediaSource } from './types/source';
import { getNextChangeTime } from '@/lib/deriveState';
import { Compositor } from '@/lib/export/compose';
import { subscribeImageLoad } from '@/lib/cardCache';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX } from 'lucide-react';

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
    currentTimeRef: RefObject<number>;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: (playing: boolean) => void;
    players: Player[];
    overlayStartHidden?: boolean;
    duration?: number;
    videoClips?: Clip[];
    audioClips?: Clip[];
    sources?: MediaSource[];
    hiddenVideoTrackIds?: Set<string>;
    mutedAudioTrackIds?: Set<string>;
}

function VideoPreview({
    isPlaying,
    currentTime,
    currentTimeRef,
    setCurrentTime,
    setIsPlaying,
    players,
    overlayStartHidden = false,
    duration = Infinity,
    videoClips = [],
    audioClips = [],
    sources = [],
    hiddenVideoTrackIds,
    mutedAudioTrackIds,
}: VideoPreviewProps) {
    const [volume, setVolume] = useState(100);
    const [isHovered, setIsHovered] = useState(false);
    const volumeRef = useRef(1);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const playersRef = useRef(players);
    const overlayStartHiddenRef = useRef(overlayStartHidden);
    const prevTimeRef = useRef(-1);
    const d20Ref = useRef<HTMLImageElement | null>(null);
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
    // Last time the render loop pushed to React state — used to distinguish user seeks
    // from the render loop's own throttled setCurrentTime calls.
    const lastLoopSetTimeRef = useRef<number>(0);
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
        img.onload = () => { d20Ref.current = img; };
        img.src = '/assets/d20.svg';
    }, []);

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
    overlayStartHiddenRef.current = overlayStartHidden;
    durationRef.current = duration;

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
        if (!videoHidden && frameEl?.videoWidth) {
            compositor.uploadVideoElement(frameEl);
        } else {
            compositor.uploadBlackFrame();
        }

        if (overlayStale) {
            compositor.updateOverlay(playersRef.current, time, d20Ref.current, eyeRef.current, overlayStartHiddenRef.current);
            const ANIM_DURATION = 0.35;
            const anyAnimating = playersRef.current.some((p) =>
                p.track.events.some((e) => {
                    if (
                        e.type === 'ADD_TO_HAND' ||
                        e.type === 'REMOVE_FROM_HAND' ||
                        e.type === 'STACK_DECK' ||
                        e.type === 'UNSTACK_DECK' ||
                        e.type === 'HIDE_UI' ||
                        e.type === 'SHOW_UI'
                    ) {
                        return e.time <= time && e.time > time - ANIM_DURATION;
                    }
                    if (e.type === 'DISPLAY_CARD' && e.duration != null) {
                        const end = e.time + e.duration;
                        return (
                            e.time <= time &&
                            time < end &&
                            (time - e.time < ANIM_DURATION || end - time <= ANIM_DURATION)
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
                            const exitStart = e.time + e.duration - ANIM_DURATION;
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
            setCurrentTime(0);
        }

        let handle: number;
        let lastTs = performance.now();
        let lastSetTime = 0;

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
            currentTimeRef.current = next;
            if (ts - lastSetTime > 100) {
                lastLoopSetTimeRef.current = next;
                setCurrentTime(next);
                lastSetTime = ts;
            }
            if (next >= durationRef.current) {
                lastLoopSetTimeRef.current = next;
                setCurrentTime(next);
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

    // Seek sync — fires on currentTime state changes.
    // When paused: seek source elements and render preview frame.
    // When playing: only act on user-initiated large seeks (not the render loop's own throttled updates).
    useEffect(() => {
        if (!isPlayingRef.current) {
            pauseAllSourceVideos();
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
            currentTimeRef.current = currentTime;

            const activeVideoClip = getActiveVideoClip(currentTime);
            if (activeVideoClip) {
                const el = sourceVideoEls.current.get(activeVideoClip.sourceId);
                if (el) seekSourceEl(el, activeVideoClip, currentTime, false);
            } else {
                renderFrameRef.current();
            }
            const activeAudioClip = getActiveAudioClip(currentTime);
            if (activeAudioClip) {
                const el = sourceAudioEls.current.get(activeAudioClip.sourceId);
                if (el) seekSourceEl(el, activeAudioClip, currentTime, false);
            }
        } else if (Math.abs(currentTime - lastLoopSetTimeRef.current) > 0.5) {
            // User seeked while playing — the render loop's own updates are small (~0.1s at 10Hz),
            // so a delta > 0.5s means the user dragged the playhead.
            currentTimeRef.current = currentTime;
            activeVideoClipIdRef.current = null;
            activeAudioClipIdRef.current = null;
            clipPlaybackSnapshotRef.current = null;
            audioPlaybackSnapshotRef.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime]);

    return (
        <div
            className="relative w-full h-full flex items-center justify-center"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: '16/9' }} />
            {isHovered && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md bg-black/60 px-3 py-2 backdrop-blur-sm">
                    <button
                        onClick={() => setVolume((v) => (v === 0 ? 100 : 0))}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <Slider
                        value={[volume]}
                        onValueChange={([v]) => setVolume(v)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-24"
                    />
                </div>
            )}
        </div>
    );
}

export default VideoPreview;
