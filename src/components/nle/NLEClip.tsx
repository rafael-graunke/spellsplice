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

interface NLEClipProps {
    clip: Clip;
    sourceName: string;
    zoom: number;
    isBeingDragged: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onDelete?: () => void;
}

export function NLEClip({ clip, sourceName, zoom, isBeingDragged, onMouseDown, onDelete }: NLEClipProps) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        'absolute cursor-grab active:cursor-grabbing overflow-hidden h-[calc(100%-6px)] top-1/2 -translate-y-1/2 rounded-sm select-none',
                        ClipColorMap[clip.type],
                        isBeingDragged && 'opacity-0',
                    )}
                    style={{ left: clip.time * zoom, width: clip.duration * zoom }}
                    onMouseDown={onMouseDown}
                >
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-white/90 truncate pointer-events-none">
                        {sourceName}
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
