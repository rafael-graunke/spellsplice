import { useDraggable } from '@dnd-kit/core';
import type { OracleCard } from '@/lib/oracleCards';
import { CardChip } from './CardChip';
import { cn } from '@/lib/utils';

interface DraggableCardProps {
    id: string;
    card: OracleCard;
    disabled?: boolean;
}

export function DraggableCard({ id, card, disabled }: DraggableCardProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });

    return (
        <CardChip
            ref={setNodeRef}
            card={card}
            {...listeners}
            {...attributes}
            className={cn(
                disabled ? 'cursor-default' : 'cursor-grab touch-none active:cursor-grabbing',
                isDragging && 'opacity-30',
            )}
        />
    );
}
