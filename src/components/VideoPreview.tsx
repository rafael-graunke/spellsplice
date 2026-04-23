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
import {
    derivePlayerState,
    getActiveWindowedEvents,
    getNextChangeTime,
} from '@/lib/deriveState';
import { renderPlayerState } from '@/renders/renderPlayerState';
import { renderHandStack } from '@/renders/renderHandStack';
import { ensureImage } from '@/lib/cardCache';

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
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
    const derivedCacheRef = useRef<{
        playerStates: (ReturnType<typeof derivePlayerState> | null)[];
        activeEvents: ReturnType<typeof getActiveWindowedEvents>[];
        validUntil: number;
    } | null>(null);

    useEffect(() => {
        const img = new Image();
        img.onload = () => { d20Ref.current = img; };
        img.src = '/d20.svg';
    }, []);

    useEffect(() => {
        const img = new Image();
        img.onload = () => { eyeRef.current = img; };
        img.src = '/eye.svg';
    }, []);

    useEffect(() => {
        playersRef.current = players;
        derivedCacheRef.current = null;
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

    const drawFrame = () => {
        if (!video || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const canvasW = 1920;
        const canvasH = 1080;
        const v = video.videoEl;
        const videoW = v.videoWidth;
        const videoH = v.videoHeight;

        if (!videoW || !videoH) return;

        const scale = Math.min(canvasW / videoW, canvasH / videoH);
        const drawW = Math.round(videoW * scale);
        const drawH = Math.round(videoH * scale);
        const offsetX = Math.round((canvasW - drawW) / 2);
        const offsetY = Math.round((canvasH - drawH) / 2);

        ctx.save();

        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.drawImage(v, offsetX, offsetY, drawW, drawH);

        const time = v.currentTime;

        const cache = derivedCacheRef.current;
        const needsRederive =
            !cache || time >= cache.validUntil || time < prevTimeRef.current;

        if (needsRederive) {
            const playerStates = playersRef.current.map((p) =>
                derivePlayerState(p, p.track.events, time)
            );
            const activeEvents = playersRef.current.map((p) =>
                getActiveWindowedEvents(p.track.events, time)
            );
            derivedCacheRef.current = {
                playerStates,
                activeEvents,
                validUntil: getNextChangeTime(
                    playersRef.current.map((p) => p.track),
                    time
                ),
            };
        }
        prevTimeRef.current = time;

        const { playerStates, activeEvents } = derivedCacheRef.current!;

        renderPlayerState(ctx, playerStates, offsetX, offsetY, drawW, drawH, d20Ref.current);
        renderHandStack(ctx, playerStates, offsetX, offsetY, drawW, drawH, eyeRef.current);

        // Active windowed event card images
        const cardH = drawH * 0.5;
        const cardW = cardH * (223 / 310);
        let cardOffset = 0;

        activeEvents.forEach((events) => {
            events.forEach((event) => {
                const card = event.meta?.cards?.[0];
                if (!card?.name) return;

                const cached = ensureImage(card.name, card.edition);
                if (cached === 'loading' || cached === 'error') return;

                const cardX =
                    offsetX + drawW / 2 - (cardW / 2) + cardOffset * (cardW + 8);
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
    };

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = 1920;
        canvas.height = 1080;
        drawFrame();
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
