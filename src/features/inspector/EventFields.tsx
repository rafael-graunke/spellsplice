import type { TrackEvent, EventMeta } from '../../types/event';
import type { Player } from '../../types/player';
import type { AnnotationSlot } from '../../types/config';
import { LifeFields } from './LifeFields';
import { CardFields } from './CardFields';
import { HandPickerFields } from './HandPickerFields';
import { AnnotationAddFields } from './AnnotationAddFields';
import { AnnotationRemoveFields } from './AnnotationRemoveFields';

interface EventFieldsProps {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    slots?: AnnotationSlot[];
    onManageSlots?: () => void;
    autoFocus?: boolean;
}

export function EventFields({ event, onUpdate, player, slots = [], onManageSlots, autoFocus }: EventFieldsProps) {
    switch (event.type) {
        case 'GAIN_LIFE':
        case 'LOSE_LIFE':
            return <LifeFields event={event} onUpdate={onUpdate} autoFocus={autoFocus} />;

        case 'ADD_TO_HAND':
            return <CardFields event={event} multi={true} onUpdate={onUpdate} player={player} autoFocus={autoFocus} />;

        case 'REVEAL_FROM_HAND':
        case 'REMOVE_FROM_HAND':
            return <HandPickerFields event={event} onUpdate={onUpdate} player={player} />;

        case 'ANNOTATE_CARD':
            return <AnnotationAddFields event={event} onUpdate={onUpdate} player={player} slots={slots} onManageSlots={onManageSlots} autoFocus={autoFocus} />;

        case 'UNANNOTATE_CARD':
            return <AnnotationRemoveFields event={event} onUpdate={onUpdate} player={player} slots={slots} onManageSlots={onManageSlots} />;

        case 'DISPLAY_CARD':
            return <CardFields event={event} multi={false} onUpdate={onUpdate} player={player} autoFocus={autoFocus} />;

        case 'WIN':
        case 'HIDE_UI':
        case 'SHOW_UI':
        case 'RESET':
            return null;
    }
}
