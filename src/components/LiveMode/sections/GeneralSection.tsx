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
import {
    restrictToVerticalAxis,
    restrictToParentElement,
} from '@dnd-kit/modifiers';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    type LiveCardDisplayConfig,
    type LiveHandStackConfig,
    type LiveLayerId,
    type LiveOverlayPreset,
    type LiveScoreboardState,
} from '@/lib/liveMode';
import { cn } from '@/lib/utils';
import InfoHint from './InfoHint';

// Sentinel Select value for "the current config matches no known preset".
const CUSTOM_VALUE = '__custom__';

interface Props {
    scoreboard: LiveScoreboardState;
    handStack: LiveHandStackConfig;
    cardDisplay: LiveCardDisplayConfig;
    cardDisplayDuration: number;
    // Overlay paint order, bottom -> top (index 0 drawn first).
    layerOrder: LiveLayerId[];
    onLayerOrderChange: (order: LiveLayerId[]) => void;
    // Applies a whole preset at once (scoreboard + hand stack + card display +
    // duration). Called when the user picks a preset.
    onApplyPreset: (preset: LiveOverlayPreset) => void;
}

// One draggable row in the Layers list.
function SortableLayerItem({ id }: { id: LiveLayerId }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm outline-none',
                isDragging && 'relative z-10'
            )}
        >
            <GripVertical
                className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                {...listeners}
            />
            {LIVE_LAYER_LABELS[id]}
        </div>
    );
}

// Serializes `preset` to a downloaded JSON file. SVGs ride along inside the
// scoreboard config, so the export is fully self-contained.
function downloadPreset(preset: LiveOverlayPreset) {
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const slug = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'overlay'}-preset.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function GeneralSection({
    scoreboard,
    handStack,
    cardDisplay,
    cardDisplayDuration,
    layerOrder,
    onLayerOrderChange,
    onApplyPreset,
}: Props) {
    const sensors = useSensors(useSensor(PointerSensor));

    // The list is shown top -> bottom (top row = topmost layer), while the
    // stored order is bottom -> top, so display is the reversed array and any
    // reorder is reversed back before saving.
    const displayOrder = [...layerOrder].reverse();
    const handleLayerDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const from = displayOrder.indexOf(active.id as LiveLayerId);
        const to = displayOrder.indexOf(over.id as LiveLayerId);
        if (from < 0 || to < 0) return;
        const nextDisplay = arrayMove(displayOrder, from, to);
        onLayerOrderChange([...nextDisplay].reverse());
    };

    // Presets served from public/presets.json (built-in Spellsplice on failure).
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

    // The preset whose configs match the live ones, if any (drives the label).
    const matched = presets.find((p) =>
        configMatchesPreset(
            p,
            scoreboard,
            handStack,
            cardDisplay,
            cardDisplayDuration
        )
    );
    const presetValue = matched?.name ?? CUSTOM_VALUE;

    const handlePresetChange = (value: string) => {
        // CUSTOM_VALUE is descriptive only (what you get after editing) -
        // nothing to apply. Only named presets load a config.
        const preset = presets.find((p) => p.name === value);
        if (preset) onApplyPreset(preset);
    };

    const importInputRef = useRef<HTMLInputElement>(null);

    const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const preset = JSON.parse(await file.text()) as LiveOverlayPreset;
            if (preset?.scoreboard && preset.handStack && preset.cardDisplay) {
                onApplyPreset(preset);
            }
        } catch {
            /* ignore malformed preset file */
        }
    };

    // Export prompts for a name first, seeded with the matched preset's name (or
    // a generic default) so the exported file has a meaningful label.
    const [exportOpen, setExportOpen] = useState(false);
    const [exportName, setExportName] = useState('');

    const openExport = () => {
        setExportName(matched?.name ?? 'My Overlay');
        setExportOpen(true);
    };

    const confirmExport = () => {
        const name = exportName.trim() || 'Overlay';
        downloadPreset(
            buildOverlayPreset(
                name,
                scoreboard,
                handStack,
                cardDisplay,
                cardDisplayDuration
            )
        );
        setExportOpen(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-lg font-semibold mb-4">General</h2>
                <div className="grid grid-cols-2 items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-3">
                        <label
                            htmlFor="overlay-preset"
                            className="text-sm font-medium shrink-0"
                        >
                            Preset
                        </label>
                        <Select
                            value={presetValue}
                            onValueChange={handlePresetChange}
                        >
                            <SelectTrigger
                                id="overlay-preset"
                                className="flex-1"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {presets.map((p) => (
                                    <SelectItem key={p.name} value={p.name}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                                {!matched && (
                                    <SelectItem value={CUSTOM_VALUE}>
                                        Custom
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                        <InfoHint className="size-4">
                            A preset bundles every overlay appearance setting.
                            Editing any of them switches this to Custom.
                        </InfoHint>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openExport}
                        >
                            <DownloadIcon className="size-4" />
                            Export
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => importInputRef.current?.click()}
                        >
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
                        Drag to restack the overlay. The top of the list is
                        drawn on top of everything below it.
                    </InfoHint>
                </div>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[
                        restrictToVerticalAxis,
                        restrictToParentElement,
                    ]}
                    onDragEnd={handleLayerDragEnd}
                >
                    <SortableContext
                        items={displayOrder}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="flex flex-col gap-1.5">
                            {displayOrder.map((id) => (
                                <SortableLayerItem key={id} id={id} />
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
                        <label
                            htmlFor="export-preset-name"
                            className="text-sm font-medium"
                        >
                            Preset name
                        </label>
                        <Input
                            id="export-preset-name"
                            value={exportName}
                            autoFocus
                            onChange={(e) => setExportName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmExport();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setExportOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmExport}>
                            <DownloadIcon className="size-4" />
                            Export
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default GeneralSection;
