import type { TrackEvent, EventMeta } from '../types/event';
import type { Player } from '../types/player';
import { LifeFields } from './LifeFields';
import { CardFields } from './CardFields';
import { HandPickerFields } from './HandPickerFields';

interface EventFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    autoFocus?: boolean;
}

export function EventFields({ event, onUpdate, player, autoFocus }: EventFieldsProps) {
    switch (event.type) {
        case 'GAIN_LIFE':
        case 'LOSE_LIFE':
            return <LifeFields event={event} onUpdate={onUpdate} autoFocus={autoFocus} />;

        case 'ADD_TO_HAND':
        case 'STACK_DECK':
            return <CardFields event={event} multi={true} onUpdate={onUpdate} player={player} autoFocus={autoFocus} />;

        case 'REVEAL_FROM_HAND':
        case 'REMOVE_FROM_HAND':
            return <HandPickerFields event={event} onUpdate={onUpdate} player={player} />;

        case 'DISPLAY_CARD':
            return <CardFields event={event} multi={false} onUpdate={onUpdate} player={player} autoFocus={autoFocus} />;

        case 'UNSTACK_DECK':
        case 'WIN':
            return null;
    }
}
