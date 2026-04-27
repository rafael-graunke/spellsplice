import type { Card } from './card';
import type { Track } from './event';

export interface Player {
    id: string;
    name: string;
    lifeTotal: number;
    handSize: number;
    cards: Card[];
    track: Track;
    deckName?: string;
}
