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
    deckName?: string;
    decklist?: Decklist;
}
