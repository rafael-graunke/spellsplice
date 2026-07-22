import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { deriveAnnotations } from '@/lib/deriveState';
import type { TrackEvent, EventMeta } from '../types/event';
import type { Player } from '../types/player';
import type { Card } from '../types/card';
import type { AnnotationSlot } from '../types/config';
import { SlotSelect } from './SlotSelect';

interface Props {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    slots: AnnotationSlot[];
    onManageSlots?: () => void;
}

// UNANNOTATE_CARD editor: pick a slot, then choose which cards to remove.
// Selecting no cards clears the whole slot (empty cards = clear all).
export function AnnotationRemoveFields({ event, onUpdate, player, slots, onManageSlots }: Props) {
    const slotId = event.meta?.annotationId ?? slots[0]?.id;

    const slotCards = useMemo(() => {
        if (!player || !slotId) return [] as Card[];
        const derived = deriveAnnotations(
            player.track.events.filter((e) => e.id !== event.id),
            event.time,
        );
        return (derived[slotId] ?? []).map((c) => c.card);
    }, [player, slotId, event.id, event.time]);

    const groups = useMemo(() => {
        const map = new Map<string, { card: Card; total: number; selected: number }>();
        for (const card of slotCards) {
            const entry = map.get(card.name) ?? { card, total: 0, selected: 0 };
            entry.total++;
            map.set(card.name, entry);
        }
        for (const card of event.meta?.cards ?? []) {
            const entry = map.get(card.name);
            if (entry) entry.selected = Math.min(entry.selected + 1, entry.total);
        }
        return [...map.values()];
    }, [slotCards, event.meta?.cards]);

    const setCount = (name: string, count: number) => {
        const source = slotCards.find((c) => c.name === name)!;
        const others = (event.meta?.cards ?? []).filter((c) => c.name !== name);
        const added = Array.from({ length: count }, () => ({
            name: source.name,
            ...(source.edition ? { edition: source.edition } : {}),
        }));
        onUpdate({ annotationId: slotId, cards: [...others, ...added] });
    };

    const allSelected = groups.length > 0 && groups.every(({ total, selected }) => selected === total);

    const toggleAll = () => {
        if (allSelected) {
            onUpdate({ annotationId: slotId, cards: [] });
        } else {
            const all = slotCards.map((c) => ({ name: c.name, ...(c.edition ? { edition: c.edition } : {}) }));
            onUpdate({ annotationId: slotId, cards: all });
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <SlotSelect
                slots={slots}
                value={slotId}
                onChange={(id) => onUpdate({ annotationId: id, cards: [] })}
                onManage={onManageSlots}
            />
            {slotCards.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    Slot is empty at this point. This event clears the slot.
                </p>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground">Cards to remove</label>
                        <Button variant="ghost" size="xs" onClick={toggleAll}>
                            {allSelected ? 'Deselect all' : 'Select all'}
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        No cards selected clears the whole slot.
                    </p>
                    {groups.map(({ card, total, selected }) => (
                        <Item
                            key={card.name}
                            size="default"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => setCount(card.name, selected > 0 ? 0 : total)}
                        >
                            <Checkbox checked={selected > 0} className="pointer-events-none" />
                            <ItemContent>
                                <ItemTitle className="text-xs">{card.name}</ItemTitle>
                            </ItemContent>
                            {total > 1 && (
                                <ItemActions onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        disabled={selected === 0}
                                        onClick={() => setCount(card.name, selected - 1)}
                                    >
                                        −
                                    </Button>
                                    <span className="w-8 text-center text-xs text-muted-foreground">
                                        {selected}/{total}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        disabled={selected === total}
                                        onClick={() => setCount(card.name, selected + 1)}
                                    >
                                        +
                                    </Button>
                                </ItemActions>
                            )}
                        </Item>
                    ))}
                </div>
            )}
        </div>
    );
}
