import React, { useRef, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClipColorMap, ClipType } from '../../types/clip';
import type { Clip } from '../../types/clip';
import type { WaveformData } from '@/hooks/useWaveformPeaks';
import type { ClipThumbnails } from '@/hooks/useVideoThumbnails';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '../../components/ui/context-menu';
import { TRACK_HEIGHT } from './constants';

const CLICK_THRESHOLD = 4;
const CLIP_CANVAS_HEIGHT = TRACK_HEIGHT - 6;
// Chrome silently yields a blank canvas past ~32767px, which at MAX_ZOOM is an 11-minute clip.
const MAX_WAVEFORM_CANVAS_W = 8192;
const THUMB_H = CLIP_CANVAS_HEIGHT - 10;
const THUMB_W = Math.round(THUMB_H * (16 / 9));

interface TimelineClipProps {
    clip: Clip;
    sourceName: string;
    sourceMissing?: boolean;
    sourceOffline?: boolean;
    zoom: number;
    isSelected: boolean;
    isBeingDragged: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onSelect?: (additive: boolean) => void;
    onDelete?: () => void;
    waveformData?: WaveformData;
    thumbnails?: ClipThumbnails;
}

export function TimelineClip({ clip, sourceName, sourceMissing, sourceOffline, zoom, isSelected, isBeingDragged, onMouseDown, onSelect, onDelete, waveformData, thumbnails }: TimelineClipProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !waveformData || clip.type !== ClipType.Audio) return;
        const { peaks, duration: srcDuration } = waveformData;
        if (srcDuration <= 0 || peaks.length === 0) return;

        const timer = setTimeout(() => {
            const w = Math.min(
                Math.max(1, Math.floor(clip.duration * zoom)),
                MAX_WAVEFORM_CANVAS_W,
            );
            const h = CLIP_CANVAS_HEIGHT;
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, w, h);

            const peaksPerSec = peaks.length / srcDuration;
            const startIdx = clip.sourceOffset * peaksPerSec;
            const totalPeaks = clip.duration * peaksPerSec;

            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            const centerY = h / 2;
            for (let x = 0; x < w; x++) {
                // Max across the column's full range; sampling one index of 20+ made the
                // shape flicker as zoom shifted which peak got picked.
                let i = Math.max(0, Math.floor(startIdx + (x / w) * totalPeaks));
                const end = Math.min(
                    peaks.length - 1,
                    Math.max(i, Math.ceil(startIdx + ((x + 1) / w) * totalPeaks) - 1),
                );
                let peak = 0;
                for (; i <= end; i++) if (peaks[i] > peak) peak = peaks[i];
                const barH = Math.max(2, peak * h - 4);
                ctx.rect(x, centerY - barH / 2, 1, barH);
            }
            ctx.fill();
        }, 80);

        return () => clearTimeout(timer);
    }, [waveformData, clip.sourceOffset, clip.duration, clip.type, zoom]);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        'absolute cursor-grab active:cursor-grabbing overflow-hidden h-full select-none border-1',
                        sourceMissing
                            ? 'bg-red-950/80 border-red-500'
                            : sourceOffline
                                ? 'bg-amber-950/80 border-amber-500'
                                : cn(ClipColorMap[clip.type].bg, ClipColorMap[clip.type].ring),
                        isBeingDragged && 'opacity-0',
                        isSelected && (sourceMissing ? 'ring-red-400' : sourceOffline ? 'ring-amber-400' : 'ring-white'),
                    )}
                    style={{ left: clip.time * zoom, width: clip.duration * zoom }}
                    onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const handleUp = (ev: MouseEvent) => {
                            window.removeEventListener('mouseup', handleUp);
                            if (Math.abs(ev.clientX - startX) < CLICK_THRESHOLD && Math.abs(ev.clientY - startY) < CLICK_THRESHOLD) {
                                onSelect?.(ev.ctrlKey || ev.metaKey);
                            }
                        };
                        window.addEventListener('mouseup', handleUp);
                        onMouseDown(e);
                    }}
                >
                    {clip.type === ClipType.Video && (() => {
                        const clipPx = clip.duration * zoom;
                        const showStart = clipPx >= THUMB_W;
                        const showEnd = clipPx >= 2 * THUMB_W;
                        if (!showStart) return null;
                        const thumbStyle = { width: THUMB_W - 1, height: THUMB_H };
                        return (
                            <>
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none overflow-hidden" style={thumbStyle}>
                                    {thumbnails?.start
                                        ? <img src={thumbnails.start} draggable={false} className="rounded-xs object-cover w-full h-full" />
                                        : <div className="rounded-xs bg-black/25 w-full h-full" />}
                                </div>
                                {showEnd && (
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none overflow-hidden" style={thumbStyle}>
                                        {thumbnails?.end
                                            ? <img src={thumbnails.end} draggable={false} className="rounded-xs object-cover w-full h-full" />
                                            : <div className="rounded-xs bg-black/25 w-full h-full" />}
                                    </div>
                                )}
                            </>
                        );
                    })()}
                    {clip.type === ClipType.Image && (
                        <ImageIcon className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80 pointer-events-none" />
                    )}
                    {waveformData && clip.type === ClipType.Audio && (
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 pointer-events-none"
                            style={{ width: '100%', height: '100%' }}
                        />
                    )}
                    <span className={cn(
                        'absolute inset-0 flex items-center px-2 text-xs truncate pointer-events-none',
                        clip.type === ClipType.Image && 'pl-7',
                        sourceMissing ? 'text-red-300' : sourceOffline ? 'text-amber-300' : 'text-white/90',
                    )}>
                        {sourceMissing
                            ? 'Source deleted — relink via Manage Sources'
                            : sourceOffline
                                ? `${sourceName} (Offline)`
                                : sourceName}
                    </span>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                >
                    Delete clip
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
