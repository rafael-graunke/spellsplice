import { useDroppable } from '@dnd-kit/core';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { cn } from '@/lib/utils';

interface PlayerHandProps {
    side: 'left' | 'right';
    cards: LibraryCardInstance[];
}

export function PlayerHand({ side, cards }: PlayerHandProps) {
    const { setNodeRef, isOver } = useDroppable({ id: `hand-${side}` });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-1 min-h-24 flex-col gap-1 overflow-y-auto rounded-lg border p-2 transition-colors',
                isOver && 'border-ring bg-input/50',
            )}
        >
            <p className="text-sm font-medium">Player Hand</p>
            {cards.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Empty</p>
            ) : (
                cards.map(({ id, card }) => (
                    <DraggableCard key={id} id={`hand:${side}:${id}`} card={card} />
                ))
            )}
        </div>
    );
}
