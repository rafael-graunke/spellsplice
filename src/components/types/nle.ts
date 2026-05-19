import type { Player } from './player';
import type { TrackEvent } from './event';
import type { SvgIcon } from '../nle/NLEEventIcon';
import { User2, Video, Volume2 } from 'lucide-react';

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

export const TrackTypeIconMap: Record<TrackType, SvgIcon> = {
    [TrackType.Event]: User2,
    [TrackType.Video]: Video,
    [TrackType.Audio]: Volume2,
};

export interface NLETrackGroup {
    id: string;
    label: string;
    type: TrackType;
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
    // Stable layer index for Event-type tracks — does not change when tracks are inserted/removed.
    // Used to filter player events (event.layer === eventLayer) and set newLayer on moves.
    eventLayer?: number;
}
