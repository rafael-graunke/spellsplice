import type { Track } from './event';

export interface Player {
    id: string;
    name: string;
    lifeTotal: number;
    handSize: number;
    cards: string[];
    track: Track;
}
