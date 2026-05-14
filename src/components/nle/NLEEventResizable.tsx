import React from 'react';
import { cn } from '@/lib/utils';
import type { FunctionComponent, ComponentProps } from 'react';
import { Book } from '@/assets/icons';
import type { EventType } from '../types/event';

type SvgIcon = FunctionComponent<ComponentProps<'svg'> & { title?: string }>;

const iconMap: Partial<Record<EventType, SvgIcon>> = {
    DISPLAY_CARD: Book,
};

interface NLEEventResizableProps {
    type: EventType;
    time: number;
    duration: number;
    zoom: number;
    color: string;
    isSelected: boolean;
    isBeingDragged: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: (e: React.MouseEvent) => void;
    onResizeLeftDown: (e: React.MouseEvent) => void;
    onResizeRightDown: (e: React.MouseEvent) => void;
    'data-testid'?: string;
}

export function NLEEventResizable({
    type,
    time,
    duration,
    zoom,
    color,
    isSelected,
    isBeingDragged,
    onMouseDown,
    onClick,
    onResizeLeftDown,
    onResizeRightDown,
    'data-testid': dataTestId,
}: NLEEventResizableProps) {
    const Icon = iconMap[type];

    return (
        <div
            className={cn(
                'absolute cursor-grab active:cursor-grabbing overflow-hidden h-[calc(100%-6px)] top-1/2 -translate-y-1/2 rounded-sm select-none',
                color,
                isBeingDragged && 'opacity-0',
                isSelected && 'ring-2 ring-white ring-inset',
            )}
            style={{ left: time * zoom, width: duration * zoom }}
            onMouseDown={onMouseDown}
            onClick={onClick}
            data-testid={dataTestId}
        >
            {Icon && <Icon className="absolute fill-white size-7 left-3 top-1/2 -translate-y-1/2" />}
            <div
                className="absolute cursor-col-resize h-full w-2 bg-white/30 left-0"
                onMouseDown={onResizeLeftDown}
            />
            <div
                className="absolute cursor-col-resize h-full w-2 bg-white/30 right-0"
                onMouseDown={onResizeRightDown}
            />
        </div>
    );
}
