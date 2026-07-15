import { useDroppable } from '@dnd-kit/core';
import { ImageIcon, RefreshCwIcon, Settings, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LibraryCardInstance } from './LibraryPanel';
import {
    ensureBackImage,
    ensureImage,
    subscribeImageLoad,
} from '@/lib/cardCache';
import { isMultiFaceLayout } from '@/lib/oracleCards';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CardDisplayProps {
    side: 'left' | 'right';
    card: LibraryCardInstance | null;
    flipped: boolean;
    disabled: boolean;
    onClear: () => void;
    onFlip: () => void;
}

export function CardDisplay({
    side,
    card,
    flipped,
    disabled,
    onClear,
    onFlip,
}: CardDisplayProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `card-display-${side}`,
        disabled,
    });
    const [, forceUpdate] = useState(0);
    useEffect(() => subscribeImageLoad(() => forceUpdate((n) => n + 1)), []);

    const canFlip = isMultiFaceLayout(card?.card.layout);
    const img = card
        ? flipped && canFlip
            ? ensureBackImage(card.card.name)
            : ensureImage(card.card.name)
        : null;

    return (
        <div className="relative p-2 flex flex-col gap-1 border bg-muted rounded-lg">
            <div className="flex items-center justify-between shrink-0">
                <p className="text-sm font-medium">Card Display</p>
                <Button className="cursor-pointer" variant="ghost" size="icon-sm" onClick={onClear}>
                    <Settings />
                </Button>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'relative flex w-full aspect-[5/7] items-center justify-center bg-black/20 rounded-lg overflow-hidden text-xs text-muted-foreground transition-colors',
                    isOver && 'border-ring bg-input/50'
                )}
            >
                {img instanceof HTMLImageElement && (
                    <img
                        src={img.src}
                        alt={card!.card.name}
                        className="h-full w-full rounded-xl object-cover"
                    />
                )}
                {!card && (
                    <div className="pointer-events-none absolute flex flex-col items-center gap-1 text-center">
                        <ImageIcon className="size-6 opacity-60" />
                        <span className="font-medium">Nothing on screen</span>
                        <span className="opacity-70">Drop a card to show it</span>
                    </div>
                )}
                {card && (
                    <Button
                        className="absolute right-1 top-1 cursor-pointer bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/90"
                        variant="destructive"
                        size="icon-sm"
                        onClick={onClear}
                    >
                        <XIcon />
                    </Button>
                )}
                {card && canFlip && (
                    <Button
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 cursor-pointer"
                        variant="secondary"
                        size="icon-lg"
                        onClick={onFlip}
                    >
                        <RefreshCwIcon />
                    </Button>
                )}
            </div>
        </div>
    );
}
