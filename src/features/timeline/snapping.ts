import type { TimelineTrack } from './types';
import type { Marker } from '../../types/marker';
import { PREVIEW_FPS } from './constants';

/**
 * Pixel, not seconds: a seconds-based threshold is unusable at high zoom and
 * grabby at low zoom.
 */
export const SNAP_THRESHOLD_PX = 8;

/**
 * Tighter than the clip threshold. The playhead is a scrubbing tool as much as
 * a positioning one, so it should let go sooner.
 */
export const PLAYHEAD_SNAP_THRESHOLD_PX = 6;

export interface SnapResult {
    /** Time to add to the dragged element(s). 0 when nothing snapped. */
    delta: number;
    /** Timeline time that was snapped to, for the indicator line. */
    target: number | null;
}

export const NO_SNAP: SnapResult = { delta: 0, target: null };

export type Snapper = (edges: number[]) => SnapResult;

/**
 * Builds a snapper over a fixed target set. Targets are sorted once so each
 * edge costs a binary search rather than a scan; a drag re-runs this per
 * mousemove against every clip edge, event and marker in the project.
 */
export function makeSnapper(
    targets: number[],
    zoom: number,
    threshold = SNAP_THRESHOLD_PX,
): Snapper {
    const sorted = [...targets].sort((a, b) => a - b);
    const window = threshold / zoom;

    return (edges: number[]): SnapResult => {
        let best = NO_SNAP;
        let bestDist = window;
        for (const edge of edges) {
            let lo = 0;
            let hi = sorted.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (sorted[mid] < edge) lo = mid + 1;
                else hi = mid;
            }
            for (const i of [lo - 1, lo]) {
                const target = sorted[i];
                if (target === undefined) continue;
                const dist = Math.abs(target - edge);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { delta: target - edge, target };
                }
            }
        }
        return best;
    };
}

export interface SnapTargetSources {
    tracks: TimelineTrack[];
    /** Clips being dragged/trimmed; their own edges must not attract them. */
    excludeClipIds?: Set<string>;
    excludeEventIds?: Set<number>;
    /**
     * Event times are dense here in a way a plain NLE timeline is not, so the
     * playhead leaves them out; `Shift+↑`/`↓` already lands on them exactly.
     */
    includeEvents?: boolean;
    playhead?: number;
    markers?: Marker[];
    inPoint?: number | null;
    outPoint?: number | null;
}

/** Every time a dragged edge can latch onto: 0, clip edges, events, playhead… */
export function collectSnapTargets({
    tracks,
    excludeClipIds,
    excludeEventIds,
    includeEvents = true,
    playhead,
    markers,
    inPoint,
    outPoint,
}: SnapTargetSources): number[] {
    const out: number[] = [0];
    for (const track of tracks) {
        for (const clip of track.clips ?? []) {
            if (excludeClipIds?.has(clip.id)) continue;
            out.push(clip.time, clip.time + clip.duration);
        }
        if (!includeEvents) continue;
        for (const ev of track.events) {
            if (excludeEventIds?.has(ev.id)) continue;
            out.push(ev.time);
            if (ev.duration) out.push(ev.time + ev.duration);
        }
    }
    if (playhead !== undefined) out.push(playhead);
    for (const m of markers ?? []) {
        out.push(m.time);
        if (m.duration) out.push(m.time + m.duration);
    }
    if (inPoint != null) out.push(inPoint);
    if (outPoint != null) out.push(outPoint);
    return out;
}

/** The playhead cannot sit between frames; every NLE puts it on the grid. */
export function quantizeToFrame(t: number, fps = PREVIEW_FPS): number {
    return Math.round(t * fps) / fps;
}

/**
 * Where a playhead drag/click should land.
 *
 * A snap wins over frame quantization: clip times are free floats, so rounding
 * a snapped time to the grid would push the playhead back off the edit point it
 * just latched onto.
 */
export function resolvePlayheadTime(
    t: number,
    snapper: Snapper | null,
    bypass: boolean,
): { time: number; target: number | null } {
    if (snapper && !bypass) {
        const snap = snapper([t]);
        if (snap.target != null) return { time: snap.target, target: snap.target };
    }
    return { time: quantizeToFrame(t), target: null };
}
