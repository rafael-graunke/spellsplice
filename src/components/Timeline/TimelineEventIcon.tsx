import type { FunctionComponent, ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import {
    Damage,
    Discard,
    Draw,
    EventBackground,
    Heal,
    Reveal,
    Shuffle,
    StackTop,
} from '@/assets/icons';
import { EventColorMap } from '../types/event';
import type { EventType } from '../types/event';

type SvgIcon = FunctionComponent<ComponentProps<'svg'> & { title?: string }>;

const iconMap: Record<EventType, SvgIcon> = {
    ADD_TO_HAND: Draw,
    REMOVE_FROM_HAND: Discard,
    LOSE_LIFE: Damage,
    GAIN_LIFE: Heal,
    REVEAL_FROM_HAND: Reveal,
    STACK_TOP: StackTop,
    SHUFFLE: Shuffle,
    DISPLAY_CARD: Reveal,
};

interface TimelineEventIconProps extends ComponentProps<'div'> {
    type: EventType;
    selected?: boolean;
    isBeingDragged?: boolean;
    position?: number;
}

function TimelineEventIcon({
    selected = false,
    isBeingDragged = false,
    type,
    position,
    className,
    style,
    ...divProps
}: TimelineEventIconProps) {
    const Icon = iconMap[type];
    const fillColor = EventColorMap[type].fill;

    return (
        <div
            className={cn(
                'size-12 absolute bottom-[-3px] -translate-x-1/2',
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
            <Icon className="absolute inset-0 size-7 fill-white -translate-x-1/2 left-1/2 -translate-y-[calc(50%-3px)] top-1/2" />
        </div>
    );
}

export default TimelineEventIcon;
