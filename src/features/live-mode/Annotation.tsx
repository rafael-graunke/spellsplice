import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
    ChevronRightIcon,
    InfoIcon,
    PencilIcon,
    Trash2Icon,
} from 'lucide-react';
import type { LibraryCardInstance } from './LibraryPanel';
import { DraggableCard } from './DraggableCard';
import { AnnotationDialog } from './AnnotationDialog';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/empty';
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
            className={cn("flex shrink-0 flex-col overflow-hidden rounded-lg border bg-surface p-2 transition-colors select-none", 
                !collapsed && "gap-2",
            )}
        >
            <div
                className="flex items-center justify-between shrink-0 cursor-pointer"
                onClick={() => setCollapsed((c) => !c)}
            >
                <div className="flex items-center gap-1 min-w-0">
                    <ChevronRightIcon
                        className={cn(
                            'size-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                            !collapsed && 'rotate-90'
                        )}
                    />
                    <p className="text-xs font-medium truncate uppercase text-muted-foreground">
                        {title}
                    </p>
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
                    className="flex items-center gap-1 shrink-0 cursor-default"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Button
                        className="cursor-pointer text-muted-foreground"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDialogOpen(true)}
                    >
                        <PencilIcon />
                    </Button>
                    <Button
                        className={cn(cards.length === 0 && "cursor-default")}
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
            <div
                className={cn(
                    'grid transition-[grid-template-rows] duration-200 ease-out',
                    collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
                )}
            >
                <div className="overflow-hidden">
                    <div
                        className={cn(
                            'flex flex-col gap-1 rounded-md dark:bg-background px-1 py-2 border border-transparent transition-colors',
                            isOver && 'border-ring bg-sunken dark:bg-sunken'
                        )}
                    >
                        {cards.length === 0 ? (
                            <Empty className="py-2">
                                <Empty.Title>No cards annotated</Empty.Title>
                            </Empty>
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
                </div>
            </div>
        </div>
    );
}
