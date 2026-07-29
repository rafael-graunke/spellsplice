import { useDndMonitor, useDroppable, type Active } from '@dnd-kit/core';
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
import { Empty } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import { Book, Reveal } from '@/assets/icons';

function dragSideOf(id: string): 'left' | 'right' | null {
    const [prefix, key] = id.split(':');
    if (prefix === 'lib' || prefix === 'hand') return key as 'left' | 'right';
    if (prefix === 'annotation') return key.endsWith('-left') ? 'left' : 'right';
    return null;
}

interface CardDisplayProps {
    side: 'left' | 'right';
    card: LibraryCardInstance | null;
    flipped: boolean;
    // Epoch ms when a played card auto-clears; null = no active timer.
    playUntil: number | null;
    playDuration: number;
    onClear: () => void;
    onFlip: () => void;
    onSettings: () => void;
}

export function CardDisplay({
    side,
    card,
    flipped,
    playUntil,
    playDuration,
    onClear,
    onFlip,
    onSettings,
}: CardDisplayProps) {
    const [active, setActive] = useState<Active | null>(null);
    useDndMonitor({
        onDragStart: (e) => setActive(e.active),
        onDragEnd: () => setActive(null),
        onDragCancel: () => setActive(null),
    });
    const activeSide = active ? dragSideOf(String(active.id)) : null;
    const disabled = activeSide !== null && activeSide !== side;
    const { setNodeRef: setPlayRef, isOver: playOver } = useDroppable({
        id: `card-display-${side}-play`,
        disabled,
    });
    const { setNodeRef: setDisplayRef, isOver: displayOver } = useDroppable({
        id: `card-display-${side}-display`,
        disabled,
    });
    const dragging = !disabled && active != null;
    const [, forceUpdate] = useState(0);
    useEffect(() => subscribeImageLoad(() => forceUpdate((n) => n + 1)), []);

    const [rendered, setRendered] = useState(card);
    if (card && card !== rendered) setRendered(card);

    const canFlip = isMultiFaceLayout(rendered?.card.layout);
    const frontImg = rendered ? ensureImage(rendered.card.name) : null;
    const backImg =
        rendered && canFlip ? ensureBackImage(rendered.card.name) : null;

    const showCountdown = playUntil != null;

    return (
        <div className="relative p-2 flex flex-col gap-1 border bg-surface rounded-lg">
            <div className="flex items-center justify-between shrink-0">
                <p className="text-xs font-medium uppercase text-muted-foreground select-none">Card Display</p>
                <Button
                    className="cursor-pointer text-muted-foreground"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onSettings}
                >
                    <Settings />
                </Button>
            </div>
            <div className="relative flex w-full aspect-[5/7] items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors bg-background">
                {rendered && (
                    <div
                        onTransitionEnd={() => {
                            if (!card) setRendered(null);
                        }}
                        className={cn(
                            'absolute inset-0 transition-opacity',
                            card ? 'opacity-100' : 'opacity-0'
                        )}
                        style={{ perspective: '1000px' }}
                    >
                        <div
                            className="relative h-full w-full transition-transform duration-400"
                            style={{
                                transformStyle: 'preserve-3d',
                                transform:
                                    flipped && canFlip
                                        ? 'rotateY(180deg)'
                                        : 'none',
                            }}
                        >
                            {frontImg instanceof HTMLImageElement && (
                                <img
                                    src={frontImg.src}
                                    alt={rendered.card.name}
                                    className="absolute inset-0 h-full w-full rounded-xl object-cover"
                                    style={{ backfaceVisibility: 'hidden' }}
                                />
                            )}
                            {backImg instanceof HTMLImageElement && (
                                <img
                                    src={backImg.src}
                                    alt={rendered.card.name}
                                    className="absolute inset-0 h-full w-full rounded-xl object-cover"
                                    style={{
                                        backfaceVisibility: 'hidden',
                                        transform: 'rotateY(180deg)',
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
                {!card && (
                    <Empty>
                        <Empty.Icon icon={ImageIcon} size="size-6" />
                        <Empty.Title>Nothing on screen</Empty.Title>
                        <Empty.Subtitle>Drop a card to show it</Empty.Subtitle>
                    </Empty>
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
                {showCountdown && (
                    <div
                        key={playUntil}
                        className="absolute inset-x-0 bottom-0 h-1.5 origin-left bg-blue-500"
                        style={{
                            animation: `play-countdown ${playDuration}ms linear forwards`,
                        }}
                    />
                )}
                <div
                    className={cn(
                        'absolute inset-0 flex flex-col gap-2 bg-surface transition-opacity',
                        dragging
                            ? 'opacity-100'
                            : 'pointer-events-none opacity-0'
                    )}
                >
                    <div
                        ref={setPlayRef}
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/10 p-2 text-center transition-colors',
                            playOver && 'bg-blue-500/20'
                        )}
                    >
                        <Book className="size-12 fill-white" />
                        <span className="text-sm font-semibold text-white">
                            Play
                        </span>
                        <span className="text-xs text-white/70">
                            Remove card from origin and display for{' '}
                            {playDuration / 1000}s
                        </span>
                    </div>
                    <div
                        ref={setDisplayRef}
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-500/50 bg-purple-500/10 p-2 text-center transition-colors',
                            displayOver && 'bg-purple-500/20'
                        )}
                    >
                        <Reveal className="size-12 fill-white" />
                        <span className="text-sm font-semibold text-white">
                            Highlight
                        </span>
                        <span className="text-xs text-white/70">
                            Display the card till you decide to remove it
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
