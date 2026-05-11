import { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from './ui/empty';
import type { VideoState } from './types/video';
import type { Player } from './types/player';
import { getNextChangeTime } from '@/lib/deriveState';
import { Compositor } from '@/lib/export/compose';
import { subscribeImageLoad } from '@/lib/cardCache';

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
    currentTimeRef: React.MutableRefObject<number>;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: (playing: boolean) => void;
    video: VideoState | null;
    setVideo: React.Dispatch<React.SetStateAction<VideoState | null>>;
    players: Player[];
    fileToLoad?: File | null;
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
}: VideoPreviewProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const playersRef = useRef(players);
    const prevTimeRef = useRef(-1);
    const d20Ref = useRef<HTMLImageElement | null>(null);
    const eyeRef = useRef<HTMLImageElement | null>(null);
    const compositorRef = useRef<Compositor | null>(null);
    const derivedCacheRef = useRef<{ validUntil: number } | null>(null);
    const isPlayingRef = useRef(isPlaying);
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

    useEffect(() => {
        playersRef.current = players;
        derivedCacheRef.current = null;
        if (!isPlaying && video) renderFrame();
        // isPlaying and video intentionally omitted — effect scoped to players changes only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [players]);

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
            setVideo({
                file,
                url,
                duration: videoEl.duration,
                videoEl,
            });
        };
    };

    isPlayingRef.current = isPlaying;

    const renderFrame = () => {
        const compositor = compositorRef.current;
        if (!compositor || !video) return;
        const v = video.videoEl;
        if (!v.videoWidth || !v.videoHeight) return;

        const time = v.currentTime;
        const cache = derivedCacheRef.current;
        const overlayStale = !cache || time >= cache.validUntil || time < prevTimeRef.current;

        compositor.uploadVideoElement(v);

        if (overlayStale) {
            compositor.updateOverlay(playersRef.current, time, d20Ref.current, eyeRef.current);
            const ANIM_DURATION = 0.35;
            const anyAnimating = playersRef.current.some((p) =>
                p.track.events.some((e) => {
                    if (
                        e.type === 'ADD_TO_HAND' ||
                        e.type === 'REMOVE_FROM_HAND' ||
                        e.type === 'STACK_DECK' ||
                        e.type === 'UNSTACK_DECK'
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
            // Expire cache before DISPLAY_CARD exit windows so the exit animation triggers.
            // getNextChangeTime returns event end time, but we need overlay updates
            // starting ANIM_DURATION before the end.
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
            // rVFC fires at video fps (24-30). On the rVFC path, supplement with rAF
            // so animations render at display rate (60fps).
            if (anyAnimating && isPlayingRef.current && 'requestVideoFrameCallback' in v) {
                requestAnimationFrame(renderFrameRef.current);
            }
        }

        prevTimeRef.current = time;
        compositor.draw();
    };

    renderFrameRef.current = renderFrame;

    useEffect(() => {
        return subscribeImageLoad(() => {
            derivedCacheRef.current = null;
            if (!isPlayingRef.current) {
                renderFrameRef.current();
            }
        });
    }, []);

    useEffect(() => {
        if (!canvasRef.current || !video) return;

        const canvas = canvasRef.current;
        canvas.width = 1920;
        canvas.height = 1080;

        compositorRef.current?.dispose();
        const v = video.videoEl;
        const scale = Math.min(1920 / v.videoWidth, 1080 / v.videoHeight);
        const drawW = Math.round(v.videoWidth * scale);
        const drawH = Math.round(v.videoHeight * scale);
        const comp = new Compositor(1920, 1080, canvas);
        comp.setLayout(drawW, drawH, Math.round((1920 - drawW) / 2), Math.round((1080 - drawH) / 2));
        compositorRef.current = comp;
        derivedCacheRef.current = null;
        renderFrame();

        return () => {
            comp.dispose();
            compositorRef.current = null;
        };
    }, [video]);

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

    useEffect(() => {
        if (!video || !isPlaying) return;

        const v = video.videoEl;
        let handle: number;

        if (v.requestVideoFrameCallback) {
            const rVFC = v.requestVideoFrameCallback.bind(v);
            const cVFC = v.cancelVideoFrameCallback!.bind(v);
            const loop = () => {
                renderFrame();
                currentTimeRef.current = v.currentTime;
                handle = rVFC(loop);
            };
            handle = rVFC(loop);
            return () => cVFC(handle);
        } else {
            const loop = () => {
                renderFrame();
                currentTimeRef.current = v.currentTime;
                handle = requestAnimationFrame(loop);
            };
            handle = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(handle);
        }
    }, [isPlaying, video]);

    useEffect(() => {
        if (!video) return;

        const v = video.videoEl;
        const threshold = isPlaying ? 0.5 : 0.01;

        if (Math.abs(v.currentTime - currentTime) > threshold) {
            v.currentTime = currentTime;

            if (!isPlaying) {
                const handler = () => renderFrame();
                v.addEventListener('seeked', handler, { once: true });
            }
        }
        // isPlaying intentionally omitted — seek is driven by currentTime changes only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentTime, video]);

    useEffect(() => {
        if (!video) return;
        const v = video.videoEl;
        const handler = () => setCurrentTime(v.currentTime);
        v.addEventListener('timeupdate', handler);
        return () => v.removeEventListener('timeupdate', handler);
    }, [video]);

    useEffect(() => {
        return () => {
            if (video?.url) {
                URL.revokeObjectURL(video.url);
            }
        };
    }, [video]);

    return (
        <>
            <video
                ref={videoRef}
                style={{ position: 'absolute', width: 0, height: 0 }}
            />
            {video ? (
                <div className="w-full h-full flex items-center justify-center">
                    <canvas ref={canvasRef} className="max-w-full max-h-full" style={{ aspectRatio: '16/9' }} />
                </div>
            ) : (
                <Empty className="h-full">
                    <EmptyHeader>
                        <EmptyMedia>
                            <img src="/assets/logo.svg" width={200} />
                        </EmptyMedia>
                        <EmptyTitle className="text-xl">
                            Start with a video
                        </EmptyTitle>
                        <EmptyDescription>
                            Drop a file here or select one to begin editing
                        </EmptyDescription>
                    </EmptyHeader>

                    <EmptyContent>
                        <Button
                            size="lg"
                            className="text-md"
                            onClick={() => inputRef.current?.click()}
                        >
                            Select video
                        </Button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFile(file);
                            }}
                        />
                    </EmptyContent>
                </Empty>
            )}
        </>
    );
}

export default VideoPreview;
