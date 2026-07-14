import { useDroppable } from '@dnd-kit/core';
import { RefreshCwIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LibraryCardInstance } from './LibraryPanel';
import { ensureBackImage, ensureImage, subscribeImageLoad } from '@/lib/cardCache';
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

export function CardDisplay({ side, card, flipped, disabled, onClear, onFlip }: CardDisplayProps) {
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
        <div
            ref={setNodeRef}
            className={cn(
                'relative flex w-full aspect-[5/7] items-center justify-center overflow-hidden rounded-lg border bg-muted p-2 text-xs text-muted-foreground transition-colors',
                isOver && 'border-ring bg-input/50',
            )}
        >
            {img instanceof HTMLImageElement && (
                <img src={img.src} alt={card!.card.name} className="h-full w-full rounded-xl object-cover" />
            )}
            {!card && <span className="pointer-events-none absolute">Card display</span>}
            {card && (
                <Button
                    className="absolute right-1 top-1 cursor-pointer"
                    variant="destructive"
                    size="icon-xs"
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
    );
}
