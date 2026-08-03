import React, { useEffect, useRef } from 'react';
import { FastForward, Pause, Play, Rewind, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { PREVIEW_FPS, SHUTTLE_RATES } from './constants';
import type { RefObject } from 'react';

/** `HH:MM:SS:FF`, derived from one total-frame count so fields can't disagree. */
function formatTimecode(seconds: number, fps = PREVIEW_FPS): string {
    if (!isFinite(seconds)) return '--:--:--:--';
    const total = Math.floor(Math.max(0, seconds) * fps);
    const p = (n: number) => n.toString().padStart(2, '0');
    return [
        p(Math.floor(total / (fps * 3600))),
        p(Math.floor(total / (fps * 60)) % 60),
        p(Math.floor(total / fps) % 60),
        p(total % fps),
    ].join(':');
}

/**
 * Writes textContent from a rAF rather than rendering, so 30-60 updates/sec
 * don't re-render the app tree. Runs while paused too (a paused scrub moves
 * currentTimeRef with nothing else to trigger an update); the frame compare
 * short-circuits so an idle loop writes nothing.
 */
const Timecode = React.memo(function Timecode({
    currentTimeRef,
    className,
}: {
    currentTimeRef: RefObject<number>;
    className?: string;
}) {
    const elRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let raf: number;
        let lastFrame = -1;
        const tick = () => {
            const frame = Math.floor(Math.max(0, currentTimeRef.current) * PREVIEW_FPS);
            if (frame !== lastFrame) {
                lastFrame = frame;
                if (elRef.current) elRef.current.textContent = formatTimecode(currentTimeRef.current);
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [currentTimeRef]);

    return <span ref={elRef} className={className}>{formatTimecode(0)}</span>;
});

export interface PlaybackControlsProps {
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    playbackRate: number;
    setPlaybackRate: (rate: number) => void;
    onSeek: (time: number) => void;
    currentTimeRef: RefObject<number>;
    duration: number;
    volume: number;
    onVolumeChange: (v: number) => void;
}

function PlaybackControls({
    isPlaying,
    setIsPlaying,
    playbackRate,
    setPlaybackRate,
    onSeek,
    currentTimeRef,
    duration,
    volume,
    onVolumeChange,
}: PlaybackControlsProps) {
    // `K` held turns L/J into single-frame jogs (standard NLE behaviour), so the
    // held state has to survive between keydown events.
    const kHeldRef = useRef(false);

    // L: climb the shuttle ladder. From a stop this starts playback at 1x.
    const shuttleUp = () => {
        const i = SHUTTLE_RATES.indexOf(playbackRate as (typeof SHUTTLE_RATES)[number]);
        if (!isPlaying) { setPlaybackRate(1); setIsPlaying(true); return; }
        setPlaybackRate(SHUTTLE_RATES[Math.min(i + 1, SHUTTLE_RATES.length - 1)]);
    };

    // J: descend the ladder. There is no reverse playback, so 1x is the floor and
    // pressing again from there stops — mirroring how J decelerates through zero.
    const shuttleDown = () => {
        if (!isPlaying) return;
        const i = SHUTTLE_RATES.indexOf(playbackRate as (typeof SHUTTLE_RATES)[number]);
        if (i <= 0) { stop(); return; }
        setPlaybackRate(SHUTTLE_RATES[i - 1]);
    };

    const stop = () => {
        setIsPlaying(false);
        setPlaybackRate(1);
    };

    const jog = (dir: -1 | 1) => {
        stop();
        onSeek(Math.max(0, Math.min(duration, currentTimeRef.current + dir / PREVIEW_FPS)));
    };

    useEffect(() => {
        // Buttons matter as much as text fields: a focused button handles Space
        // itself, so without this it re-activates AND playback toggles.
        const isTypingTarget = (t: EventTarget | null) => {
            const el = t as HTMLElement | null;
            if (!el) return false;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true;
            return !!el.closest?.('button, select, a[href], [role="button"], [role="combobox"]');
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            switch (e.code) {
                case 'Space':
                    if (e.repeat) return;
                    e.preventDefault();
                    if (isPlaying) stop();
                    else { setPlaybackRate(1); setIsPlaying(true); }
                    break;
                case 'KeyL':
                    e.preventDefault();
                    if (e.repeat) return;
                    if (kHeldRef.current) jog(1);
                    else shuttleUp();
                    break;
                case 'KeyJ':
                    e.preventDefault();
                    if (e.repeat) return;
                    if (kHeldRef.current) jog(-1);
                    else shuttleDown();
                    break;
                case 'KeyK':
                    e.preventDefault();
                    kHeldRef.current = true;
                    if (e.repeat) return;
                    stop();
                    break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'KeyK') kHeldRef.current = false;
        };
        // K can be released while the window is blurred; clear it so L/J don't
        // stay stuck in jog mode.
        const onBlur = () => { kHeldRef.current = false; };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
        // Unkeyed: handlers close over isPlaying/playbackRate, and the memo keeps
        // re-binds rare.
    });

    const shuttling = isPlaying && playbackRate !== 1;

    return (
        // 1fr/auto/1fr keeps the transport centred while the uneven flanking
        // cells split the remainder.
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t bg-background px-3 py-2">
            <div className="flex flex-row items-center gap-2">
                <Timecode
                    currentTimeRef={currentTimeRef}
                    className={`text-sm font-medium tabular-nums ${shuttling ? 'text-primary' : ''}`}
                />
                <span className="w-6 text-xs tabular-nums text-primary">
                    {shuttling ? `${playbackRate}x` : ''}
                </span>
            </div>

            <div className="flex flex-row items-center justify-center gap-5">
                <SkipBack size={18} className="cursor-pointer" onClick={() => onSeek(0)} aria-label="Go to start" />
                <Rewind size={18} className="cursor-pointer" onClick={shuttleDown} aria-label="Shuttle slower (J)" />
                {isPlaying
                    ? <Pause size={20} className="cursor-pointer" onClick={stop} aria-label="Pause (K)" />
                    : <Play size={20} className="cursor-pointer" onClick={() => setIsPlaying(true)} aria-label="Play (L)" />
                }
                <FastForward size={18} className="cursor-pointer" onClick={shuttleUp} aria-label="Shuttle faster (L)" />
                <SkipForward size={18} className="cursor-pointer" onClick={() => onSeek(duration)} aria-label="Go to end" />
            </div>

            <div className="flex flex-row items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={() => onVolumeChange(volume === 0 ? 100 : 0)}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                >
                    {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <Slider
                    value={[volume]}
                    onValueChange={([v]) => onVolumeChange(v)}
                    min={0}
                    max={100}
                    step={1}
                    className="w-20"
                    aria-label="Volume"
                />
                <span className="ml-1 text-sm tabular-nums text-muted-foreground">{formatTimecode(duration)}</span>
            </div>
        </div>
    );
}

// Memoized so the unkeyed keyboard effect re-binds only on transport changes,
// not on every VideoPreview render.
export default React.memo(PlaybackControls);
