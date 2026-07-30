import { forwardRef, type HTMLAttributes } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import type { OracleCard } from '@/lib/oracleCards';
import { manaCostToClasses } from '@/lib/manaCost';
import {
    CARD_COLOR_BG,
    CARD_COLOR_BORDER,
    getCardColorKey,
    getGradientChipStyle,
} from '@/lib/cardColors';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CardChipProps extends HTMLAttributes<HTMLDivElement> {
    card: OracleCard;
}

export const CardChip = forwardRef<HTMLDivElement, CardChipProps>(
    ({ card, className, style, ...props }, ref) => {
        const [frontName, ...rest] = card.name.split('//');
        const backName = rest.join('//').trim();

        const gradient = getGradientChipStyle(card.colors);

        return (
            <div
                ref={ref}
                className={cn(
                    'flex shrink-0 items-center justify-between rounded-[8px/50%] border border-2 p-1 px-2 text-neutral-800 font-semibold text-sm select-none',
                    !gradient && CARD_COLOR_BG[getCardColorKey(card.colors)],
                    !gradient &&
                        CARD_COLOR_BORDER[getCardColorKey(card.colors)],
                    className
                )}
                style={gradient ? { ...gradient, ...style } : style}
                {...props}
            >
                <span className="flex items-center gap-2 min-w-0">
                    {backName && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <RefreshCwIcon
                                        className="size-4 shrink-0 opacity-80 stroke-2"
                                        onPointerDown={(e) =>
                                            e.stopPropagation()
                                        }
                                    />
                                </TooltipTrigger>
                                <TooltipContent>{backName}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                    <p className="truncate">{frontName.trim()}</p>
                </span>
                {card.mana_cost && (
                    <span className="flex items-center gap-0.5 shrink-0 pl-2">
                        {manaCostToClasses(card.mana_cost).map((cls, i) => (
                            <i
                                key={i}
                                className={cn(
                                    cls,
                                    'shadow-[0_2px_1px_rgba(0,0,0,0.8)]'
                                )}
                            />
                        ))}
                    </span>
                )}
            </div>
        );
    }
);
CardChip.displayName = 'CardChip';
