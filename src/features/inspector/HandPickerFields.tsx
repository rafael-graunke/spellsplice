import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Item, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { derivePlayerState } from '@/lib/deriveState';
import type { TrackEvent, EventMeta } from '../../types/event';
import type { Player } from '../../types/player';
import type { Card } from '../../types/card';

interface Props {
    event: TrackEvent;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    label?: string;
}

export function HandPickerFields({ event, onUpdate, player, label = 'Cards in Hand' }: Props) {
    const handCards = useMemo(() => {
        if (!player) return [] as Card[];
        const derived = derivePlayerState(
            player,
            player.track.events.filter((e) => e.id !== event.id),
            event.time,
        );
        return derived.cards;
    }, [player, event.id, event.time]);

    const groups = useMemo(() => {
        const map = new Map<string, { card: Card; total: number; selected: number }>();
        for (const card of handCards) {
            const entry = map.get(card.name) ?? { card, total: 0, selected: 0 };
            entry.total++;
            map.set(card.name, entry);
        }
        for (const card of event.meta?.cards ?? []) {
            const entry = map.get(card.name);
            if (entry) entry.selected = Math.min(entry.selected + 1, entry.total);
        }
        return [...map.values()];
    }, [handCards, event.meta?.cards]);

    if (!player || handCards.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">No cards in hand at this point.</p>
        );
    }

    const setCount = (name: string, count: number) => {
        const handCard = handCards.find((c) => c.name === name)!;
        const others = (event.meta?.cards ?? []).filter((c) => c.name !== name);
        const added = Array.from({ length: count }, () => ({ name: handCard.name, ...(handCard.edition ? { edition: handCard.edition } : {}) }));
        onUpdate({ cards: [...others, ...added] });
    };

    const allSelected = groups.every(({ total, selected }) => selected === total);

    const toggleAll = () => {
        if (allSelected) {
            onUpdate({ cards: [] });
        } else {
            const all = handCards.map((c) => ({ name: c.name, ...(c.edition ? { edition: c.edition } : {}) }));
            onUpdate({ cards: all });
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">{label}</label>
                <Button variant="ghost" size="xs" onClick={toggleAll}>
                    {allSelected ? 'Deselect all' : 'Select all'}
                </Button>
            </div>
            {groups.map(({ card, total, selected }) => (
                <Item
                    key={card.name}
                    size="default"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => setCount(card.name, selected > 0 ? 0 : total)}
                >
                    <Checkbox
                        checked={selected > 0}
                        className="pointer-events-none"
                    />
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
    );
}
