export const ClipType = {
    Video: 'VIDEO',
    Audio: 'AUDIO',
} as const;

export type ClipType = (typeof ClipType)[keyof typeof ClipType];

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
        bg: 'bg-yellow-500/50',
        border: 'border-yellow-500',
        ring: 'ring-yellow-500',
        fill: 'fill-yellow-500',
        stroke: 'stroke-yellow-500',
    },
};

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
}
