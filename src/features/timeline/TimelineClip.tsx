import React, { useRef, useEffect, useState } from 'react';
import { Image as ImageIcon, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClipColorMap, ClipType, GAIN_MAX_DB, GAIN_MIN_DB, dbToGain, gainToDb } from '../../types/clip';
import type { Clip } from '../../types/clip';
import type { TrimEdge } from './editOps';
import type { WaveformData } from '@/hooks/useWaveformPeaks';
import type { ClipThumbnails } from '@/hooks/useVideoThumbnails';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '../../components/ui/context-menu';
import { TRACK_HEIGHT } from './constants';
import { propsEqualIgnoringFunctions } from './memo';

const CLICK_THRESHOLD = 4;
const TRIM_HANDLE_W = 8;
// Below this the two handles would cover the whole clip, leaving nothing to grab
// for a move.
const MIN_TRIMMABLE_PX = 3 * TRIM_HANDLE_W;
const DB_RANGE = GAIN_MAX_DB - GAIN_MIN_DB;
// Chrome silently yields a blank canvas past ~32767px, which at MAX_ZOOM is an 11-minute clip.
const MAX_WAVEFORM_CANVAS_W = 8192;

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
    onTrimStart?: (edge: TrimEdge, e: React.MouseEvent) => void;
    /** Razor mode: cut here. Present only while the razor tool is active. */
    onRazorCut?: (time: number) => void;
    onSplit?: () => void;
    onUnlink?: () => void;
    onGainChange?: (gain: number) => void;
    trackHeight?: number;
    waveformData?: WaveformData;
    thumbnails?: ClipThumbnails;
}

function TimelineClipInner({ clip, sourceName, sourceMissing, sourceOffline, zoom, isSelected, isBeingDragged, onMouseDown, onSelect, onDelete, onTrimStart, onRazorCut, onSplit, onUnlink, onGainChange, trackHeight = TRACK_HEIGHT, waveformData, thumbnails }: TimelineClipProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Derived per render, not at module scope: track height is per-track data now.
    const canvasHeight = trackHeight - 6;
    const thumbH = canvasHeight - 10;
    const thumbW = Math.round(thumbH * (16 / 9));
    const [dragDb, setDragDb] = useState<number | null>(null);
    const [razorX, setRazorX] = useState<number | null>(null);

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
            const h = canvasHeight;
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
    }, [waveformData, clip.sourceOffset, clip.duration, clip.type, zoom, canvasHeight]);

    const clipPx = clip.duration * zoom;
    // Layout vs interaction, deliberately separate: the label indents to clear
    // the trim zone based on width alone, so switching tools (which disables the
    // handles) doesn't shift the clip's text sideways.
    const hasTrimZone = clipPx >= MIN_TRIMMABLE_PX;
    const showTrimHandles = !!onTrimStart && !onRazorCut && hasTrimZone;
    const db = dragDb ?? gainToDb(clip.gain ?? 1);
    const gainY = (1 - (db - GAIN_MIN_DB) / DB_RANGE) * 100;

    const handleGainDown = (e: React.MouseEvent) => {
        if (!onGainChange) return;
        e.stopPropagation();
        e.preventDefault();
        const startY = e.clientY;
        const startDb = db;
        let latest = startDb;
        const onMove = (ev: MouseEvent) => {
            latest = Math.max(
                GAIN_MIN_DB,
                Math.min(GAIN_MAX_DB, startDb - ((ev.clientY - startY) / canvasHeight) * DB_RANGE),
            );
            setDragDb(latest);
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            setDragDb(null);
            onGainChange(dbToGain(latest));
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        'absolute overflow-hidden h-full select-none border-1',
                        onRazorCut ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
                        sourceMissing
                            ? 'bg-red-950/80 border-red-500'
                            : sourceOffline
                                ? 'bg-amber-950/80 border-amber-500'
                                : cn(ClipColorMap[clip.type].bg, ClipColorMap[clip.type].ring),
                        isBeingDragged && 'opacity-0',
                        isSelected && (sourceMissing ? 'ring-red-400' : sourceOffline ? 'ring-amber-400' : 'ring-white'),
                    )}
                    style={{ left: clip.time * zoom, width: clip.duration * zoom }}
                    onMouseMove={onRazorCut ? (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setRazorX(e.clientX - rect.left);
                    } : undefined}
                    onMouseLeave={onRazorCut ? () => setRazorX(null) : undefined}
                    onMouseDown={(e) => {
                        if (onRazorCut) {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            onRazorCut(clip.time + (e.clientX - rect.left) / zoom);
                            return;
                        }
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
                        const showStart = clipPx >= thumbW;
                        const showEnd = clipPx >= 2 * thumbW;
                        if (!showStart) return null;
                        const thumbStyle = { width: thumbW - 1, height: thumbH };
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
                    {clip.type === ClipType.Audio && onGainChange && (
                        <>
                            <div
                                className="absolute inset-x-0 h-2 -translate-y-1/2 cursor-ns-resize z-20 group"
                                style={{ top: `${gainY}%` }}
                                onMouseDown={handleGainDown}
                            >
                                <div className={cn(
                                    'absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/70 group-hover:h-0.5 group-hover:bg-white',
                                    dragDb !== null && 'h-0.5 bg-white',
                                )} />
                            </div>
                            {dragDb !== null && (
                                <span className="absolute right-1 top-1 text-[10px] font-medium tabular-nums text-white bg-black/60 rounded px-1 pointer-events-none z-30">
                                    {dragDb <= GAIN_MIN_DB ? '-∞' : `${dragDb > 0 ? '+' : ''}${dragDb.toFixed(1)}`} dB
                                </span>
                            )}
                        </>
                    )}
                    <span className={cn(
                        'absolute inset-0 flex items-center gap-1 px-2 text-xs truncate pointer-events-none',
                        clip.type === ClipType.Image && 'pl-7',
                        hasTrimZone && 'pl-3',
                        sourceMissing ? 'text-red-300' : sourceOffline ? 'text-amber-300' : 'text-white/90',
                    )}>
                        {clip.linkId && <Link2 className="size-3 shrink-0 opacity-70" />}
                        <span className="truncate">
                            {sourceMissing
                                ? 'Source deleted — relink via Manage Sources'
                                : sourceOffline
                                    ? `${sourceName} (Offline)`
                                    : sourceName}
                        </span>
                    </span>
                    {onRazorCut && razorX !== null && (
                        <div
                            className="absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)] pointer-events-none z-30"
                            style={{ left: razorX }}
                        />
                    )}
                    {showTrimHandles && (
                        <>
                            <div
                                className="absolute left-0 inset-y-0 z-20 cursor-ew-resize hover:bg-white/40"
                                style={{ width: TRIM_HANDLE_W }}
                                onMouseDown={(e) => onTrimStart?.('start', e)}
                            />
                            <div
                                className="absolute right-0 inset-y-0 z-20 cursor-ew-resize hover:bg-white/40"
                                style={{ width: TRIM_HANDLE_W }}
                                onMouseDown={(e) => onTrimStart?.('end', e)}
                            />
                        </>
                    )}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                {onSplit && <ContextMenuItem onClick={onSplit}>Split at playhead</ContextMenuItem>}
                {onUnlink && clip.linkId && <ContextMenuItem onClick={onUnlink}>Unlink audio/video</ContextMenuItem>}
                {onGainChange && clip.type === ClipType.Audio && (clip.gain ?? 1) !== 1 && (
                    <ContextMenuItem onClick={() => onGainChange(1)}>Reset gain</ContextMenuItem>
                )}
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

export const TimelineClip = React.memo(TimelineClipInner, propsEqualIgnoringFunctions);
