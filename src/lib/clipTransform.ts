import type { Clip, ClipTransform, ClipCrop } from '@/types/clip';
import type { MediaSource } from '@/types/source';
import type { Resolution } from '@/types/config';

/** No crop. */
export const NO_CROP: ClipCrop = { top: 0, right: 0, bottom: 0, left: 0 };

/** Default output duration (seconds) for an image clip, which has no intrinsic length. */
export const DEFAULT_IMAGE_CLIP_DURATION = 5;

/**
 * Default transform for a freshly-created visual clip: fit-to-height (uniform
 * scale so the source height fills the canvas height), centred, no rotation.
 * Never stretches. Falls back to filling the canvas when the source has no
 * known intrinsic dimensions yet (metadata not loaded).
 */
export function defaultTransform(source: MediaSource | undefined, resolution: Resolution): ClipTransform {
    const sh = source?.height ?? 0;
    const scale = sh > 0 ? resolution.height / sh : 1;
    return {
        x: resolution.width / 2,
        y: resolution.height / 2,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        opacity: 1,
        blend: 'normal',
    };
}

/** Transform for a clip, resolving a missing one to the fit-to-height default. */
export function resolveTransform(
    clip: Clip,
    source: MediaSource | undefined,
    resolution: Resolution,
): ClipTransform {
    return clip.transform ?? defaultTransform(source, resolution);
}

export interface ClipRect {
    /** Centre of the visible (cropped) rectangle, in project pixels. */
    cx: number;
    cy: number;
    /** Visible width/height in project pixels (crop + scale applied). */
    w: number;
    h: number;
    /** Rotation in degrees, clockwise, about the centre. */
    rotation: number;
}

/**
 * The visible clip rectangle in project space. Crop shrinks the box; the centre
 * (x,y) stays the anchor. When the source size is unknown the rect covers the
 * whole canvas so the clip is still selectable.
 */
export function clipRectInProject(
    transform: ClipTransform,
    source: MediaSource | undefined,
    resolution: Resolution,
    crop: ClipCrop = NO_CROP,
): ClipRect {
    const sw = source?.width ?? resolution.width;
    const sh = source?.height ?? resolution.height;
    const w = sw * (1 - crop.left - crop.right) * transform.scaleX;
    const h = sh * (1 - crop.top - crop.bottom) * transform.scaleY;
    return { cx: transform.x, cy: transform.y, w, h, rotation: transform.rotation };
}

/** Rotate a vector by `deg` degrees clockwise. */
export function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return { x: x * c - y * s, y: x * s + y * c };
}

/** Source intrinsic dimensions, falling back to the canvas size when unknown. */
export function sourceDims(
    source: { width?: number; height?: number } | undefined,
    resolution: Resolution,
): { w: number; h: number } {
    return {
        w: source?.width ?? resolution.width,
        h: source?.height ?? resolution.height,
    };
}

/** True if a project-space point falls inside the rect (rotation accounted for). */
export function pointInRect(px: number, py: number, rect: ClipRect): boolean {
    const local = rotateVec(px - rect.cx, py - rect.cy, -rect.rotation);
    return Math.abs(local.x) <= rect.w / 2 && Math.abs(local.y) <= rect.h / 2;
}

/** The four corners of a ClipRect in project space (TL, TR, BR, BL), rotation applied. */
export function clipRectCorners(rect: ClipRect): Array<{ x: number; y: number }> {
    const rad = (rect.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = rect.w / 2;
    const hh = rect.h / 2;
    return [
        { x: -hw, y: -hh },
        { x: hw, y: -hh },
        { x: hw, y: hh },
        { x: -hw, y: hh },
    ].map((p) => ({
        x: rect.cx + p.x * cos - p.y * sin,
        y: rect.cy + p.x * sin + p.y * cos,
    }));
}

/**
 * Map a screen point to project (canvas) coordinates. Because the WebGL canvas
 * fills its client rect (uVideoRect is full-frame), this is a single uniform
 * scale from the canvas bounding rect to project pixels.
 */
export function screenToProject(
    clientX: number,
    clientY: number,
    rect: DOMRect,
    resolution: Resolution,
): { x: number; y: number } {
    return {
        x: ((clientX - rect.left) / rect.width) * resolution.width,
        y: ((clientY - rect.top) / rect.height) * resolution.height,
    };
}

/** Inverse of screenToProject: project pixels to screen (client) coordinates. */
export function projectToScreen(
    px: number,
    py: number,
    rect: DOMRect,
    resolution: Resolution,
): { x: number; y: number } {
    return {
        x: rect.left + (px / resolution.width) * rect.width,
        y: rect.top + (py / resolution.height) * rect.height,
    };
}
