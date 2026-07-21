import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
    ChevronDownIcon,
    ChevronUpIcon,
    InfoIcon,
    PencilIcon,
    Trash2Icon,
} from 'lucide-react';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { AnnotationDialog } from './AnnotationDialog';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AnnotationProps {
    id: string;
    title: string;
    description?: string;
    cards: LibraryCardInstance[];
    maxCards?: number;
    onClear: () => void;
    onSave: (title: string, description: string) => void;
    onDelete: () => void;
}

export function Annotation({
    id,
    title,
    description,
    cards,
    maxCards,
    onClear,
    onSave,
    onDelete,
}: AnnotationProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const { setNodeRef, isOver } = useDroppable({
        id: `annotation-${id}`,
        disabled: maxCards !== undefined && cards.length >= maxCards,
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'flex shrink-0 flex-col gap-2 overflow-hidden rounded-lg border bg-muted p-2 transition-colors',
                isOver && 'border-ring bg-input/50'
            )}
        >
            <div
                className="flex items-center justify-between shrink-0 cursor-pointer"
                onClick={() => setCollapsed((c) => !c)}
            >
                <div className="flex items-center gap-1 min-w-0">
                    {collapsed ? (
                        <ChevronUpIcon className="size-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0" />
                    )}
                    <p className="text-sm font-medium truncate">{title}</p>
                    {collapsed && (
                        <span className="text-xs text-muted-foreground shrink-0">
                            {cards.length} cards
                        </span>
                    )}
                    {description && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <InfoIcon className="size-3.5 text-muted-foreground shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>{description}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Button
                        className="cursor-pointer"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDialogOpen(true)}
                    >
                        <PencilIcon />
                    </Button>
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
            </div>
            <AnnotationDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={title}
                description={description}
                onSave={onSave}
                onDelete={onDelete}
            />
            {!collapsed && (
                <div className="flex flex-col gap-1">
                    {cards.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            No cards annotated
                        </p>
                    ) : (
                        cards.map(({ id: cardId, card }) => (
                            <DraggableCard
                                key={cardId}
                                id={`annotation:${id}:${cardId}`}
                                card={card}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
