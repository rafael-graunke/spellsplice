import type { EventType } from '../../types/event';

export interface NLEGhostPos {
    left: number;
    width: number;
    type: EventType;
    isWaypoint: boolean;
}

export interface NLEClipGhostPos {
    left: number;
    width: number;
    color: string;
}

export interface NLEMoveResult {
    fromTrackId: string;
    toTrackId: string;
    eventId: number;
    newTime: number;
}

export interface ClipMoveResult {
    clipId: string;
    fromTrackId: string;
    toTrackId: string;
    newTime: number;
}
