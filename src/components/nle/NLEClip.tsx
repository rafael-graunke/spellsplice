import React from 'react';
import { cn } from '@/lib/utils';
import { ClipColorMap } from '../types/clip';
import type { Clip } from '../types/clip';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '../ui/context-menu';

const CLICK_THRESHOLD = 4;

interface NLEClipProps {
    clip: Clip;
    sourceName: string;
    sourceMissing?: boolean;
    zoom: number;
    isSelected: boolean;
    isBeingDragged: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onSelect?: (additive: boolean) => void;
    onDelete?: () => void;
}

export function NLEClip({ clip, sourceName, sourceMissing, zoom, isSelected, isBeingDragged, onMouseDown, onSelect, onDelete }: NLEClipProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        'absolute cursor-grab active:cursor-grabbing overflow-hidden h-[calc(100%-6px)] top-1/2 -translate-y-1/2 rounded-sm select-none',
                        sourceMissing
                            ? 'bg-red-950/80 border border-red-500'
                            : ClipColorMap[clip.type],
                        isBeingDragged && 'opacity-0',
                        isSelected && (sourceMissing ? 'ring-2 ring-red-400 ring-inset' : 'ring-2 ring-white ring-inset'),
                    )}
                    style={{ left: clip.time * zoom, width: clip.duration * zoom }}
                    onMouseDown={(e) => {
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const handleUp = (ev: MouseEvent) => {
                            window.removeEventListener('mouseup', handleUp);
                            if (Math.abs(ev.clientX - startX) < CLICK_THRESHOLD && Math.abs(ev.clientY - startY) < CLICK_THRESHOLD) {
                                onSelect?.(ev.ctrlKey || ev.metaKey);
                            }
                        };
                        window.addEventListener('mouseup', handleUp);
                        onMouseDown(e);
                    }}
                >
                    <span className={cn(
                        'absolute inset-0 flex items-center px-2 text-xs truncate pointer-events-none',
                        sourceMissing ? 'text-red-300' : 'text-white/90',
                    )}>
                        {sourceMissing ? 'Source for clip not found. Please relink the source.' : sourceName}
                    </span>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                >
                    Delete clip
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
