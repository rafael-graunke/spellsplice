import type { EventType } from '../../../types/event';

export interface GhostPos {
    left: number;
    width: number;
    type: EventType;
    isWaypoint: boolean;
}


export interface ClipGhostPos {
    left: number;
    width: number;
    color: string;
}

export interface MoveResult {
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
