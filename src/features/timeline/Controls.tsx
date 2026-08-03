import React, { useState } from 'react';
import { Bookmark, LocateFixed, Magnet, MousePointer2, Scissors, SquareSplitHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '../../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import type { ViewMode } from './Timeline';
import { TimelineTool } from './types';

interface ZoomControlsProps {
    zoom: number;
    onZoomChange: (zoom: number) => void;
}

function ZoomControls({ zoom, onZoomChange }: ZoomControlsProps) {
    // Draft lets the field sit empty mid-retype without committing NaN, which
    // would poison zoomRef and freeze the timeline.
    const [draft, setDraft] = useState<string | null>(null);

    const commit = (text: string) => {
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n)) onZoomChange(n);
    };

    return (
        <div className="flex flex-row gap-2 items-center">
            <Slider
                max={100}
                step={1}
                className="w-24"
                value={[zoom]}
                onValueChange={(value) => {
                    setDraft(null);
                    onZoomChange(value[0]);
                }}
            />
            <div className="flex flex-row items-center gap-0.5 text-xs text-muted-foreground">
                <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Timeline zoom"
                    className="w-6 bg-transparent text-right tabular-nums outline-none"
                    value={draft ?? String(Math.round(zoom))}
                    onChange={(e) => commit(e.target.value)}
                    onBlur={() => setDraft(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />
                <span>%</span>
            </div>
        </div>
    );
}


interface BarButtonProps {
    active?: boolean;
    label: string;
    shortcut?: string;
    /** Radio semantics for the mutually exclusive tools; toggles use aria-pressed. */
    radio?: boolean;
    /**
     * One-shot command. Gets momentary press feedback rather than a persistent
     * fill, which is exactly the difference between an action and a mode: an
     * action has no "on" state to render.
     */
    action?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}

function BarButton({ active, label, shortcut, radio, action, onClick, children }: BarButtonProps) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        role={radio ? 'radio' : undefined}
                        aria-label={label}
                        aria-checked={radio ? active : undefined}
                        aria-pressed={radio || action ? undefined : active}
                        // Blurred so the single-letter shortcuts keep working:
                        // isTypingTarget treats a focused button as a typing
                        // target, which would otherwise swallow V/C/S/B.
                        onClick={(e) => { e.currentTarget.blur(); onClick(); }}
                        className={cn(
                            'rounded p-1 transition-colors',
                            action
                                ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700'
                                : active
                                    ? 'bg-zinc-700 text-zinc-100'
                                    : 'text-zinc-500 hover:text-zinc-300',
                        )}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                    {label}
                    {shortcut && <span className="ml-2 text-muted-foreground">{shortcut}</span>}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

interface ControlsProps extends ZoomControlsProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    snapEnabled: boolean;
    onToggleSnap: () => void;
    followPlayhead: boolean;
    onToggleFollow: () => void;
    tool: TimelineTool;
    onToolChange: (tool: TimelineTool) => void;
    onBlade: () => void;
    onAddMarker: () => void;
}

function Controls({
    zoom,
    onZoomChange,
    viewMode,
    setViewMode,
    snapEnabled,
    onToggleSnap,
    followPlayhead,
    onToggleFollow,
    tool,
    onToolChange,
    onBlade,
    onAddMarker,
}: ControlsProps) {
    return (
        <div className="border-b w-full flex flex-row justify-between items-center gap-4 py-1 px-4">
            <div className="flex flex-row items-center gap-3">
                {/* Modes: exactly one active, and they change what dragging means. */}
                <div role="radiogroup" aria-label="Timeline tool" className="flex flex-row items-center gap-1">
                    <BarButton
                        radio
                        active={tool === TimelineTool.Select}
                        label="Selection tool"
                        shortcut="V"
                        onClick={() => onToolChange(TimelineTool.Select)}
                    >
                        <MousePointer2 className="size-4" />
                    </BarButton>
                    <BarButton
                        radio
                        active={tool === TimelineTool.Razor}
                        label="Razor tool"
                        shortcut="C"
                        onClick={() => onToolChange(TimelineTool.Razor)}
                    >
                        <Scissors className="size-4" />
                    </BarButton>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                {/* Toggles: independent, and modify how the modes behave. */}
                <div className="flex flex-row items-center gap-1">
                    <BarButton active={snapEnabled} label="Snapping" shortcut="S" onClick={onToggleSnap}>
                        <Magnet className="size-4" />
                    </BarButton>
                    <BarButton active={followPlayhead} label="Follow playhead" onClick={onToggleFollow}>
                        <LocateFixed className="size-4" />
                    </BarButton>
                </div>
                <div className="h-4 w-px bg-zinc-700" />
                {/* Actions: fire once, no state. Membership rule is strictly
                    "frequent and otherwise undiscoverable" — everything rarer
                    stays in the context menus, or this becomes a junk drawer. */}
                <div className="flex flex-row items-center gap-1">
                    <BarButton action label="Split at playhead" shortcut="B" onClick={onBlade}>
                        <SquareSplitHorizontal className="size-4" />
                    </BarButton>
                    <BarButton action label="Add marker" shortcut="M" onClick={onAddMarker}>
                        <Bookmark className="size-4" />
                    </BarButton>
                </div>
            </div>
            <div className="flex flex-row items-center gap-4">
            <div id="timeline-view">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                    <SelectTrigger size="sm" className="w-40" aria-label="Timeline view">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="full">Full View</SelectItem>
                        <SelectItem value="event">Event Editing</SelectItem>
                        <SelectItem value="video">Video Editing</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <ZoomControls zoom={zoom} onZoomChange={onZoomChange} />
            </div>
        </div>
    );
}

export default React.memo(Controls);
