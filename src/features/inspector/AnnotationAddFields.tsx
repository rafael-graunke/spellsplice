import type { TrackEvent, EventMeta } from '../../types/event';
import type { Player } from '../../types/player';
import type { AnnotationSlot } from '../../types/config';
import { CardFields } from './CardFields';
import { SlotSelect } from './SlotSelect';

interface Props {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    slots: AnnotationSlot[];
    onManageSlots?: () => void;
    autoFocus?: boolean;
}

// ANNOTATE_CARD editor: pick a slot, then append cards to it via free-text
// autocomplete. annotationId is preserved on every card update.
export function AnnotationAddFields({ event, onUpdate, player, slots, onManageSlots, autoFocus }: Props) {
    const slotId = event.meta?.annotationId ?? slots[0]?.id;
    return (
        <div className="flex flex-col gap-3">
            <SlotSelect
                slots={slots}
                value={slotId}
                onChange={(id) => onUpdate({ ...event.meta, annotationId: id })}
                onManage={onManageSlots}
            />
            <CardFields
                event={event}
                multi
                onUpdate={(meta) => onUpdate({ ...meta, annotationId: slotId })}
                player={player}
                autoFocus={autoFocus}
            />
        </div>
    );
}
