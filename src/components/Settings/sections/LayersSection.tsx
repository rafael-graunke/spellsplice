import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DownloadIcon, GripVertical, UploadIcon } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    buildOverlayPreset,
    configMatchesPreset,
    loadOverlayPresets,
    LIVE_LAYER_LABELS,
    type LiveLayerId,
    type LiveOverlayPreset,
} from '@/lib/liveMode';
import type { ProjectConfig, TimelineLayer, TimelineLayerId } from '@/components/types/config';
import { cn } from '@/lib/utils';
import InfoHint from '@/components/LiveMode/sections/InfoHint';

interface Props {
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

// Sentinel Select value for "the current config matches no known preset".
const CUSTOM_VALUE = '__custom__';

const labelFor = (id: TimelineLayerId) => (id === 'video' ? 'Video' : LIVE_LAYER_LABELS[id]);

function SortableLayerRow({
    layer,
    onToggle,
}: {
    layer: TimelineLayer;
    onToggle: (id: TimelineLayerId) => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: layer.id,
    });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm outline-none',
                isDragging && 'relative z-10',
            )}
        >
            <GripVertical
                className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                {...listeners}
            />
            <span className="flex-1">{labelFor(layer.id)}</span>
            <Checkbox
                checked={layer.visible}
                onCheckedChange={() => onToggle(layer.id)}
                aria-label={`Toggle ${labelFor(layer.id)}`}
            />
        </div>
    );
}

function downloadPreset(preset: LiveOverlayPreset) {
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'overlay'}-preset.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function LayersSection({ config, onConfigChange }: Props) {
    const sensors = useSensors(useSensor(PointerSensor));

    // The overlay paint order (bottom -> top), without the base video layer, as
    // Live Mode presets store it.
    const overlayOrder = config.layers.filter((l) => l.id !== 'video').map((l) => l.id) as LiveLayerId[];

    // Stored bottom -> top; the list shows top -> bottom (top row = topmost).
    const displayOrder = [...config.layers].reverse();

    const handleDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = displayOrder.findIndex((l) => l.id === active.id);
        const to = displayOrder.findIndex((l) => l.id === over.id);
        if (from === -1 || to === -1) return;
        const nextDisplay = arrayMove(displayOrder, from, to);
        onConfigChange({ ...config, layers: [...nextDisplay].reverse() });
    };

    const toggle = (id: TimelineLayerId) =>
        onConfigChange({
            ...config,
            layers: config.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
        });

    // Merge a preset's overlay order (LiveLayerId[], no video) into the timeline
    // layers, keeping the video layer at the bottom and preserving visibility.
    const applyPreset = (preset: LiveOverlayPreset) => {
        const video = config.layers.find((l) => l.id === 'video') ?? { id: 'video' as const, visible: true };
        const visById = new Map(config.layers.map((l) => [l.id, l.visible]));
        const overlay: TimelineLayer[] = preset.layerOrder.map((id) => ({ id, visible: visById.get(id) ?? true }));
        onConfigChange({
            ...config,
            scoreboard: preset.scoreboard,
            handStack: preset.handStack,
            cardDisplay: preset.cardDisplay,
            cardDisplayDuration: preset.cardDisplayDuration,
            annotationConfig: preset.annotations,
            layers: [video, ...overlay],
        });
    };

    // Presets served from public/presets (built-in Spellsplice on failure).
    const [presets, setPresets] = useState<LiveOverlayPreset[]>([]);
    useEffect(() => {
        let active = true;
        loadOverlayPresets().then((manifest) => {
            if (active) setPresets(manifest.presets);
        });
        return () => {
            active = false;
        };
    }, []);

    const matched = presets.find((p) =>
        configMatchesPreset(
            p,
            config.scoreboard,
            config.handStack,
            config.cardDisplay,
            config.cardDisplayDuration,
            config.annotationConfig,
            overlayOrder,
        ),
    );
    const presetValue = matched?.name ?? CUSTOM_VALUE;
    const handlePresetChange = (value: string) => {
        const preset = presets.find((p) => p.name === value);
        if (preset) applyPreset(preset);
    };

    const importInputRef = useRef<HTMLInputElement>(null);
    const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const preset = JSON.parse(await file.text()) as LiveOverlayPreset;
            if (preset?.scoreboard && preset.handStack && preset.cardDisplay) applyPreset(preset);
        } catch {
            /* ignore malformed preset file */
        }
    };

    const [exportOpen, setExportOpen] = useState(false);
    const [exportName, setExportName] = useState('');
    const openExport = () => {
        setExportName(matched?.name ?? (config.title || 'My Overlay'));
        setExportOpen(true);
    };
    const confirmExport = () => {
        const name = exportName.trim() || 'Overlay';
        downloadPreset(
            buildOverlayPreset(
                name,
                config.scoreboard,
                config.handStack,
                config.cardDisplay,
                config.cardDisplayDuration,
                config.annotationConfig,
                overlayOrder,
            ),
        );
        setExportOpen(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-4">General</h2>
                <div className="grid grid-cols-2 items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-3">
                        <label htmlFor="overlay-preset" className="text-sm font-medium shrink-0">
                            Preset
                        </label>
                        <Select value={presetValue} onValueChange={handlePresetChange}>
                            <SelectTrigger id="overlay-preset" className="flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {presets.map((p) => (
                                    <SelectItem key={p.name} value={p.name}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                                {!matched && <SelectItem value={CUSTOM_VALUE}>Custom</SelectItem>}
                            </SelectContent>
                        </Select>
                        <InfoHint className="size-4">
                            A preset bundles every overlay appearance setting. Editing any of them
                            switches this to Custom.
                        </InfoHint>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="outline" onClick={openExport}>
                            <DownloadIcon className="size-4" />
                            Export
                        </Button>
                        <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>
                            <UploadIcon className="size-4" />
                            Import
                        </Button>
                        <input
                            ref={importInputRef}
                            type="file"
                            accept="application/json,.json"
                            className="hidden"
                            onChange={handleImport}
                        />
                    </div>
                </div>
            </div>

            <div>
                <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-sm font-medium">Layers</h3>
                    <InfoHint className="size-4">
                        Drag to restack the overlay (top of the list draws on top). Uncheck to hide a
                        layer. Video is the base frame.
                    </InfoHint>
                </div>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={displayOrder.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-1.5">
                            {displayOrder.map((layer) => (
                                <SortableLayerRow key={layer.id} layer={layer} onToggle={toggle} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Export preset</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="preset-name" className="text-sm font-medium">
                            Name
                        </label>
                        <Input
                            id="preset-name"
                            value={exportName}
                            onChange={(e) => setExportName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmExport();
                            }}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExportOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmExport}>Export</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default LayersSection;
