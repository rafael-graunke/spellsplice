import type { Player } from '../../types/player';
import type { TrackEvent } from '../../types/event';
import type { Clip } from '../../types/clip';
import type { SvgIcon } from './EventIcon';
import { User2, Video, Volume2 } from 'lucide-react';

/**
 * Modal edit tools. Mutually exclusive, and distinct from the independent
 * toggles (snapping, follow playhead) and the one-shot actions (split at
 * playhead) they sit beside in the toolbar.
 */
export const TimelineTool = {
    Select: 'select',
    Razor: 'razor',
} as const;

export type TimelineTool = (typeof TimelineTool)[keyof typeof TimelineTool];

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

export interface TimelineTrackGroup {
    id: string;
    label: string;
    type: TrackType;
    tracks: TimelineTrack[];
}

export interface TimelineTrack {
    id: string;
    type: TrackType;
    events: TrackEvent[];
    clips?: Clip[];
    player?: Player;
    isBlocked: boolean;
    isHidden?: boolean;
    isMuted?: boolean;
    /** Whether ripple edits shift this track. Undefined = locked. */
    syncLock?: boolean;
    // Stable layer index for Event-type tracks — does not change when tracks are inserted/removed.
    // Used to filter player events (event.layer === eventLayer) and set newLayer on moves.
    eventLayer?: number;
}
