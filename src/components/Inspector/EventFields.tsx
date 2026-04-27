import type { TrackEvent, EventMeta } from '../types/event';
import type { Player } from '../types/player';
import { LifeFields } from './LifeFields';
import { CardFields } from './CardFields';

interface EventFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
}

export function EventFields({ event, onUpdate, player }: EventFieldsProps) {
    switch (event.type) {
        case 'GAIN_LIFE':
        case 'LOSE_LIFE':
            return <LifeFields event={event} onUpdate={onUpdate} />;

        case 'ADD_TO_HAND':
        case 'STACK_TOP':
            return <CardFields event={event} multi={true} onUpdate={onUpdate} player={player} />;
            
        case 'REVEAL_FROM_HAND':
        case 'REMOVE_FROM_HAND':
            return <CardFields event={event} multi={true} onUpdate={onUpdate} player={player} showEdition={false} />;

        case 'DISPLAY_CARD':
            return <CardFields event={event} multi={false} onUpdate={onUpdate} player={player} />;

        case 'SHUFFLE':
            return null;
    }
}
