import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useCardSearch } from '@/hooks/useCardSearch';
import type { TrackEvent, EventMeta } from '../types/event';
import type { Card } from '../types/card';

interface CardFieldsProps {
    event: TrackEvent;
    multi: boolean;
    onUpdate: (meta: EventMeta) => void;
}

export function CardFields({ event, multi, onUpdate }: CardFieldsProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const { data: suggestions, isFetching } = useCardSearch(query);

    const selected: Card[] = event.meta?.cards ?? [];

    useEffect(() => {
        setQuery('');
    }, [event.id]);

    const addCard = (name: string) => {
        const card: Card = { name };
        const next = multi
            ? selected.some((c) => c.name === name) ? selected : [...selected, card]
            : [card];
        onUpdate({ cards: next });
        setQuery('');
        setOpen(false);
    };

    const removeCard = (cardName: string) => {
        onUpdate({ cards: selected.filter((c) => c.name !== cardName) });
    };

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">
                {multi ? 'Cards' : 'Card'}
            </label>

            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selected.map((card) => (
                        <span
                            key={card.name}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/10 text-white"
                        >
                            {card.name}
                            <span
                                className="cursor-pointer opacity-60 hover:opacity-100"
                                onClick={() => removeCard(card.name)}
                            >
                                ×
                            </span>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative">
                <Input
                    value={query}
                    placeholder="Search cards…"
                    className="h-8"
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => query.length > 1 && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
                {open && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                        {isFetching && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                Searching…
                            </div>
                        )}
                        {!isFetching && suggestions && suggestions.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                No results
                            </div>
                        )}
                        {suggestions?.map((card) => (
                            <div
                                key={card}
                                className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    addCard(card);
                                }}
                            >
                                {card}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
