import type { Card } from './card';
import type { Track } from './event';


export interface Decklist {
    maindeck: Array<{ card: Card; quantity: number }>;
    sideboard?: Array<{ card: Card; quantity: number }>;
}

export interface Player {
    id: string;
    name: string;
    lifeTotal: number;
    handSize: number;
    cards: Card[];
    track: Track;
    wins: number;
    deckName?: string;
    decklist?: Decklist;
}
