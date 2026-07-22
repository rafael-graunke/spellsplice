import type { FunctionComponent, ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import {
    Damage,
    Discard,
    Draw,
    EventBackground,
    Eye,
    Heal,
    Unannotate,
    Annotate,
    Win,
} from '@/assets/icons';
import { EventColorMap } from '../types/event';
import type { EventType } from '../types/event';
import { RefreshCcw, Squircle, SquircleDashed } from 'lucide-react';

export type SvgIcon = FunctionComponent<ComponentProps<'svg'> & { title?: string }>;

const strokeTypes = new Set<EventType>(['HIDE_UI', 'RESET']);

export const iconMap: Partial<Record<EventType, SvgIcon>> = {
    ADD_TO_HAND: Draw,
    REMOVE_FROM_HAND: Discard,
    LOSE_LIFE: Damage,
    GAIN_LIFE: Heal,
    REVEAL_FROM_HAND: Eye,
    ANNOTATE_CARD: Annotate,
    UNANNOTATE_CARD: Unannotate,
    WIN: Win,
    HIDE_UI: SquircleDashed,
    SHOW_UI: Squircle,
    RESET: RefreshCcw,
};

interface NLEEventIconProps extends ComponentProps<'div'> {
    type: EventType;
    selected?: boolean;
    isBeingDragged?: boolean;
    position?: number;
}

function NLEEventIcon({
    selected = false,
    isBeingDragged = false,
    type,
    position,
    className,
    style,
    ...divProps
}: NLEEventIconProps) {
    const Icon = iconMap[type];
    const fillColor = EventColorMap[type].fill;

    return (
        <div
            className={cn(
                'size-9 absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
                'cursor-grab active:cursor-grabbing select-none',
                isBeingDragged && 'opacity-0',
                className
            )}
            style={{ left: position, ...style }}
            {...divProps}
        >
            <EventBackground
                className={cn(
                    'absolute inset-0 size-full',
                    fillColor,
                    selected && 'stroke-white stroke-25'
                )}
            />
            {Icon && <Icon className={cn(
                'absolute inset-0 size-5 -translate-x-1/2 left-1/2 -translate-y-[calc(50%-3px)] top-1/2',
                strokeTypes.has(type) ? 'stroke-white fill-none' : 'fill-white'
            )} />}
        </div>
    );
}

export default NLEEventIcon;
