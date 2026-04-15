export const EventType = {
    AddToHand: 'ADD_TO_HAND',
    RemoveFromHand: 'REMOVE_FROM_HAND',
    LoseLife: 'LOSE_LIFE',
    GainLife: 'GAIN_LIFE',
    RevealFromHand: 'REVEAL_FROM_HAND',
    StackTop: 'STACK_TOP',
    Shuffle: 'SHUFFLE',
    DisplayCard: 'DISPLAY_CARD'
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventColorMap: Record<EventType, string> = {
    ADD_TO_HAND: 'bg-blue-500',
    REMOVE_FROM_HAND: 'bg-purple-500',
    LOSE_LIFE: 'bg-red-700',
    GAIN_LIFE: 'bg-green-700',
    REVEAL_FROM_HAND: 'bg-yellow-500',
    STACK_TOP: 'bg-blue-400',
    SHUFFLE: 'bg-gray-500',
    DISPLAY_CARD: 'bg-pink-500',
};

export interface TrackEvent {
    id: number;
    time: number;
    color: string;
    type: EventType;
    resizable: boolean;
    duration?: number;
    meta?: Record<string, any>;
}

export interface Track {
    id: string;
    playerId: string;
    events: TrackEvent[];
}
