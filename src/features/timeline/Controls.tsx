import React, { useState } from 'react';
import { Slider } from '../../components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { ViewMode } from './Timeline';

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


interface ControlsProps extends ZoomControlsProps {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
}

function Controls({
    zoom,
    onZoomChange,
    viewMode,
    setViewMode,
}: ControlsProps) {
    return (
        <div className="border-b w-full flex flex-row justify-end items-center gap-4 py-1 px-4">
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
    );
}

export default React.memo(Controls);
