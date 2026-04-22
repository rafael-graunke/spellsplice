import { useEffect, useState } from 'react';
import { XIcon } from 'lucide-react';
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
import type { TrackEvent, EventMeta } from '../types/event';
import type { Card } from '../types/card';

interface CardFieldsProps {
    event: TrackEvent;
    multi: boolean;
    onUpdate: (meta: EventMeta) => void;
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

export function CardFields({ event, multi, onUpdate }: CardFieldsProps) {
    const [query, setQuery] = useState('');
    const [comboKey, setComboKey] = useState(0);
    const { data: suggestions, isFetching } = useCardSearch(query);

    const selected: Card[] = event.meta?.cards ?? [];

    useEffect(() => {
        setQuery('');
        setComboKey((k) => k + 1);
    }, [event.id]);

    const addCard = (name: string) => {
        if (!name) return;
        const next = multi
            ? selected.some((c) => c.name === name)
                ? selected
                : [...selected, { name }]
            : [{ name }];
        onUpdate({ cards: next });
        setQuery('');
        setComboKey((k) => k + 1);
    };

    const removeCard = (name: string) => {
        onUpdate({ cards: selected.filter((c) => c.name !== name) });
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
                <div className="flex flex-col gap-1">
                    {selected.map((card, i) => (
                        <Item key={card.name} size="xs" variant="outline">
                            <ItemContent>
                                <ItemTitle className="text-xs">{card.name}</ItemTitle>
                            </ItemContent>
                            <ItemActions>
                                <EditionPicker
                                    card={card}
                                    onSelect={(edition) => updateEdition(i, edition)}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => removeCard(card.name)}
                                >
                                    <XIcon />
                                </Button>
                            </ItemActions>
                        </Item>
                    ))}
                </div>
            )}
        </div>
    );
}
