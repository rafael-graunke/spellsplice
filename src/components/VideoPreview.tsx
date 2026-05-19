import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { VideoState } from './types/video';
import type { Player } from './types/player';
import { getNextChangeTime } from '@/lib/deriveState';
import { Compositor } from '@/lib/export/compose';
import { subscribeImageLoad } from '@/lib/cardCache';

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
    currentTimeRef: RefObject<number>;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: (playing: boolean) => void;
    video: VideoState | null;
    setVideo: React.Dispatch<React.SetStateAction<VideoState | null>>;
    players: Player[];
    fileToLoad?: File | null;
    overlayStartHidden?: boolean;
    duration?: number;
}

function VideoPreview({
    isPlaying,
    currentTime,
    currentTimeRef,
    setCurrentTime,
    setIsPlaying,
    video,
    setVideo,
    players,
    fileToLoad,
    overlayStartHidden = false,
    duration = Infinity,
}: VideoPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
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

    // Init compositor on mount — independent of video
    useEffect(() => {
        const canvas = canvasRef.current!;
        canvas.width = 1920;
        canvas.height = 1080;
        const comp = new Compositor(1920, 1080, canvas);
        compositorRef.current = comp;
        renderFrameRef.current();
        return () => {
            comp.dispose();
            compositorRef.current = null;
        };
    }, []);

    // Update compositor layout when video source changes
    useEffect(() => {
        const comp = compositorRef.current;
        if (!comp) return;
        if (video) {
            const v = video.videoEl;
            const scale = Math.min(1920 / v.videoWidth, 1080 / v.videoHeight);
            const drawW = Math.round(v.videoWidth * scale);
            const drawH = Math.round(v.videoHeight * scale);
            comp.setLayout(drawW, drawH, Math.round((1920 - drawW) / 2), Math.round((1080 - drawH) / 2));
        } else {
            // Full canvas layout so overlay render fns position correctly;
            // uploadBlackFrame gives solid black background via the shader.
            comp.setLayout(1920, 1080, 0, 0);
            comp.uploadBlackFrame();
        }
        derivedCacheRef.current = null;
        renderFrameRef.current();
    }, [video]);

    useEffect(() => {
        if (fileToLoad) handleFile(fileToLoad);
    }, [fileToLoad]);

    const handleFile = (file: File) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        const videoEl = videoRef.current!;
        videoEl.src = url;
        videoEl.preload = 'auto';
        videoEl.muted = false;
        videoEl.onloadedmetadata = () => {
            setVideo({ file, url, duration: videoEl.duration, videoEl });
        };
    };

    isPlayingRef.current = isPlaying;
    overlayStartHiddenRef.current = overlayStartHidden;
    durationRef.current = duration;

    const renderFrame = () => {
        const compositor = compositorRef.current;
        if (!compositor) return;

        const time = currentTimeRef.current;
        const cache = derivedCacheRef.current;
        const overlayStale = !cache || time >= cache.validUntil || time < prevTimeRef.current;

        if (video) {
            const v = video.videoEl;
            if (v.videoWidth && v.videoHeight) {
                compositor.uploadVideoElement(v);
            }
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
            if (anyAnimating && isPlayingRef.current && video && 'requestVideoFrameCallback' in video.videoEl) {
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

    // Video element play/pause control
    useEffect(() => {
        if (!video) return;
        const v = video.videoEl;
        if (isPlaying) {
            v.play();
            const handleEnded = () => {
                setIsPlaying(false);
                setCurrentTime(v.duration);
            };
            v.addEventListener('ended', handleEnded, { once: true });
            return () => v.removeEventListener('ended', handleEnded);
        } else {
            v.pause();
            currentTimeRef.current = v.currentTime;
            setCurrentTime(v.currentTime);
        }
    }, [isPlaying, video]);

    // Render loop — video-driven when video present, clock-driven otherwise
    useEffect(() => {
        if (!isPlaying) return;

        let handle: number;

        if (video) {
            const v = video.videoEl;
            if (v.requestVideoFrameCallback) {
                const rVFC = v.requestVideoFrameCallback.bind(v);
                const cVFC = v.cancelVideoFrameCallback!.bind(v);
                const loop = () => {
                    currentTimeRef.current = v.currentTime;
                    renderFrameRef.current();
                    handle = rVFC(loop);
                };
                handle = rVFC(loop);
                return () => cVFC(handle);
            } else {
                const loop = () => {
                    currentTimeRef.current = v.currentTime;
                    renderFrameRef.current();
                    handle = requestAnimationFrame(loop);
                };
                handle = requestAnimationFrame(loop);
                return () => cancelAnimationFrame(handle);
            }
        } else {
            let lastTs = performance.now();
            let lastSetTime = 0;
            const loop = (ts: number) => {
                const dt = (ts - lastTs) / 1000;
                lastTs = ts;
                const next = Math.min(currentTimeRef.current + dt, durationRef.current);
                currentTimeRef.current = next;
                // Throttle React state updates to ~10/sec to avoid render storms
                if (ts - lastSetTime > 100) {
                    setCurrentTime(next);
                    lastSetTime = ts;
                }
                if (next >= durationRef.current) {
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
        }
    }, [isPlaying, video]);

    // Seek sync
    useEffect(() => {
        if (video) {
            const v = video.videoEl;
            const threshold = isPlaying ? 0.5 : 0.01;
            if (Math.abs(v.currentTime - currentTime) > threshold) {
                v.currentTime = currentTime;
                if (!isPlaying) {
                    const handler = () => renderFrameRef.current();
                    v.addEventListener('seeked', handler, { once: true });
                }
            }
        } else {
            currentTimeRef.current = currentTime;
            renderFrameRef.current();
        }
        // isPlaying intentionally omitted
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, video]);

    // Sync React state from video timeupdate (~4-8Hz)
    useEffect(() => {
        if (!video) return;
        const v = video.videoEl;
        const handler = () => setCurrentTime(v.currentTime);
        v.addEventListener('timeupdate', handler);
        return () => v.removeEventListener('timeupdate', handler);
    }, [video]);

    useEffect(() => {
        return () => {
            if (video?.url) URL.revokeObjectURL(video.url);
        };
    }, [video]);

    return (
        <>
            <video
                ref={videoRef}
                style={{ position: 'absolute', width: 0, height: 0 }}
            />
            <div className="w-full h-full flex items-center justify-center">
                <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: '16/9' }} />
            </div>
        </>
    );
}

export default VideoPreview;
