import { useDroppable } from '@dnd-kit/core';
import { HandHelping, Trash2Icon } from 'lucide-react';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
    side: 'left' | 'right';
    cards: LibraryCardInstance[];
    onClear: () => void;
}

export function PlayerHand({ side, cards, onClear }: PlayerHandProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `hand-${side}` });

    return (
        <div className="flex flex-1 min-h-0 flex-col gap-1 overflow-hidden rounded-lg border bg-surface p-2">
            <div className="flex items-center justify-between shrink-0">
                <p className="text-xs font-medium uppercase text-muted-foreground select-none">Player Hand</p>
                <Button
                    className="cursor-pointer"
                    variant="destructive"
                    size="icon-sm"
                    disabled={cards.length === 0}
                    onClick={onClear}
                >
                    <Trash2Icon />
                </Button>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'relative flex flex-1 min-h-0 flex-col gap-1 px-1 py-2 overflow-y-auto bg-background rounded-md border border-transparent transition-colors',
                    isOver && 'border-ring bg-sunken'
                )}
            >
                {cards.length === 0 ? (
                    <Empty className="flex-1 min-h-0">
                        <Empty.Icon icon={HandHelping} size="size-6" />
                        <Empty.Title>No cards in hand</Empty.Title>
                        <Empty.Subtitle>
                            Drop cards here to add them to hand
                        </Empty.Subtitle>
                    </Empty>
                ) : (
                    cards.map(({ id, card }) => (
                        <DraggableCard
                            key={id}
                            id={`hand:${side}:${id}`}
                            card={card}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
