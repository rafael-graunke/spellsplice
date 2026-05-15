import type { Player } from './player';
import type { TrackEvent } from './event';

export const TrackType = {
    Event: 'EVENT',
    Video: 'VIDEO',
    Audio: 'AUDIO',
} as const;

export type TrackType = (typeof TrackType)[keyof typeof TrackType];

export const TrackTypeColorMap: Record<TrackType, string> = {
    [TrackType.Event]: 'bg-blue-600',
    [TrackType.Video]: 'bg-lime-700',
    [TrackType.Audio]: 'bg-yellow-600',
};

export interface NLETrackGroup {
    id: string;
    label: string;
    tracks: NLETrack[];
}

export interface NLETrack {
    id: string;
    type: TrackType;
    events: TrackEvent[];
    player?: Player;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
}
