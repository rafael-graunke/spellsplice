import type { TrackEvent, EventMeta } from '../types/event';
import { LifeFields } from './LifeFields';
import { CardFields } from './CardFields';

interface EventFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
}

export function EventFields({ event, onUpdate }: EventFieldsProps) {
    switch (event.type) {
        case 'GAIN_LIFE':
        case 'LOSE_LIFE':
            return <LifeFields event={event} onUpdate={onUpdate} />;

        case 'ADD_TO_HAND':
        case 'REMOVE_FROM_HAND':
        case 'REVEAL_FROM_HAND':
        case 'DISPLAY_CARD':
            return <CardFields event={event} multi={true} onUpdate={onUpdate} />;

        case 'STACK_TOP':
            return <CardFields event={event} multi={false} onUpdate={onUpdate} />;

        case 'SHUFFLE':
            return null;
    }
}
