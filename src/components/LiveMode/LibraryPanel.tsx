import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { XIcon } from 'lucide-react';
import type { OracleCard } from '@/lib/oracleCards';
import type { Decklist } from '@/components/types/player';
import { DraggableCard } from './DraggableCard';
import ImportDecklistDialog from './ImportDecklistDialog';
import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

export interface LibraryCardInstance {
    id: string;
    card: OracleCard;
}

interface LibraryPanelProps {
    side: 'left' | 'right';
    decklist: Decklist | null;
    library: LibraryCardInstance[];
    ready: boolean;
    onImport: (decklist: Decklist) => void;
}

export function LibraryPanel({
    side,
    decklist,
    library,
    ready,
    onImport,
}: LibraryPanelProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [query, setQuery] = useState('');
    const { setNodeRef, isOver } = useDroppable({ id: `lib-${side}` });

    const q = query.toLowerCase();
    const visibleCards = q
        ? library.filter(({ card }) => card.name.toLowerCase().includes(q))
        : library;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-col h-full min-h-0 gap-2 p-2 border rounded-md bg-muted overflow-hidden transition-colors',
                isOver && 'border-ring bg-input/50'
            )}
        >
            <p className="text-sm font-medium">Library</p>

            <InputGroup>
                <InputGroupInput
                    placeholder="Search deck…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setQuery('')}
                        >
                            <XIcon />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>

            {!decklist ? (
                <Button className="w-full" onClick={() => setDialogOpen(true)}>
                    Import decklist
                </Button>
            ) : (
                <div className="flex flex-1 min-h-0 flex-col overflow-y-auto rounded-md gap-1">
                    {visibleCards.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            {library.length === 0
                                ? 'Library empty'
                                : 'No matches'}
                        </p>
                    ) : (
                        visibleCards.map(({ id, card }) => (
                            <DraggableCard
                                key={id}
                                id={`lib:${side}:${id}`}
                                card={card}
                            />
                        ))
                    )}
                </div>
            )}

            <ImportDecklistDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onImport={onImport}
                ready={ready}
            />
        </div>
    );
}
