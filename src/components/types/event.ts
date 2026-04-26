import type { Card } from './card';

export interface EventMeta {
    cards?: Card[];
    amount?: number;
}

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
        text: 'text-violet-500',
        bg: 'bg-violet-500',
        fill: 'fill-violet-500',
        stroke: 'stroke-violet-500',
    },
    LOSE_LIFE: {
        text: 'text-rose-700',
        bg: 'bg-rose-700',
        fill: 'fill-rose-700',
        stroke: 'stroke-rose-700',
    },
    GAIN_LIFE: {
        text: 'text-lime-600',
        bg: 'bg-lime-600',
        fill: 'fill-lime-600',
        stroke: 'stroke-lime-600',
    },
    REVEAL_FROM_HAND: {
        text: 'text-slate-500',
        bg: 'bg-slate-500',
        fill: 'fill-slate-500',
        stroke: 'stroke-slate-500',
    },
    STACK_TOP: {
        text: 'text-slate-500',
        bg: 'bg-slate-500',
        fill: 'fill-slate-500',
        stroke: 'stroke-slate-500',
    },
    SHUFFLE: {
        text: 'text-slate-500',
        bg: 'bg-slate-500',
        fill: 'fill-slate-500',
        stroke: 'stroke-slate-500',
    },
    DISPLAY_CARD: {
        text: 'text-taupe-500',
        bg: 'bg-taupe-500',
        fill: 'fill-taupe-500',
        stroke: 'stroke-taupe-500',
    },
};

export interface TrackEvent {
    id: number;
    time: number;
    layer: number;
    type: EventType;
    resizable: boolean;
    duration?: number;
    meta?: EventMeta;
}

export interface Track {
    id: string;
    layers: number;
    events: TrackEvent[];
}
