export const ClipType = {
    Video: 'VIDEO',
    Audio: 'AUDIO',
} as const;

export type ClipType = (typeof ClipType)[keyof typeof ClipType];

export const ClipColorMap: Record<ClipType, string> = {
    [ClipType.Video]: 'bg-lime-600',
    [ClipType.Audio]: 'bg-yellow-500',
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
