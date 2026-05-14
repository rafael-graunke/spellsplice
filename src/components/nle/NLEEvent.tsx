import React, { useEffect, useRef } from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import NLEEventIcon from './NLEEventIcon';
import { NLEEventResizable } from './NLEEventResizable';
import type { TrackEvent } from '../types/event';
import { EventColorMap } from '../types/event';
import { modKey } from '@/lib/platform';

export interface NLEEventProps {
    event: TrackEvent;
    zoom: number;
    isSelected: boolean;
    isBeingDragged: boolean;
    onSelect: (additive: boolean) => void;
    onMoveStart: (e: React.MouseEvent, time: number, duration: number) => void;
    onUpdate: (time: number, duration: number) => void;
    onDelete?: () => void;
    onDeleteSelected?: () => void;
    onCopy?: () => void;
    onDuplicate?: () => void;
    onResizeStart?: () => void;
    onResizeEnd?: () => void;
}

type DragMode = 'resize-left' | 'resize-right';

function NLEEvent({
    event,
    zoom,
    isSelected,
    isBeingDragged,
    onSelect,
    onMoveStart,
    onUpdate,
    onDelete,
    onDeleteSelected,
    onCopy,
    onDuplicate,
    onResizeStart,
    onResizeEnd,
}: NLEEventProps) {
    const { time, duration, type, resizable } = event;
    const color = EventColorMap[type].bg;

    const dragRef = useRef<{
        mode: DragMode;
        startX: number;
        startTime: number;
        startDuration: number;
    } | null>(null);
    const hasDragged = useRef(false);

    const handleMouseDown = (e: React.MouseEvent, mode: 'move' | DragMode) => {
        if (e.button !== 0) return; // ignore right-click; context menu handled via contextmenu event
        e.preventDefault();
        e.stopPropagation();
        hasDragged.current = false;

        if (mode === 'move') {
            onMoveStart(e, time, duration ?? 0);
            const startX = e.clientX, startY = e.clientY;
            const trackMove = (mv: MouseEvent) => {
                if (Math.abs(mv.clientX - startX) > 3 || Math.abs(mv.clientY - startY) > 3) {
                    hasDragged.current = true;
                    if (!isSelected) onSelect(false); // exclusive-select only when drag confirmed
                    window.removeEventListener('mousemove', trackMove);
                }
            };
            const cleanup = () => {
                window.removeEventListener('mousemove', trackMove);
                window.removeEventListener('mouseup', cleanup);
            };
            window.addEventListener('mousemove', trackMove);
            window.addEventListener('mouseup', cleanup);
            return;
        }

        if (!resizable) return;
        onResizeStart?.();
        dragRef.current = {
            mode,
            startX: e.clientX,
            startTime: time,
            startDuration: duration ?? 0,
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
                const newDuration = Math.max(0.1, startDuration - (newTime - startTime));
                onUpdate(newTime, newDuration);
            } else if (mode === 'resize-right') {
                onUpdate(startTime, Math.max(0.1, startDuration + deltaTime));
            }
        };

        const onMouseUp = () => {
            if (dragRef.current && hasDragged.current) onResizeEnd?.();
            dragRef.current = null;
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [zoom, onUpdate, onResizeEnd]);

    const sharedMouseProps = {
        onMouseDown: (e: React.MouseEvent) => handleMouseDown(e, 'move'),
        onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!hasDragged.current) onSelect(e.ctrlKey || e.metaKey);
        },
    };

    return (
        <ContextMenu onOpenChange={(open) => { if (open && !isSelected) onSelect(false); }}>
            <ContextMenuTrigger className="contents">
                {resizable ? (
                    <NLEEventResizable
                        type={type}
                        time={time}
                        duration={duration ?? 1}
                        zoom={zoom}
                        color={color}
                        isSelected={isSelected}
                        isBeingDragged={isBeingDragged}
                        onMouseDown={sharedMouseProps.onMouseDown}
                        onClick={sharedMouseProps.onClick}
                        onResizeLeftDown={(e) => handleMouseDown(e, 'resize-left')}
                        onResizeRightDown={(e) => handleMouseDown(e, 'resize-right')}
                        data-testid={`nle-event-${event.id}`}
                    />
                ) : (
                    <NLEEventIcon
                        type={type}
                        selected={isSelected}
                        isBeingDragged={isBeingDragged}
                        position={time * zoom}
                        data-testid={`nle-event-${event.id}`}
                        {...sharedMouseProps}
                    />
                )}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={onCopy}>
                    Copy
                    <ContextMenuShortcut>{modKey}+C</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={onDuplicate}>Duplicate</ContextMenuItem>
                <ContextMenuItem variant="destructive" onClick={onDeleteSelected ?? onDelete}>
                    Delete
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export default React.memo(NLEEvent, (prev, next) =>
    prev.event === next.event &&
    prev.zoom === next.zoom &&
    prev.isSelected === next.isSelected &&
    prev.isBeingDragged === next.isBeingDragged,
);
