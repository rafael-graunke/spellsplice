export interface TrackEvent {
    id: number;
    time: number;
    duration: number;
    color: string;
}

export interface Track {
    id: string;
    playerId: string;
    events: TrackEvent[];
}
