import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Clip, ClipTransform, ClipCrop } from '../../types/clip';
import type { MediaSource } from '../../types/source';
import type { Resolution } from '../../types/config';
import type { VideoPreviewHandle } from './VideoPreview';
import {
    NO_CROP,
    clipRectInProject,
    clipRectCorners,
    projectToScreen,
    screenToProject,
    rotateVec,
    sourceDims,
} from '@/lib/clipTransform';

// Screen-pixel snap threshold and rotation snap increment.
const SNAP_PX = 6;
const ROTATE_SNAP_DEG = 15;
const MIN_SCALE_PX = 8;

type HandleId = 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w' | 'rotate';

interface PreviewGizmoProps {
    clip: Clip;
    trackId: string;
    source: MediaSource | undefined;
    resolution: Resolution;
    previewRef: RefObject<VideoPreviewHandle | null>;
    onCommit: (trackId: string, clipId: string, transform: ClipTransform, crop?: ClipCrop) => void;
}

interface DragSession {
    handle: HandleId;
    startTransform: ClipTransform;
    startCrop: ClipCrop;
    // Pointer position in project space at drag start.
    startPx: number;
    startPy: number;
    // Rect geometry at drag start.
    center0: { x: number; y: number };
    dw0: number;
    dh0: number;
    baseSw: number;
    baseSh: number;
    corners0: Array<{ x: number; y: number }>;
    edges0: Array<{ x: number; y: number }>;
    startAngle: number;
}

const CORNER_INDEX: Record<string, number> = { nw: 0, ne: 1, se: 2, sw: 3 };
// Edge handle order matches the edge midpoints computed in the session:
// n=mid(0,1), e=mid(1,2), s=mid(2,3), w=mid(3,0).
const EDGE_ORDER = ['n', 'e', 's', 'w'] as const;

export function PreviewGizmo({ clip, trackId, source, resolution, previewRef, onCommit }: PreviewGizmoProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef<DragSession | null>(null);
    const [, forceTick] = useState(0);
    const rerender = useCallback(() => forceTick((n) => n + 1), []);

    // Draft transform/crop shown while interacting; committed on pointer-up.
    const [draft, setDraft] = useState<{ transform: ClipTransform; crop: ClipCrop }>(() => ({
        transform: resolveInitialTransform(clip, source, resolution),
        crop: clip.crop ?? NO_CROP,
    }));
    const [cropMode, setCropMode] = useState(false);
    const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

    // Reset draft when the selected clip changes (or its committed transform does).
    useEffect(() => {
        setDraft({
            transform: resolveInitialTransform(clip, source, resolution),
            crop: clip.crop ?? NO_CROP,
        });
        // Clear any imperative override so the preview draws from committed state.
        previewRef.current?.setTransformOverride(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clip.id, clip.transform, clip.crop, source, resolution, previewRef]);

    // Keep handles glued to the canvas as the layout changes.
    useEffect(() => {
        const ro = new ResizeObserver(rerender);
        if (rootRef.current) ro.observe(rootRef.current);
        window.addEventListener('resize', rerender);
        window.addEventListener('scroll', rerender, true);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', rerender);
            window.removeEventListener('scroll', rerender, true);
        };
    }, [rerender]);

    // `C` toggles crop mode; Escape leaves it.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
                return;
            if (e.key === 'c' || e.key === 'C') setCropMode((m) => !m);
            else if (e.key === 'Escape') setCropMode(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const canvasRect = previewRef.current?.getCanvasRect() ?? null;
    const rootRect = rootRef.current?.getBoundingClientRect() ?? null;

    const { w: srcW, h: srcH } = sourceDims(source, resolution);
    const rect = clipRectInProject(draft.transform, source, resolution, draft.crop);
    const corners = clipRectCorners(rect);

    // Project point -> container-relative screen point.
    const toScreen = useCallback(
        (px: number, py: number) => {
            if (!canvasRect || !rootRect) return { x: 0, y: 0 };
            const s = projectToScreen(px, py, canvasRect, resolution);
            return { x: s.x - rootRect.left, y: s.y - rootRect.top };
        },
        [canvasRect, rootRect, resolution],
    );

    const onPointerDown = useCallback(
        (handle: HandleId) => (e: React.PointerEvent) => {
            if (!canvasRect) return;
            e.preventDefault();
            e.stopPropagation();
            // Capture the pointer so the handle keeps its cursor even if the drag
            // slips off the small hit target.
            try {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
            } catch {
                // pointer capture unsupported / already released
            }
            const p = screenToProject(e.clientX, e.clientY, canvasRect, resolution);
            const r = clipRectInProject(draft.transform, source, resolution, draft.crop);
            const cs = clipRectCorners(r);
            const edges = [
                mid(cs[0], cs[1]),
                mid(cs[1], cs[2]),
                mid(cs[2], cs[3]),
                mid(cs[3], cs[0]),
            ];
            sessionRef.current = {
                handle,
                startTransform: { ...draft.transform },
                startCrop: { ...draft.crop },
                startPx: p.x,
                startPy: p.y,
                center0: { x: r.cx, y: r.cy },
                dw0: r.w,
                dh0: r.h,
                baseSw: srcW * (1 - draft.crop.left - draft.crop.right),
                baseSh: srcH * (1 - draft.crop.top - draft.crop.bottom),
                corners0: cs,
                edges0: edges,
                startAngle: Math.atan2(p.y - r.cy, p.x - r.cx),
            };
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [canvasRect, draft, source, resolution, srcW, srcH],
    );

    const onPointerMove = useCallback((e: PointerEvent) => {
        const sess = sessionRef.current;
        const cr = previewRef.current?.getCanvasRect();
        if (!sess || !cr) return;
        const p = screenToProject(e.clientX, e.clientY, cr, resolution);
        const mods = { shift: e.shiftKey, alt: e.altKey, snapOff: e.ctrlKey || e.metaKey };

        let next: { transform: ClipTransform; crop: ClipCrop };
        let guide: { x: number | null; y: number | null } = { x: null, y: null };

        if (sess.handle === 'move') {
            const res = applyMove(sess, p, resolution, mods.snapOff, cr);
            next = { transform: res.transform, crop: sess.startCrop };
            guide = res.guide;
        } else if (sess.handle === 'rotate') {
            next = { transform: applyRotate(sess, p, mods.shift), crop: sess.startCrop };
        } else if (cropMode) {
            next = applyCrop(sess, p, srcW, srcH);
        } else {
            const thr = SNAP_PX * (resolution.width / cr.width);
            const res = applyScale(sess, p, mods.shift, mods.alt, mods.snapOff, resolution, thr);
            next = { transform: res.transform, crop: sess.startCrop };
            guide = res.guide;
        }

        setDraft(next);
        setGuides(guide);
        previewRef.current?.setTransformOverride({ clipId: clip.id, transform: next.transform, crop: next.crop });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolution, srcW, srcH, cropMode, clip.id]);

    const onPointerUp = useCallback(() => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        const sess = sessionRef.current;
        sessionRef.current = null;
        setGuides({ x: null, y: null });
        if (!sess) return;
        setDraft((d) => {
            onCommit(trackId, clip.id, d.transform, d.crop);
            return d;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trackId, clip.id, onCommit]);

    useEffect(() => {
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [onPointerMove, onPointerUp]);

    if (!canvasRect || !rootRect) {
        return <div ref={rootRef} className="absolute inset-0 pointer-events-none" />;
    }

    const sc = corners.map((c) => toScreen(c.x, c.y));
    const edgeMids = [mid(sc[0], sc[1]), mid(sc[1], sc[2]), mid(sc[2], sc[3]), mid(sc[3], sc[0])];
    const rotPos = rotationHandleScreen(sc);
    const color = cropMode ? '#f59e0b' : '#38bdf8';

    const guideX = guides.x != null ? toScreen(guides.x, 0).x : null;
    const guideY = guides.y != null ? toScreen(0, guides.y).y : null;

    return (
        <div ref={rootRef} className="absolute inset-0 pointer-events-none select-none">
            <svg className="absolute inset-0 w-full h-full overflow-visible">
                {guideX != null && (
                    <line x1={guideX} y1={0} x2={guideX} y2="100%" stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" />
                )}
                {guideY != null && (
                    <line x1={0} y1={guideY} x2="100%" y2={guideY} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" />
                )}
                {/* Body / outline — drag to move. */}
                <polygon
                    points={sc.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={1.5}
                    style={{ pointerEvents: 'auto', cursor: 'move' }}
                    onPointerDown={onPointerDown('move')}
                />
                {!cropMode && (
                    <line
                        x1={edgeMids[0].x}
                        y1={edgeMids[0].y}
                        x2={rotPos.x}
                        y2={rotPos.y}
                        stroke={color}
                        strokeWidth={1}
                    />
                )}
                {/* Edge handles: scale (transform mode) or crop (crop mode). */}
                {(['n', 'e', 's', 'w'] as HandleId[]).map((id, i) => (
                    <rect
                        key={id}
                        x={edgeMids[i].x - 4}
                        y={edgeMids[i].y - 4}
                        width={8}
                        height={8}
                        fill={color}
                        style={{ pointerEvents: 'auto', cursor: i % 2 === 0 ? 'ns-resize' : 'ew-resize' }}
                        onPointerDown={onPointerDown(id)}
                    />
                ))}
                {/* Corner handles: scale (hidden in crop mode). */}
                {!cropMode &&
                    (['nw', 'ne', 'se', 'sw'] as HandleId[]).map((id, i) => (
                        <rect
                            key={id}
                            x={sc[i].x - 5}
                            y={sc[i].y - 5}
                            width={10}
                            height={10}
                            fill="#fff"
                            stroke={color}
                            strokeWidth={1.5}
                            style={{
                                pointerEvents: 'auto',
                                cursor: id === 'nw' || id === 'se' ? 'nwse-resize' : 'nesw-resize',
                            }}
                            onPointerDown={onPointerDown(id)}
                        />
                    ))}
                {/* Rotation handle. */}
                {!cropMode && (
                    <circle
                        cx={rotPos.x}
                        cy={rotPos.y}
                        r={6}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={1.5}
                        style={{ pointerEvents: 'auto', cursor: 'grab' }}
                        onPointerDown={onPointerDown('rotate')}
                    />
                )}
            </svg>
        </div>
    );
}

function resolveInitialTransform(clip: Clip, source: MediaSource | undefined, resolution: Resolution): ClipTransform {
    if (clip.transform) return { ...clip.transform };
    const { h } = sourceDims(source, resolution);
    const scale = h > 0 ? resolution.height / h : 1;
    return { x: resolution.width / 2, y: resolution.height / 2, scaleX: scale, scaleY: scale, rotation: 0, opacity: 1, blend: 'normal' };
}

function mid(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Rotation handle sits beyond the top edge midpoint, along the edge normal.
function rotationHandleScreen(sc: Array<{ x: number; y: number }>) {
    const topMid = mid(sc[0], sc[1]);
    const bottomMid = mid(sc[2], sc[3]);
    const nx = topMid.x - bottomMid.x;
    const ny = topMid.y - bottomMid.y;
    const len = Math.hypot(nx, ny) || 1;
    return { x: topMid.x + (nx / len) * 24, y: topMid.y + (ny / len) * 24 };
}

function applyMove(
    sess: DragSession,
    p: { x: number; y: number },
    resolution: Resolution,
    snapOff: boolean,
    canvasRect: DOMRect,
): { transform: ClipTransform; guide: { x: number | null; y: number | null } } {
    let cx = sess.center0.x + (p.x - sess.startPx);
    let cy = sess.center0.y + (p.y - sess.startPy);
    let guideX: number | null = null;
    let guideY: number | null = null;

    if (!snapOff) {
        const thr = SNAP_PX * (resolution.width / canvasRect.width);
        // AABB half-extents of the (possibly rotated) rect.
        const half = aabbHalf(sess.dw0, sess.dh0, sess.startTransform.rotation);
        const xTargets = [0, resolution.width / 2, resolution.width, resolution.width / 3, (2 * resolution.width) / 3];
        const yTargets = [0, resolution.height / 2, resolution.height, resolution.height / 3, (2 * resolution.height) / 3];
        const snapX = snap1D(cx, half.x, xTargets, thr);
        const snapY = snap1D(cy, half.y, yTargets, thr);
        if (snapX) { cx = snapX.center; guideX = snapX.line; }
        if (snapY) { cy = snapY.center; guideY = snapY.line; }
    }
    return { transform: { ...sess.startTransform, x: cx, y: cy }, guide: { x: guideX, y: guideY } };
}

function aabbHalf(dw: number, dh: number, rotationDeg: number) {
    const rad = (rotationDeg * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    return { x: (dw * c + dh * s) / 2, y: (dw * s + dh * c) / 2 };
}

// Snap a center so one of {left edge, center, right edge} lands on a target line.
function snap1D(center: number, half: number, targets: number[], thr: number): { center: number; line: number } | null {
    let best: { center: number; line: number; dist: number } | null = null;
    // Each target line can be met by the clip's centre, left edge, or right edge.
    const candidates: Array<[number, number]> = [];
    for (const t of targets) {
        candidates.push([t, t], [t + half, t], [t - half, t]);
    }
    for (const [candidateCenter, line] of candidates) {
        const dist = Math.abs(candidateCenter - center);
        if (dist <= thr && (!best || dist < best.dist)) best = { center: candidateCenter, line, dist };
    }
    return best ? { center: best.center, line: best.line } : null;
}

function applyRotate(sess: DragSession, p: { x: number; y: number }, snap: boolean): ClipTransform {
    const a = Math.atan2(p.y - sess.center0.y, p.x - sess.center0.x);
    let deg = sess.startTransform.rotation + ((a - sess.startAngle) * 180) / Math.PI;
    if (snap) deg = Math.round(deg / ROTATE_SNAP_DEG) * ROTATE_SNAP_DEG;
    return { ...sess.startTransform, rotation: deg };
}

function canvasTargets(resolution: Resolution): { x: number[]; y: number[] } {
    return {
        x: [0, resolution.width / 2, resolution.width, resolution.width / 3, (2 * resolution.width) / 3],
        y: [0, resolution.height / 2, resolution.height, resolution.height / 3, (2 * resolution.height) / 3],
    };
}

function nearestLine(coord: number, targets: number[], thr: number): number | null {
    let best: number | null = null;
    let bestDist = thr;
    for (const t of targets) {
        const d = Math.abs(coord - t);
        if (d <= bestDist) { best = t; bestDist = d; }
    }
    return best;
}

function applyScale(
    sess: DragSession,
    p: { x: number; y: number },
    free: boolean,
    fromCenter: boolean,
    snapOff: boolean,
    resolution: Resolution,
    thr: number,
): { transform: ClipTransform; guide: { x: number | null; y: number | null } } {
    const rot = sess.startTransform.rotation;
    const startSX = sess.startTransform.scaleX;
    const startSY = sess.startTransform.scaleY;
    const isCorner = sess.handle in CORNER_INDEX;
    const horiz = sess.handle === 'e' || sess.handle === 'w';
    const vert = sess.handle === 'n' || sess.handle === 's';

    // Anchor (stays put) + the dragged handle point at drag start.
    let anchor: { x: number; y: number };
    let startHandle: { x: number; y: number };
    if (isCorner) {
        const i = CORNER_INDEX[sess.handle];
        startHandle = sess.corners0[i];
        anchor = fromCenter ? sess.center0 : sess.corners0[(i + 2) % 4];
    } else {
        const idx = EDGE_ORDER.indexOf(sess.handle as (typeof EDGE_ORDER)[number]);
        startHandle = sess.edges0[idx];
        anchor = fromCenter ? sess.center0 : sess.edges0[(idx + 2) % 4];
    }

    const v = rotateVec(p.x - anchor.x, p.y - anchor.y, -rot);
    const sv = rotateVec(startHandle.x - anchor.x, startHandle.y - anchor.y, -rot);

    let scaleX = startSX;
    let scaleY = startSY;

    if (isCorner) {
        if (free) {
            if (Math.abs(sv.x) > 1e-3) scaleX = startSX * (v.x / sv.x);
            if (Math.abs(sv.y) > 1e-3) scaleY = startSY * (v.y / sv.y);
        } else {
            const startLen = Math.hypot(startHandle.x - anchor.x, startHandle.y - anchor.y) || 1;
            const k = Math.hypot(p.x - anchor.x, p.y - anchor.y) / startLen;
            scaleX = startSX * k;
            scaleY = startSY * k;
        }
    } else if (horiz) {
        if (Math.abs(sv.x) > 1e-3) scaleX = startSX * (v.x / sv.x);
    } else if (vert) {
        if (Math.abs(sv.y) > 1e-3) scaleY = startSY * (v.y / sv.y);
    }

    let guideX: number | null = null;
    let guideY: number | null = null;

    // Snapping: land the dragged handle on a canvas guide line. For uniform
    // scaling the handle moves along the anchor->handle ray, so a target line is
    // hit by a single scale factor (works even when rotated). Free/edge snapping
    // adjusts the affected axis and only for unrotated clips.
    if (!snapOff && !fromCenter) {
        const targets = canvasTargets(resolution);
        const dx = startHandle.x - anchor.x;
        const dy = startHandle.y - anchor.y;
        if (isCorner && !free) {
            const f = scaleX / startSX;
            const handleX = anchor.x + f * dx;
            const handleY = anchor.y + f * dy;
            const lx = Math.abs(dx) > 1e-3 ? nearestLine(handleX, targets.x, thr) : null;
            const ly = Math.abs(dy) > 1e-3 ? nearestLine(handleY, targets.y, thr) : null;
            const fx = lx != null ? (lx - anchor.x) / dx : null;
            const fy = ly != null ? (ly - anchor.y) / dy : null;
            // Choose the smaller factor adjustment.
            let chosen: number | null = null;
            if (fx != null && (fy == null || Math.abs(fx - f) <= Math.abs(fy - f))) { chosen = fx; guideX = lx; }
            else if (fy != null) { chosen = fy; guideY = ly; }
            if (chosen != null) { scaleX = startSX * chosen; scaleY = startSY * chosen; }
        } else if (rot === 0) {
            if ((isCorner || horiz) && Math.abs(dx) > 1e-3) {
                const handleX = anchor.x + (scaleX / startSX) * dx;
                const lx = nearestLine(handleX, targets.x, thr);
                if (lx != null) { scaleX = startSX * ((lx - anchor.x) / dx); guideX = lx; }
            }
            if ((isCorner || vert) && Math.abs(dy) > 1e-3) {
                const handleY = anchor.y + (scaleY / startSY) * dy;
                const ly = nearestLine(handleY, targets.y, thr);
                if (ly != null) { scaleY = startSY * ((ly - anchor.y) / dy); guideY = ly; }
            }
        }
    }

    // Clamp to a minimum drawn size.
    const minSX = MIN_SCALE_PX / Math.max(1, sess.baseSw);
    const minSY = MIN_SCALE_PX / Math.max(1, sess.baseSh);
    scaleX = Math.max(minSX, Math.abs(scaleX));
    scaleY = Math.max(minSY, Math.abs(scaleY));

    // New centre so the anchor stays put.
    const newDw = sess.baseSw * scaleX;
    const newDh = sess.baseSh * scaleY;
    let center: { x: number; y: number };
    if (fromCenter) {
        center = sess.center0;
    } else if (isCorner) {
        const localHalf = { x: (Math.sign(sv.x) * newDw) / 2, y: (Math.sign(sv.y) * newDh) / 2 };
        const wc = rotateVec(localHalf.x, localHalf.y, rot);
        center = { x: anchor.x + wc.x, y: anchor.y + wc.y };
    } else {
        const localHalf = horiz
            ? { x: (Math.sign(sv.x) * newDw) / 2, y: 0 }
            : { x: 0, y: (Math.sign(sv.y) * newDh) / 2 };
        const wc = rotateVec(localHalf.x, localHalf.y, rot);
        center = { x: anchor.x + wc.x, y: anchor.y + wc.y };
    }

    return {
        transform: { ...sess.startTransform, x: center.x, y: center.y, scaleX, scaleY },
        guide: { x: guideX, y: guideY },
    };
}

// Crop mode: dragging an edge trims the source on that side, keeping the
// opposite edge fixed in world space (content doesn't jump). The visible box
// shrinks toward the dragged edge, so the centre shifts by half the change.
function applyCrop(
    sess: DragSession,
    p: { x: number; y: number },
    srcW: number,
    srcH: number,
): { transform: ClipTransform; crop: ClipCrop } {
    const rot = sess.startTransform.rotation;
    const local = rotateVec(p.x - sess.center0.x, p.y - sess.center0.y, -rot);
    const crop = { ...sess.startCrop };
    const scaleX = sess.startTransform.scaleX;
    const scaleY = sess.startTransform.scaleY;
    let shiftX = 0;
    let shiftY = 0;

    if (sess.handle === 'e') {
        const newVisibleW = clampMin(local.x + sess.dw0 / 2);
        crop.right = clamp01(1 - crop.left - newVisibleW / (srcW * scaleX), 0, 1 - crop.left);
        shiftX = -sess.dw0 / 2 + newVisibleW / 2;
    } else if (sess.handle === 'w') {
        const newVisibleW = clampMin(sess.dw0 / 2 - local.x);
        crop.left = clamp01(1 - crop.right - newVisibleW / (srcW * scaleX), 0, 1 - crop.right);
        shiftX = sess.dw0 / 2 - newVisibleW / 2;
    } else if (sess.handle === 's') {
        const newVisibleH = clampMin(local.y + sess.dh0 / 2);
        crop.bottom = clamp01(1 - crop.top - newVisibleH / (srcH * scaleY), 0, 1 - crop.top);
        shiftY = -sess.dh0 / 2 + newVisibleH / 2;
    } else if (sess.handle === 'n') {
        const newVisibleH = clampMin(sess.dh0 / 2 - local.y);
        crop.top = clamp01(1 - crop.bottom - newVisibleH / (srcH * scaleY), 0, 1 - crop.bottom);
        shiftY = sess.dh0 / 2 - newVisibleH / 2;
    }
    const w = rotateVec(shiftX, shiftY, rot);
    return {
        transform: { ...sess.startTransform, x: sess.center0.x + w.x, y: sess.center0.y + w.y },
        crop,
    };
}

function clampMin(v: number) {
    return Math.max(MIN_SCALE_PX, v);
}
function clamp01(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi - 0.001, v));
}
