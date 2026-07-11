import { useDroppable } from '@dnd-kit/core';
import { Trash2Icon } from 'lucide-react';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AnnotationProps {
    id: string;
    title: string;
    cards: LibraryCardInstance[];
    maxCards?: number;
    onClear: () => void;
}

export function Annotation({ id, title, cards, maxCards, onClear }: AnnotationProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `annotation-${id}`,
        disabled: maxCards !== undefined && cards.length >= maxCards,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex flex-1 min-h-24 flex-col gap-1 overflow-y-auto rounded-lg border p-2 transition-colors',
                isOver && 'border-ring bg-input/50',
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">{title}</p>
                <Button
                    className="cursor-pointer"
                    variant="destructive"
                    size="sm"
                    disabled={cards.length === 0}
                    onClick={onClear}
                >
                    <Trash2Icon />
                    Clear
                </Button>
            </div>
            {cards.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Empty</p>
            ) : (
                cards.map(({ id: cardId, card }) => (
                    <DraggableCard key={cardId} id={`annotation:${id}:${cardId}`} card={card} />
                ))
            )}
        </div>
    );
}
