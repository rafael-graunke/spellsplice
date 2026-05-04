import { useEffect, useRef, useState } from 'react';
import { GripVertical, Trash2Icon } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCardSearch } from '@/hooks/useCardSearch';
import { useCardPrintings } from '@/hooks/useCardPrintings';
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
} from '@/components/ui/combobox';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Item, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { Button } from '@/components/ui/button';
import { cardDataCache } from '@/lib/cardCache';
import type { TrackEvent, EventMeta } from '../types/event';
import type { Card } from '../types/card';
import type { Player } from '../types/player';

interface CardFieldsProps {
    event: TrackEvent;
    multi: boolean;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    showEdition?: boolean;
}

function EditionPicker({ card, onSelect }: { card: Card; onSelect: (edition: string) => void }) {
    const [open, setOpen] = useState(false);
    const { data: printings, isFetching } = useCardPrintings(open ? card.name : '');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="xs" className="font-mono uppercase">
                    {card.edition ?? 'Any Set'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 max-h-100 overflow-y-auto p-1" align="end">
                {isFetching && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                        Loading…
                    </div>
                )}
                {printings?.map((p) => (
                    <div
                        key={`${p.set}-${p.collector_number}`}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                        onClick={() => {
                            onSelect(p.set);
                            setOpen(false);
                        }}
                    >
                        <span className="w-9 shrink-0 font-mono uppercase text-muted-foreground">
                            {p.set}
                        </span>
                        <span className="truncate">{p.set_name}</span>
                    </div>
                ))}
            </PopoverContent>
        </Popover>
    );
}

interface SortableCardItemProps {
    id: string;
    card: Card;
    index: number;
    showEdition: boolean;
    onRemove: (index: number) => void;
    onUpdateEdition: (index: number, edition: string) => void;
}

function SortableCardItem({
    id,
    card,
    index,
    showEdition,
    onRemove,
    onUpdateEdition,
}: SortableCardItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} className="outline-none">
            <Item size="xs" variant="outline" className="cursor-default">
                <GripVertical
                    className="size-3.5 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground"
                    {...listeners}
                />
                <ItemContent>
                    <ItemTitle className="text-xs">{card.name}</ItemTitle>
                </ItemContent>
                <ItemActions>
                    {showEdition && (
                        <EditionPicker
                            card={card}
                            onSelect={(edition) => onUpdateEdition(index, edition)}
                        />
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
                        <Trash2Icon />
                    </Button>
                </ItemActions>
            </Item>
        </div>
    );
}

function makeId() {
    return Math.random().toString(36).slice(2);
}

export function CardFields({ event, multi, onUpdate, player, showEdition = true }: CardFieldsProps) {
    const [query, setQuery] = useState('');
    const [comboKey, setComboKey] = useState(0);
    const { data: suggestions, isFetching } = useCardSearch(query, player);

    const selected: Card[] = event.meta?.cards ?? [];

    // Stable IDs keyed to card instances, not positions.
    // Stored alongside the event ID so they reset when the selected event changes.
    const stableRef = useRef<{ eventId: string | number; ids: string[] }>({ eventId: '', ids: [] });
    if (stableRef.current.eventId !== event.id) {
        stableRef.current = {
            eventId: event.id,
            ids: selected.map(() => makeId()),
        };
    }
    // Guard against external length changes (shouldn't normally happen mid-edit).
    while (stableRef.current.ids.length < selected.length) {
        stableRef.current.ids.push(makeId());
    }
    stableRef.current.ids = stableRef.current.ids.slice(0, selected.length);

    const sensors = useSensors(useSensor(PointerSensor));

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const ids = stableRef.current.ids;
        const from = ids.indexOf(active.id as string);
        const to = ids.indexOf(over.id as string);
        if (from === -1 || to === -1) return;
        stableRef.current.ids = arrayMove(ids, from, to);
        onUpdate({ cards: arrayMove(selected, from, to) });
    };

    useEffect(() => {
        setQuery('');
        setComboKey((k) => k + 1);
    }, [event.id]);

    const addCard = (name: string) => {
        if (!name) return;
        const cachedSets = cardDataCache[name];
        const cachedEdition = cachedSets
            ? Object.keys(cachedSets).find((k) => k !== '*')
            : undefined;
        const newCard: Card = cachedEdition ? { name, edition: cachedEdition } : { name };
        const newId = makeId();
        if (multi) {
            stableRef.current.ids.push(newId);
        } else {
            stableRef.current.ids = [newId];
        }
        const next = multi ? [...selected, newCard] : [newCard];
        onUpdate({ cards: next });
        setQuery('');
        setComboKey((k) => k + 1);
    };

    const removeCard = (index: number) => {
        stableRef.current.ids.splice(index, 1);
        onUpdate({ cards: selected.filter((_, i) => i !== index) });
    };

    const updateEdition = (index: number, edition: string) => {
        onUpdate({ cards: selected.map((c, i) => (i === index ? { ...c, edition } : c)) });
    };

    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground">{multi ? 'Cards' : 'Card'}</label>

            <Combobox<string, false>
                key={comboKey}
                filter={null}
                autoHighlight
                onInputValueChange={(val, details) => {
                    if (details.reason === 'input-change') setQuery(val);
                }}
                onValueChange={(name) => {
                    if (name) addCard(name);
                }}
            >
                <ComboboxInput placeholder="Search cards…" className="h-8" />
                <ComboboxContent>
                    <ComboboxList>
                        {isFetching && (
                            <div className="py-2 text-center text-sm text-muted-foreground">
                                Searching…
                            </div>
                        )}
                        {!isFetching && !suggestions && (
                            <div className="py-2 text-center text-sm text-muted-foreground">
                                Start typing to search for cards
                            </div>
                        )}
                        {!isFetching && suggestions && suggestions.length === 0 && (
                            <div className="py-2 text-center text-sm text-muted-foreground">
                                No results
                            </div>
                        )}
                        {suggestions?.map((card) => (
                            <ComboboxItem key={card} value={card}>
                                {card}
                            </ComboboxItem>
                        ))}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>

            {selected.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={stableRef.current.ids}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-1">
                            {selected.map((card, i) => (
                                <SortableCardItem
                                    key={stableRef.current.ids[i]}
                                    id={stableRef.current.ids[i]}
                                    card={card}
                                    index={i}
                                    showEdition={showEdition}
                                    onRemove={removeCard}
                                    onUpdateEdition={updateEdition}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}
