import type { Clip } from '../../types/clip';
import { ClipType } from '../../types/clip';
import { PREVIEW_FPS } from './constants';

export const MIN_CLIP_DURATION = 1 / PREVIEW_FPS;

export type TrimEdge = 'start' | 'end';

export interface TrimResult {
    time: number;
    duration: number;
    sourceOffset: number;
    /** True when the edge stopped against the end of the source media. */
    atMediaLimit: boolean;
}

/**
 * Resolve a trim drag to a concrete clip geometry.
 *
 * Trimming the head moves `time`, `sourceOffset` and `duration` together;
 * moving only `time` would slide the clip instead of trimming it.
 *
 * `sourceDuration` of 0 (or an image clip) means "unbounded" — a still can be
 * held for any length.
 */
export function trimClip(
    clip: Clip,
    edge: TrimEdge,
    desiredTime: number,
    sourceDuration: number,
    neighbours: Clip[],
): TrimResult {
    const unbounded = clip.type === ClipType.Image || sourceDuration <= 0;
    const clipEnd = clip.time + clip.duration;

    if (edge === 'end') {
        const nextStart = neighbours
            .filter((c) => c.id !== clip.id && c.time >= clipEnd)
            .reduce((min, c) => Math.min(min, c.time), Infinity);
        const mediaMax = unbounded
            ? Infinity
            : clip.time + (sourceDuration - clip.sourceOffset);
        const max = Math.min(mediaMax, nextStart);
        const end = Math.max(clip.time + MIN_CLIP_DURATION, Math.min(desiredTime, max));
        return {
            time: clip.time,
            duration: end - clip.time,
            sourceOffset: clip.sourceOffset,
            atMediaLimit: !unbounded && end >= mediaMax - 1e-6,
        };
    }

    const prevEnd = neighbours
        .filter((c) => c.id !== clip.id && c.time + c.duration <= clip.time)
        .reduce((max, c) => Math.max(max, c.time + c.duration), 0);
    const mediaMin = unbounded ? -Infinity : clip.time - clip.sourceOffset;
    const min = Math.max(0, prevEnd, mediaMin);
    const start = Math.min(clipEnd - MIN_CLIP_DURATION, Math.max(desiredTime, min));
    const delta = start - clip.time;
    return {
        time: start,
        duration: clip.duration - delta,
        sourceOffset: Math.max(0, clip.sourceOffset + delta),
        atMediaLimit: !unbounded && start <= mediaMin + 1e-6,
    };
}

/**
 * Geometry for the two halves of a blade cut. Returns null when `t` falls
 * outside the clip or within a frame of an edge (which would yield a
 * zero-length clip).
 */
export function splitGeometry(
    clip: Clip,
    t: number,
): { left: { duration: number }; right: { time: number; duration: number; sourceOffset: number } } | null {
    if (t <= clip.time + MIN_CLIP_DURATION) return null;
    if (t >= clip.time + clip.duration - MIN_CLIP_DURATION) return null;
    return {
        left: { duration: t - clip.time },
        right: {
            time: t,
            duration: clip.time + clip.duration - t,
            sourceOffset: clip.sourceOffset + (t - clip.time),
        },
    };
}

export interface TimeRange {
    start: number;
    end: number;
}

/** Merge overlapping/touching ranges so a multi-clip ripple can't double-count. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
    const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
    const out: TimeRange[] = [];
    for (const r of sorted) {
        const last = out[out.length - 1];
        if (last && r.start <= last.end + 1e-9) last.end = Math.max(last.end, r.end);
        else out.push({ ...r });
    }
    return out;
}

/**
 * Where `t` lands once the given ranges are removed and the gaps closed.
 * A time that falls inside a removed range collapses onto the cut point, so an
 * event authored over deleted footage doesn't drift past the material that
 * replaced it.
 */
export function mapTimeAfterRipple(t: number, merged: TimeRange[]): number {
    let shift = 0;
    for (const r of merged) {
        if (r.end <= t + 1e-9) shift += r.end - r.start;
        else if (r.start < t) return Math.max(0, r.start - shift);
        else break;
    }
    return Math.max(0, t - shift);
}

/** Gap on `clips` containing `t`, or null when `t` is inside a clip. */
export function findGap(clips: Clip[], t: number): TimeRange | null {
    const sorted = [...clips].sort((a, b) => a.time - b.time);
    let cursor = 0;
    for (const c of sorted) {
        if (t >= c.time && t < c.time + c.duration) return null;
        if (t < c.time) return cursor < c.time ? { start: cursor, end: c.time } : null;
        cursor = Math.max(cursor, c.time + c.duration);
    }
    return null;
}

/** Every gap between clips, ignoring the runway after the last one. */
export function findAllGaps(clips: Clip[]): TimeRange[] {
    const sorted = [...clips].sort((a, b) => a.time - b.time);
    const out: TimeRange[] = [];
    let cursor = 0;
    for (const c of sorted) {
        if (c.time > cursor + 1e-9) out.push({ start: cursor, end: c.time });
        cursor = Math.max(cursor, c.time + c.duration);
    }
    return out;
}

/** Sorted, de-duplicated clip starts and ends: the `↑`/`↓` navigation targets. */
export function collectEditPoints(clipLists: Clip[][]): number[] {
    const set = new Set<number>([0]);
    for (const clips of clipLists) {
        for (const c of clips) {
            set.add(Number(c.time.toFixed(6)));
            set.add(Number((c.time + c.duration).toFixed(6)));
        }
    }
    return [...set].sort((a, b) => a - b);
}

export function nextValueAfter(values: number[], t: number): number | null {
    for (const v of values) if (v > t + 1e-4) return v;
    return null;
}

export function prevValueBefore(values: number[], t: number): number | null {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] < t - 1e-4) return values[i];
    return null;
}
