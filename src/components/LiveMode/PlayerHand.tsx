import { useDroppable } from '@dnd-kit/core';
import { Trash2Icon } from 'lucide-react';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
    side: 'left' | 'right';
    cards: LibraryCardInstance[];
    onClear: () => void;
}

export function PlayerHand({ side, cards, onClear }: PlayerHandProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `hand-${side}` });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-1 min-h-0 flex-col gap-1 overflow-hidden rounded-lg border bg-muted p-2 transition-colors',
                isOver && 'border-ring bg-input/50'
            )}
        >
            <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-sm font-medium">Player Hand</p>
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
            <div className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto">
                {cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                        No cards in hand
                    </p>
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
