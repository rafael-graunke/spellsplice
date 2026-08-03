export const ClipType = {
    Video: 'VIDEO',
    Audio: 'AUDIO',
    Image: 'IMAGE',
} as const;

export type ClipType = (typeof ClipType)[keyof typeof ClipType];

/** Visual clip types that composite spatially (carry a transform). */
export const VISUAL_CLIP_TYPES: ClipType[] = [ClipType.Video, ClipType.Image];

export interface ClipColor {
    text: string;
    bg: string;
    fill: string;
    stroke: string;
    border: string;
    ring: string;
}

export const ClipColorMap: Record<ClipType, ClipColor> = {
    [ClipType.Video]: {
        text: 'text-lime-600',
        bg: 'bg-lime-600/50',
        border: 'border-lime-600',
        ring: 'ring-lime-600',
        fill: 'fill-lime-600',
        stroke: 'stroke-lime-600',
    },
    [ClipType.Audio]: {
        text: 'text-yellow-500',
        bg: 'bg-yellow-500',
        border: 'border-yellow-500',
        ring: 'ring-yellow-500',
        fill: 'fill-yellow-500',
        stroke: 'stroke-yellow-500',
    },
    [ClipType.Image]: {
        text: 'text-sky-500',
        bg: 'bg-sky-500/50',
        border: 'border-sky-500',
        ring: 'ring-sky-500',
        fill: 'fill-sky-500',
        stroke: 'stroke-sky-500',
    },
};

/**
 * Spatial transform applied to a visual clip when compositing onto the fixed
 * project canvas. Position is the clip centre in project pixels; scale is
 * uniform by default (scaleX === scaleY = fit-to-height on creation); rotation
 * is degrees clockwise; opacity 0–1; blend maps to a 2D globalCompositeOperation.
 */
export interface ClipTransform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    opacity: number;
    blend: string;
}

/** Normalised (0–1 of source) inset cropped off each edge before drawing. */
export interface ClipCrop {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface Clip {
    id: string;
    type: ClipType;
    /** Output-timeline position where the clip starts (seconds). */
    time: number;
    /** Duration of the clip in the output timeline (seconds). */
    duration: number;
    /** ID of the MediaSource this clip references. */
    sourceId: string;
    /** Start offset within the source (seconds). Clip plays source[sourceOffset … sourceOffset+duration]. */
    sourceOffset: number;
    /** Track this clip belongs to — set when flattening per-track clips for playback. */
    trackId?: string;
    /**
     * Spatial transform for visual clips (video/image). Optional so pre-NLE
     * projects load; a missing transform is resolved to fit-to-height at read
     * time via resolveTransform(). Absent for audio clips.
     */
    transform?: ClipTransform;
    /** Normalised source crop for visual clips. Absent = no crop. */
    crop?: ClipCrop;
}
