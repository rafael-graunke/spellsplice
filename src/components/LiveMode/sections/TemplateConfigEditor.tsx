import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import {
    defaultFieldMappings,
    type SingleTemplateConfig,
    type TemplateAnchor,
    type TemplateField,
    type TemplateFieldMapping,
} from '@/lib/liveMode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TemplateUpload } from '../TemplateUpload';

interface Props {
    config: SingleTemplateConfig;
    onChange: (next: SingleTemplateConfig) => void;
    allowSidePicker: boolean;
    ownSide?: 'left' | 'right';
}

const ANCHOR_GRID: { id: TemplateAnchor; label: string }[][] = [
    [
        { id: 'top-left', label: 'Top Left' },
        { id: 'top-center', label: 'Top Center' },
        { id: 'top-right', label: 'Top Right' },
    ],
    [
        { id: 'bottom-left', label: 'Bottom Left' },
        { id: 'bottom-center', label: 'Bottom Center' },
        { id: 'bottom-right', label: 'Bottom Right' },
    ],
];

const FIELD_OPTIONS: { id: TemplateField; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'deckName', label: 'Deck Name' },
    { id: 'life', label: 'Life' },
    { id: 'wins', label: 'Wins' },
];

const SIDE_OPTIONS: { id: 'left' | 'right'; label: string }[] = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
];

const MARGIN_KEYS = ['top', 'right', 'bottom', 'left'] as const;

interface FieldSelectProps<T extends string> {
    className?: string;
    value: T;
    options: { id: T; label: string }[];
    onChange: (value: T) => void;
}

function FieldSelect<T extends string>({ className, value, options, onChange }: FieldSelectProps<T>) {
    const current = options.find((o) => o.id === value);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn('h-8 cursor-pointer justify-between font-normal', className)}
                >
                    {current?.label ?? value}
                    <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {options.map((option) => (
                    <DropdownMenuItem key={option.id} onSelect={() => onChange(option.id)}>
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function TemplateConfigEditor({ config, onChange, allowSidePicker, ownSide }: Props) {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [scaleText, setScaleText] = useState(() => String(config.scale));

    const clampScale = (value: number) => Math.max(10, Math.min(500, value));

    const handleScaleChange = (value: string) => {
        setScaleText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num)) onChange({ ...config, scale: clampScale(num) });
    };
    const handleScaleBlur = () => {
        const num = Number(scaleText);
        const committed = scaleText !== '' && Number.isFinite(num) ? clampScale(num) : config.scale;
        setScaleText(String(committed));
        onChange({ ...config, scale: committed });
    };

    const [marginText, setMarginText] = useState<Record<(typeof MARGIN_KEYS)[number], string>>(() =>
        Object.fromEntries(MARGIN_KEYS.map((k) => [k, String(config.margins[k])])) as Record<
            (typeof MARGIN_KEYS)[number],
            string
        >,
    );

    const handleMarginChange = (key: (typeof MARGIN_KEYS)[number], value: string) => {
        setMarginText((prev) => ({ ...prev, [key]: value }));
        const num = Number(value);
        if (value !== '' && Number.isFinite(num)) {
            onChange({ ...config, margins: { ...config.margins, [key]: Math.max(0, num) } });
        }
    };

    const handleMarginBlur = (key: (typeof MARGIN_KEYS)[number]) => {
        const num = Number(marginText[key]);
        const committed = marginText[key] !== '' && Number.isFinite(num) ? Math.max(0, num) : config.margins[key];
        setMarginText((prev) => ({ ...prev, [key]: String(committed) }));
        onChange({ ...config, margins: { ...config.margins, [key]: committed } });
    };

    const handleAddMapping = () => {
        const mapping: TemplateFieldMapping = { id: '', field: 'life', side: ownSide ?? 'left' };
        onChange({ ...config, fieldMappings: [...config.fieldMappings, mapping] });
    };

    const handleUpdateMapping = (index: number, patch: Partial<TemplateFieldMapping>) => {
        const next = config.fieldMappings.map((m, i) => (i === index ? { ...m, ...patch } : m));
        onChange({ ...config, fieldMappings: next });
    };

    const handleRemoveMapping = (index: number) => {
        onChange({ ...config, fieldMappings: config.fieldMappings.filter((_, i) => i !== index) });
    };

    const handleResetMappings = () => {
        onChange({ ...config, fieldMappings: defaultFieldMappings(allowSidePicker ? 'shared' : (ownSide ?? 'left')) });
    };

    return (
        <div className="flex flex-col gap-4">
            <TemplateUpload
                hasTemplate={config.svg !== null}
                onUpload={(svg) => onChange({ ...config, svg })}
                onClear={() => onChange({ ...config, svg: null })}
            />

            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Position</span>
                <div className="flex flex-col gap-1 w-fit">
                    {ANCHOR_GRID.map((row) => (
                        <div key={row[0].id} className="flex gap-1">
                            {row.map((option) => (
                                <Button
                                    key={option.id}
                                    type="button"
                                    size="sm"
                                    variant={config.anchor === option.id ? 'default' : 'outline'}
                                    className={cn(
                                        'cursor-pointer w-28',
                                        config.anchor === option.id && 'pointer-events-none',
                                    )}
                                    onClick={() => onChange({ ...config, anchor: option.id })}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor={`template-scale-${ownSide ?? 'shared'}`} className="text-sm font-medium">
                    Scale (%)
                </label>
                <Input
                    id={`template-scale-${ownSide ?? 'shared'}`}
                    type="number"
                    min={10}
                    max={500}
                    value={scaleText}
                    onChange={(e) => handleScaleChange(e.target.value)}
                    onBlur={handleScaleBlur}
                    className="w-28"
                />
                <p className="text-xs text-muted-foreground">Relative to the uploaded SVG's natural size.</p>
            </div>

            <div>
                <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="flex items-center gap-1 text-sm font-medium cursor-pointer"
                >
                    {advancedOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                    Advanced settings
                </button>

                {advancedOpen && (
                    <div className="flex flex-col gap-4 mt-3 pl-1">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">Margins (px)</span>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-fit">
                                {MARGIN_KEYS.map((key) => (
                                    <label key={key} className="flex items-center gap-1.5 text-sm">
                                        <span className="w-12 shrink-0 capitalize">{key}</span>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            value={marginText[key]}
                                            onChange={(e) => handleMarginChange(key, e.target.value)}
                                            onBlur={() => handleMarginBlur(key)}
                                            className="w-20"
                                        />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Field mappings</span>
                                <div className="flex gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="cursor-pointer"
                                        onClick={handleResetMappings}
                                    >
                                        <RotateCcwIcon />
                                        Reset default mappings
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="cursor-pointer"
                                        onClick={handleAddMapping}
                                    >
                                        <PlusIcon />
                                        Add
                                    </Button>
                                </div>
                            </div>
                            {config.fieldMappings.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No mappings — SVG text stays static.</p>
                            ) : (
                                <div className="flex flex-col gap-1.5">
                                    {config.fieldMappings.map((mapping, index) => (
                                        <div key={index} className="flex items-center gap-1.5">
                                            <Input
                                                placeholder="SVG element id"
                                                value={mapping.id}
                                                onChange={(e) => handleUpdateMapping(index, { id: e.target.value })}
                                                className="flex-1"
                                            />
                                            <FieldSelect
                                                className="w-28 shrink-0"
                                                value={mapping.field}
                                                options={FIELD_OPTIONS}
                                                onChange={(field) => handleUpdateMapping(index, { field })}
                                            />
                                            {allowSidePicker && (
                                                <FieldSelect
                                                    className="w-20 shrink-0"
                                                    value={mapping.side}
                                                    options={SIDE_OPTIONS}
                                                    onChange={(side) => handleUpdateMapping(index, { side })}
                                                />
                                            )}
                                            <Button
                                                type="button"
                                                size="icon-xs"
                                                variant="destructive"
                                                className="cursor-pointer shrink-0"
                                                onClick={() => handleRemoveMapping(index)}
                                            >
                                                <Trash2Icon />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TemplateConfigEditor;
