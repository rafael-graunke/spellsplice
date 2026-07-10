import { forwardRef, type HTMLAttributes } from 'react';
import type { OracleCard } from '@/lib/oracleCards';
import { manaCostToClasses } from '@/lib/manaCost';
import { CARD_COLOR_BG, getCardColorKey } from '@/lib/cardColors';
import { cn } from '@/lib/utils';

interface CardChipProps extends HTMLAttributes<HTMLDivElement> {
    card: OracleCard;
}

export const CardChip = forwardRef<HTMLDivElement, CardChipProps>(({ card, className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'flex shrink-0 items-center justify-between rounded-md border p-2 text-neutral-800 font-bold text-sm select-none',
            CARD_COLOR_BG[getCardColorKey(card.colors)],
            className,
        )}
        {...props}
    >
        <span>{card.name}</span>
        {card.mana_cost && (
            <span className="flex items-center gap-0.5">
                {manaCostToClasses(card.mana_cost).map((cls, i) => (
                    <i key={i} className={cn(cls, 'shadow-[0_2px_1px_rgba(0,0,0,0.8)]')} />
                ))}
            </span>
        )}
    </div>
));
CardChip.displayName = 'CardChip';
