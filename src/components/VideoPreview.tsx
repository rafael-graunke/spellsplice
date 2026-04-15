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
import type { Track } from './types/event';
import type { Player } from './types/player';
import { derivePlayerState, getActiveWindowedEvents, getNextChangeTime } from '@/lib/deriveState';

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: (playing: boolean) => void;
    video: VideoState | null;
    setVideo: React.Dispatch<React.SetStateAction<VideoState | null>>;
    tracks: Track[];
    players: Player[];
}

function VideoPreview({
    isPlaying,
    currentTime,
    setCurrentTime,
    setIsPlaying,
    video,
    setVideo,
    tracks,
    players,
}: VideoPreviewProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const tracksRef = useRef(tracks);
    const playersRef = useRef(players);
    const prevTimeRef = useRef(-1);
    const derivedCacheRef = useRef<{
        playerStates: ReturnType<typeof derivePlayerState>[];
        activeEvents: ReturnType<typeof getActiveWindowedEvents>[];
        validUntil: number;
    } | null>(null);

    useEffect(() => {
        tracksRef.current = tracks;
        derivedCacheRef.current = null; // invalidate when tracks change
    }, [tracks]);
    useEffect(() => { playersRef.current = players; }, [players]);

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

    const drawFrame = () => {
        if (!video || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const v = video.videoEl;
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        const videoW = v.videoWidth;
        const videoH = v.videoHeight;

        if (!videoW || !videoH) return;

        const scale = Math.min(canvasW / videoW, canvasH / videoH);
        const drawW = videoW * scale;
        const drawH = videoH * scale;
        const offsetX = (canvasW - drawW) / 2;
        const offsetY = (canvasH - drawH) / 2;

        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(v, offsetX, offsetY, drawW, drawH);

        const time = v.currentTime;

        const cache = derivedCacheRef.current;
        const needsRederive =
            !cache ||
            time >= cache.validUntil ||
            time < prevTimeRef.current; // seek backwards

        if (needsRederive) {
            const playerStates = tracksRef.current.map((track) => {
                const player = playersRef.current.find((p) => p.id === track.playerId);
                return player ? derivePlayerState(player, track.events, time) : null;
            });
            const activeEvents = tracksRef.current.map((track) =>
                getActiveWindowedEvents(track.events, time)
            );
            derivedCacheRef.current = {
                playerStates,
                activeEvents,
                validUntil: getNextChangeTime(tracksRef.current, time),
            };
        }
        prevTimeRef.current = time;

        const { playerStates, activeEvents } = derivedCacheRef.current!;

        // Player state boxes
        tracksRef.current.forEach((track, i) => {
            const state = playerStates[i];
            if (!state) return;


            const boxW = 140;
            const boxH = 72;
            const boxX = i === 0 ? offsetX + 12 : offsetX + drawW - boxW - 12;
            const boxY = offsetY + 12;

            ctx.save();
            ctx.beginPath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(state.name, boxX + 10, boxY + 20);

            ctx.font = '13px sans-serif';
            ctx.fillStyle = '#f87171';
            ctx.fillText(`♥  ${state.lifeTotal}`, boxX + 10, boxY + 42);
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(`✋  ${state.handSize}`, boxX + 10, boxY + 62);
            ctx.restore();
        });

        // Active windowed event banners
        let bannerOffset = 0;
        activeEvents.forEach((events) => {
            events.forEach((event) => {
                const bannerH = 36;
                const bannerY = offsetY + drawH - bannerH - 12 - bannerOffset;

                ctx.save();
                ctx.beginPath();
                ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
                ctx.roundRect(offsetX + 12, bannerY, drawW - 24, bannerH, 6);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(
                    event.type.replace(/_/g, ' '),
                    offsetX + drawW / 2,
                    bannerY + 24,
                );
                ctx.textAlign = 'left';
                ctx.restore();

                bannerOffset += bannerH + 6;
            });
        });
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const parent = canvas.parentElement;
        if (!parent) return;

        const resize = () => {
            const rect = parent.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            drawFrame();
        };

        resize();

        const observer = new ResizeObserver(resize);
        observer.observe(parent);

        return () => observer.disconnect();
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
        }
    }, [isPlaying, video]);

    useEffect(() => {
        if (!video) return;

        let raf: number;

        const loop = () => {
            drawFrame();
            raf = requestAnimationFrame(loop);
        };

        if (isPlaying) {
            raf = requestAnimationFrame(loop);
        }

        return () => cancelAnimationFrame(raf);
    }, [isPlaying, video]);

    useEffect(() => {
        if (!video) return;

        const v = video.videoEl;
        const threshold = isPlaying ? 0.5 : 0.01;

        if (Math.abs(v.currentTime - currentTime) > threshold) {
            v.currentTime = currentTime;

            if (!isPlaying) {
                const handler = () => drawFrame();
                v.addEventListener('seeked', handler, { once: true });
            }
        }
    }, [currentTime, video, isPlaying]);

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
            <video ref={videoRef} style={{ position: 'absolute', width: 0, height: 0 }} />
            {video ? (
                <canvas ref={canvasRef} className="w-full h-full" />
            ) : (
                <Empty className="h-full">
                    <EmptyHeader>
                        <EmptyMedia>
                            <img src="/assets/logo.svg" width={200} />
                        </EmptyMedia>
                        <EmptyTitle className="text-xl">Start with a video</EmptyTitle>
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
