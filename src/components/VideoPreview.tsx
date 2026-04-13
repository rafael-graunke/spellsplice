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

interface VideoPreviewProps {
    isPlaying: boolean;
    currentTime: number;
    setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
    video: VideoState | null;
    setVideo: React.Dispatch<React.SetStateAction<VideoState | null>>;
}

function VideoPreview({
    isPlaying,
    currentTime,
    setCurrentTime,
    video,
    setVideo,
}: VideoPreviewProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
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

        const scale = Math.min(canvasW / videoW, canvasH / videoH);

        const drawW = videoW * scale;
        const drawH = videoH * scale;

        const offsetX = (canvasW - drawW) / 2;
        const offsetY = (canvasH - drawH) / 2;

        ctx.clearRect(0, 0, canvasW, canvasH);

        ctx.drawImage(v, offsetX, offsetY, drawW, drawH);
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

        if (isPlaying) {
            video.videoEl.play();
        } else {
            video.videoEl.pause();
        }
    }, [isPlaying, video]);

    useEffect(() => {
        if (!video) return;

        let raf: number;

        const loop = () => {
            drawFrame();

            setCurrentTime(video.videoEl.currentTime);

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
