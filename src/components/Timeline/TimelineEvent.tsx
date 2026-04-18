import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import TimelineEventIcon from './TimelineEventIcon';
import type { EventType } from '../types/event';

interface TimelineEventProps {
    color: string;
    time: number;
    duration?: number;
    zoom: number;
    type: EventType;
    resizable?: boolean;
    isSelected?: boolean;
    onSelect?: (additive: boolean) => void;
    onUpdate: (time: number, duration: number) => void;
    onMoveStart?: (e: React.MouseEvent, time: number, duration: number) => void;
    onDelete?: () => void;
    isBeingDragged?: boolean;
}

type DragMode = 'resize-left' | 'resize-right';

function TimelineEvent({
    color,
    time,
    duration,
    zoom,
    type,
    resizable = false,
    isSelected,
    onSelect,
    onUpdate,
    onMoveStart,
    onDelete,
    isBeingDragged,
}: TimelineEventProps) {
    const dragRef = useRef<{
        mode: DragMode;
        startX: number;
        startTime: number;
        startDuration: number;
    } | null>(null);
    const hasDragged = useRef(false);

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | DragMode) => {
        e.preventDefault();
        e.stopPropagation();
        hasDragged.current = false;

        if (mode === 'move') {
            onMoveStart?.(e, time, duration);
            return;
        }

        if (!resizable) return;
        dragRef.current = {
            mode,
            startX: e.clientX,
            startTime: time,
            startDuration: duration,
        };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;
            hasDragged.current = true;
            const { mode, startX, startTime, startDuration } = dragRef.current;
            const deltaTime = (e.clientX - startX) / zoom;

            if (mode === 'resize-left') {
                const newTime = Math.max(0, startTime + deltaTime);
                const newDuration = Math.max(
                    0.1,
                    startDuration - (newTime - startTime)
                );
                onUpdate(newTime, newDuration);
            } else if (mode === 'resize-right') {
                onUpdate(startTime, Math.max(0.1, startDuration + deltaTime));
            }
        };

        const onMouseUp = () => {
            dragRef.current = null;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [zoom, onUpdate]);

    const sharedMouseProps = {
        onMouseDown: (e: React.MouseEvent) => handleMouseDown(e, 'move'),
        onClick: (e: React.MouseEvent) => {
            if (!hasDragged.current) onSelect?.(e.ctrlKey || e.metaKey);
        },
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {resizable ? (
                    <div
                        className={cn(
                            'absolute cursor-grab active:cursor-grabbing overflow-hidden h-full rounded-sm select-none',
                            color,
                            isBeingDragged && 'opacity-0',
                            isSelected && 'ring-2 ring-white ring-inset'
                        )}
                        style={{
                            left: time * zoom,
                            width: (duration ?? 1) * zoom,
                        }}
                        {...sharedMouseProps}
                    >
                        <div
                            className="absolute cursor-col-resize h-full w-2 bg-white/30 left-0"
                            onMouseDown={(e) =>
                                handleMouseDown(e, 'resize-left')
                            }
                        />
                        <div
                            className="absolute cursor-col-resize h-full w-2 bg-white/30 right-0"
                            onMouseDown={(e) =>
                                handleMouseDown(e, 'resize-right')
                            }
                        />
                    </div>
                ) : (
                    <TimelineEventIcon
                        type={type}
                        selected={isSelected}
                        isBeingDragged={isBeingDragged}
                        position={time * zoom}
                        {...sharedMouseProps}
                    />
                )}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export default TimelineEvent;
