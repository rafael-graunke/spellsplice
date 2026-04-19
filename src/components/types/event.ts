export const EventType = {
    AddToHand: 'ADD_TO_HAND',
    RemoveFromHand: 'REMOVE_FROM_HAND',
    LoseLife: 'LOSE_LIFE',
    GainLife: 'GAIN_LIFE',
    RevealFromHand: 'REVEAL_FROM_HAND',
    StackTop: 'STACK_TOP',
    Shuffle: 'SHUFFLE',
    DisplayCard: 'DISPLAY_CARD',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export interface EventColor {
    text: string;
    bg: string;
    fill: string;
    stroke: string;
}

export const EventColorMap: Record<EventType, EventColor> = {
    ADD_TO_HAND: {
        text: 'text-blue-400',
        bg: 'bg-blue-400',
        fill: 'fill-blue-400',
        stroke: 'stroke-blue-400',
    },
    REMOVE_FROM_HAND: {
        text: 'text-purple-400',
        bg: 'bg-purple-400',
        fill: 'fill-purple-400',
        stroke: 'stroke-purple-400',
    },
    LOSE_LIFE: {
        text: 'text-red-700',
        bg: 'bg-red-700',
        fill: 'fill-red-700',
        stroke: 'stroke-red-700',
    },
    GAIN_LIFE: {
        text: 'text-green-600',
        bg: 'bg-green-600',
        fill: 'fill-green-600',
        stroke: 'stroke-green-600',
    },
    REVEAL_FROM_HAND: {
        text: 'text-yellow-600',
        bg: 'bg-yellow-600',
        fill: 'fill-yellow-600',
        stroke: 'stroke-yellow-600',
    },
    STACK_TOP: {
        text: 'text-cyan-700',
        bg: 'bg-cyan-700',
        fill: 'fill-cyan-700',
        stroke: 'stroke-cyan-700',
    },
    SHUFFLE: {
        text: 'text-gray-500',
        bg: 'bg-gray-500',
        fill: 'fill-gray-500',
        stroke: 'stroke-gray-500',
    },
    DISPLAY_CARD: {
        text: 'text-pink-500',
        bg: 'bg-pink-500',
        fill: 'fill-pink-500',
        stroke: 'stroke-pink-500',
    },
};

export interface TrackEvent {
    id: number;
    time: number;
    layer: number;
    color: string;
    type: EventType;
    resizable: boolean;
    duration?: number;
    meta?: Record<string, any>;
}

export interface Track {
    id: string;
    layers: number;
    events: TrackEvent[];
}
