import { useEffect, useRef } from 'react';
import { PREVIEW_FPS } from '../constants';
import { nextValueAfter, prevValueBefore } from '../editOps';
import { isTypingTarget } from '../keyboard';
import { quantizeToFrame } from '../snapping';
import { TimelineTool } from '../types';
import type { RefObject } from 'react';

interface TimelineKeyboardOptions {
    onDelete: () => void;
    onRippleDelete: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onSeek: (t: number) => void;
    currentTimeRef: RefObject<number>;
    /** Scrollable extent; bounds arrow-key nudges. */
    duration: number;
    /** Content end; where `End` lands. */
    contentDuration: number;
    onTabNext?: () => void;
    /** Sorted clip starts and ends. */
    editPoints: number[];
    /** Sorted event times. */
    eventPoints: number[];
    markerTimes: number[];
    onBlade: (allTracks: boolean) => void;
    onToggleSnap: () => void;
    onAddMarker: () => void;
    onSetIn: () => void;
    onSetOut: () => void;
    onClearInOut: () => void;
    onMarkClip: () => void;
    onToggleLoop: () => void;
    onSetTool: (tool: TimelineTool) => void;
}

export function useTimelineKeyboard(options: TimelineKeyboardOptions) {
    const optsRef = useRef(options);
    useEffect(() => { optsRef.current = options; });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (isTypingTarget(e.target, e.key)) return;
            const o = optsRef.current;
            const mod = e.ctrlKey || e.metaKey;
            const now = o.currentTimeRef.current;
            const seekTo = (t: number | null) => {
                if (t == null) return;
                e.preventDefault();
                o.onSeek(Math.max(0, Math.min(o.duration, t)));
            };

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                if (e.shiftKey) o.onRippleDelete();
                else o.onDelete();
                return;
            }
            if (mod && e.key.toLowerCase() === 'c') { o.onCopy(); return; }
            if (mod && e.key.toLowerCase() === 'v') { o.onPaste(); return; }
            if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); o.onUndo(); return; }
            if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
                e.preventDefault();
                o.onRedo();
                return;
            }
            if (e.key === 'Tab' && !mod && o.onTabNext) { e.preventDefault(); o.onTabNext(); return; }

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowRight': {
                    e.preventDefault();
                    // NLE convention: bare arrow nudges a frame, Shift jumps a second.
                    const step = e.shiftKey ? 1 : 1 / PREVIEW_FPS;
                    const dir = e.key === 'ArrowLeft' ? -1 : 1;
                    // Quantised so nudging away from a snapped (free-float) clip
                    // edge puts the playhead back on the frame grid.
                    o.onSeek(quantizeToFrame(Math.max(0, Math.min(o.duration, now + dir * step))));
                    return;
                }
                case 'ArrowUp':
                case 'ArrowDown': {
                    const points = e.shiftKey ? o.eventPoints : o.editPoints;
                    seekTo(e.key === 'ArrowUp' ? prevValueBefore(points, now) : nextValueAfter(points, now));
                    return;
                }
                case 'Home':
                    seekTo(0);
                    return;
                case 'End':
                    seekTo(o.contentDuration);
                    return;
                case 'Escape':
                    o.onSetTool(TimelineTool.Select);
                    return;
            }

            if (e.altKey) return;

            switch (e.code) {
                case 'KeyB':
                    // Split at playhead stays an action even though the razor is
                    // also a mode: click-cutting and cut-where-the-playhead-is
                    // are different gestures, and both NLEs ship both.
                    if (mod) return;
                    e.preventDefault();
                    o.onBlade(e.shiftKey);
                    return;
                case 'KeyV':
                    if (mod) return;
                    e.preventDefault();
                    o.onSetTool(TimelineTool.Select);
                    return;
                case 'KeyC':
                    if (mod) return;
                    e.preventDefault();
                    o.onSetTool(TimelineTool.Razor);
                    return;
                case 'KeyS':
                    if (mod) return;
                    e.preventDefault();
                    o.onToggleSnap();
                    return;
                case 'KeyM':
                    if (mod && e.shiftKey) { seekTo(prevValueBefore(o.markerTimes, now)); return; }
                    if (e.shiftKey) { seekTo(nextValueAfter(o.markerTimes, now)); return; }
                    if (mod) return;
                    e.preventDefault();
                    o.onAddMarker();
                    return;
                case 'KeyI':
                    if (mod && e.shiftKey) { e.preventDefault(); o.onClearInOut(); return; }
                    if (mod) return;
                    e.preventDefault();
                    o.onSetIn();
                    return;
                case 'KeyO':
                    if (mod && e.shiftKey) { e.preventDefault(); o.onClearInOut(); return; }
                    if (mod) return;
                    e.preventDefault();
                    o.onSetOut();
                    return;
                case 'KeyX':
                    if (mod) return;
                    e.preventDefault();
                    o.onMarkClip();
                    return;
                case 'KeyL':
                    // Plain L is the JKL shuttle (PlaybackControls). Shift+L,
                    // not Ctrl+L: the browser owns Ctrl+L for the address bar
                    // and will not let preventDefault have it.
                    if (e.shiftKey && !mod) { e.preventDefault(); o.onToggleLoop(); }
                    return;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
