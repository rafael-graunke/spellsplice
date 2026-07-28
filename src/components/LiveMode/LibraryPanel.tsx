import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { PencilIcon, SearchIcon, XIcon } from 'lucide-react';
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
import { Empty } from '@/components/ui/empty';
import { Draw } from '@/assets/icons';

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
                'flex flex-col h-full min-h-0 gap-2 p-2 border rounded-md dark:bg-surface overflow-hidden transition-colors',
                isOver && 'border-ring bg-input/50'
            )}
        >
            <div className="flex items-center justify-between shrink-0">
                <p className="text-xs font-medium uppercase text-muted-foreground select-none">
                    Library
                </p>
                <Button
                    className="cursor-pointer text-muted-foreground"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDialogOpen(true)}
                >
                    <PencilIcon />
                </Button>
            </div>
            <InputGroup className="dark:bg-background border-none">
                <InputGroupAddon align="inline-start">
                    <SearchIcon />
                </InputGroupAddon>
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
            <div className="relative flex flex-1 min-h-0 flex-col gap-2 overflow-hidden dark:bg-background rounded-md border border-transparent transition-colors">
                {!decklist ? (
                    <Empty className="flex-1 min-h-0 gap-3">
                        <div className="flex flex-col gap-1">
                            <Empty.Icon icon={Draw} className="fill-current" />
                            <Empty.Title>Library empty</Empty.Title>
                            <Empty.Subtitle>
                                No decklist imported yet
                            </Empty.Subtitle>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="pointer-events-auto cursor-pointer"
                            onClick={() => setDialogOpen(true)}
                        >
                            Import decklist
                        </Button>
                    </Empty>
                ) : (
                    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto rounded-md gap-1 px-1 py-2">
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
            </div>

            <ImportDecklistDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onImport={onImport}
                ready={ready}
            />
        </div>
    );
}
