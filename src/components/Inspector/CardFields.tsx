import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, Trash2Icon } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
import { useCardPrintings, type Printing } from '@/hooks/useCardPrintings';
import {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
} from '@/components/ui/combobox';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Item, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item';
import { Button } from '@/components/ui/button';
import { cardDataCache, storePrinting } from '@/lib/cardCache';
import type { TrackEvent, EventMeta } from '../types/event';
import type { Card } from '../types/card';
import type { Player } from '../types/player';
import { cn } from '@/lib/utils';

interface CardFieldsProps {
    event: TrackEvent;
    multi: boolean;
    onUpdate: (meta: EventMeta) => void;
    player?: Player | null;
    showEdition?: boolean;
    autoFocus?: boolean;
}

interface PrintingsListProps {
    filtered: Printing[];
    editionKey: (p: Printing) => string;
    onSelect: (p: Printing) => void;
    onHover: (p: Printing) => void;
    onLeave: () => void;
}

function PrintingsList({ filtered, editionKey, onSelect, onHover, onLeave }: PrintingsListProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: filtered.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 32,
        overscan: 5,
    });

    return (
        <div ref={scrollRef} className="h-80 overflow-y-auto rounded-md border scrollbar-thin">
            <div style={{ height: virtualizer.getTotalSize() }} className="relative w-full">
                {virtualizer.getVirtualItems().map((vItem) => {
                    const p = filtered[vItem.index];
                    const key = editionKey(p);
                    const hasNum = key.includes('#');
                    return (
                        <div
                            key={`${p.set}-${p.collector_number}`}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: vItem.size,
                                transform: `translateY(${vItem.start}px)`,
                            }}
                            className="flex cursor-pointer items-center gap-2 px-2 hover:bg-accent"
                            onClick={() => onSelect(p)}
                            onMouseEnter={() => onHover(p)}
                            onMouseLeave={onLeave}
                        >
                            <span className="w-16 shrink-0 font-mono text-xs uppercase text-muted-foreground">
                                {key}
                            </span>
                            <span className="truncate text-xs">
                                {p.set_name}{hasNum ? ` (#${p.collector_number})` : ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function useBlobUrl(url: string | undefined): string | null {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!url) { setBlobUrl(null); return; }
        let active = true;
        fetch(url, { mode: 'cors', cache: 'reload' })
            .then((r) => r.blob())
            .then((blob) => { if (active) setBlobUrl(URL.createObjectURL(blob)); })
            .catch(() => {});
        return () => {
            active = false;
            setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
        };
    }, [url]);
    return blobUrl;
}

function EditionPicker({ card, onSelect }: { card: Card; onSelect: (edition: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [hovered, setHovered] = useState<Printing | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // Once opened, keep passing card.name so the cache stays warm on reopen.
    const hasOpenedRef = useRef(false);
    if (open) hasOpenedRef.current = true;
    const { printings, editionKey, totalCards, loadedCount, isStreaming, isFetching } = useCardPrintings(
        hasOpenedRef.current ? card.name : '',
    );

    const filtered = useMemo(() => {
        if (!search) return printings;
        const q = search.toLowerCase();
        return printings.filter(
            (p) =>
                p.set.toLowerCase().includes(q) ||
                p.set_name.toLowerCase().includes(q) ||
                p.collector_number.includes(q),
        );
    }, [printings, search]);

    useEffect(() => {
        if (!open) {
            setSearch('');
            setHovered(null);
            clearTimeout(hoverTimer.current);
        }
    }, [open]);

    const previewBlobUrl = useBlobUrl(hovered?.image_uris?.normal);

    const onRowEnter = (p: Printing) => {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => setHovered(p), 250);
    };
    const onRowLeave = () => {
        clearTimeout(hoverTimer.current);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="xs" className="font-mono uppercase">
                    {card.edition ?? 'Any Set'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl" showCloseButton>
                <DialogTitle>Select printing for &ldquo;{card.name}&rdquo;</DialogTitle>
                <div className="flex gap-4">
                    <div className="flex flex-1 flex-col gap-2">
                        <input
                            className="h-8 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                            placeholder="Search sets…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                        {isFetching && printings.length === 0 && (
                            <div className="py-4 text-center text-xs text-muted-foreground">
                                Loading…
                            </div>
                        )}
                        <PrintingsList
                            filtered={filtered}
                            editionKey={editionKey}
                            onSelect={(p) => {
                                const key = editionKey(p);
                                storePrinting(card.name, key, p.image_uris, p.frame);
                                onSelect(key);
                                setOpen(false);
                            }}
                            onHover={onRowEnter}
                            onLeave={onRowLeave}
                        />
                        {isStreaming && totalCards != null && (
                            <div className="text-xs text-muted-foreground">
                                Loaded {loadedCount} / {totalCards}
                            </div>
                        )}
                    </div>
                    <div className="relative aspect-[23/32] shrink-0 self-stretch">
                        {previewBlobUrl ? (
                            <img
                                src={previewBlobUrl}
                                alt={card.name}
                                className={cn(
                                    "absolute inset-0 h-full w-full object-cover",
                                    hovered?.set.startsWith("lea")  ? "rounded-[20px]" : "rounded-[13px]",
                                )}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                                Hover a row to preview
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
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
                    <Button className="cursor-pointer" variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
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

export function CardFields({ event, multi, onUpdate, player, showEdition = true, autoFocus }: CardFieldsProps) {
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

    const focusNextMountRef = useRef(!!autoFocus);
    const hasInitedRef = useRef(false);

    useEffect(() => {
        setQuery('');
        if (!hasInitedRef.current) {
            hasInitedRef.current = true;
            return;
        }
        focusNextMountRef.current = !!autoFocus;
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
        focusNextMountRef.current = true;
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
                items={suggestions ?? []}
                filter={() => true}
                autoHighlight="always"
                onInputValueChange={(val, details) => {
                    if (details.reason === 'input-change') setQuery(val);
                }}
                onValueChange={(name) => {
                    if (name) addCard(name);
                }}
            >
                <ComboboxInput
                    placeholder="Search cards…"
                    className="h-8"
                    autoFocus={focusNextMountRef.current}
                    onKeyDown={(e) => { if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); }}
                />
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
