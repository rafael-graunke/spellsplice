import { useState } from 'react';
import {
    ChevronDownIcon,
    PlusIcon,
    RotateCcwIcon,
    Trash2Icon,
} from 'lucide-react';
import {
    defaultFieldMappings,
    defaultOffsetForAnchor,
    defaultScoreboardSvgSource,
    type SingleScoreboardConfig,
    type ScoreboardAnchor,
    type ScoreboardField,
    type ScoreboardFieldMapping,
} from '@/lib/liveMode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { usePersistedAccordion } from '@/hooks/usePersistedAccordion';
import { ScoreboardUpload } from '../ScoreboardUpload';
import AnchorField from './AnchorField';
import OffsetField from './OffsetField';

// Open by default (persisted per instance). 'advanced' starts collapsed.
const DEFAULT_OPEN_SECTIONS = ['design', 'position', 'sizing'];

interface Props {
    config: SingleScoreboardConfig;
    onChange: (next: SingleScoreboardConfig) => void;
    allowSidePicker: boolean;
    ownSide?: 'left' | 'right';
}

const FIELD_OPTIONS: { id: ScoreboardField; label: string }[] = [
    { id: 'name', label: 'Name' },
    { id: 'deckName', label: 'Deck Name' },
    { id: 'standing', label: 'Standing' },
    { id: 'pronouns', label: 'Pronouns' },
    { id: 'life', label: 'Life' },
    { id: 'wins', label: 'Wins' },
];

const SIDE_OPTIONS: { id: 'left' | 'right'; label: string }[] = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
];

interface FieldSelectProps<T extends string> {
    className?: string;
    value: T;
    options: { id: T; label: string }[];
    onChange: (value: T) => void;
}

function FieldSelect<T extends string>({
    className,
    value,
    options,
    onChange,
}: FieldSelectProps<T>) {
    const current = options.find((o) => o.id === value);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        'h-8 cursor-pointer justify-between font-normal',
                        className
                    )}
                >
                    {current?.label ?? value}
                    <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {options.map((option) => (
                    <DropdownMenuItem
                        key={option.id}
                        onSelect={() => onChange(option.id)}
                    >
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ScoreboardConfigEditor({
    config,
    onChange,
    allowSidePicker,
    ownSide,
}: Props) {
    const [openItems, setOpenItems] = usePersistedAccordion(
        `spellsplice-acc-scoreboard-${ownSide ?? 'shared'}`,
        DEFAULT_OPEN_SECTIONS
    );
    const [scaleText, setScaleText] = useState(() => String(config.scale));

    const clampScale = (value: number) => Math.max(10, Math.min(500, value));

    const handleScaleChange = (value: string) => {
        setScaleText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num))
            onChange({ ...config, scale: clampScale(num) });
    };
    const handleScaleBlur = () => {
        const num = Number(scaleText);
        const committed =
            scaleText !== '' && Number.isFinite(num)
                ? clampScale(num)
                : config.scale;
        setScaleText(String(committed));
        onChange({ ...config, scale: committed });
    };

    const handleAddMapping = () => {
        const mapping: ScoreboardFieldMapping = {
            id: '',
            field: 'life',
            side: ownSide ?? 'left',
        };
        onChange({
            ...config,
            fieldMappings: [...config.fieldMappings, mapping],
        });
    };

    const handleUpdateMapping = (
        index: number,
        patch: Partial<ScoreboardFieldMapping>
    ) => {
        const next = config.fieldMappings.map((m, i) =>
            i === index ? { ...m, ...patch } : m
        );
        onChange({ ...config, fieldMappings: next });
    };

    const handleRemoveMapping = (index: number) => {
        onChange({
            ...config,
            fieldMappings: config.fieldMappings.filter((_, i) => i !== index),
        });
    };

    const handleResetMappings = () => {
        onChange({
            ...config,
            fieldMappings: defaultFieldMappings(
                allowSidePicker ? 'shared' : (ownSide ?? 'left')
            ),
        });
    };

    return (
        <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="w-full rounded-md border"
        >
            <AccordionItem value="design">
                <AccordionTrigger className="px-4">Design</AccordionTrigger>
                <AccordionContent className="p-4">
                    <ScoreboardUpload
                        svg={config.svg}
                        onImport={(svg) => onChange({ ...config, svg })}
                        onRestoreDefault={() =>
                            onChange({
                                ...config,
                                svg: defaultScoreboardSvgSource(),
                            })
                        }
                    />
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="position">
                <AccordionTrigger className="px-4">Position</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">Anchor</span>
                            <AnchorField<ScoreboardAnchor>
                                value={config.anchor}
                                onChange={(anchor) =>
                                    onChange({
                                        ...config,
                                        anchor,
                                        offset: defaultOffsetForAnchor(anchor),
                                    })
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">
                                Offset (px)
                            </span>
                            <OffsetField
                                offset={config.offset}
                                onChange={(offset) =>
                                    onChange({ ...config, offset })
                                }
                                idPrefix={`scoreboard-offset-${ownSide ?? 'shared'}`}
                            />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sizing">
                <AccordionTrigger className="px-4">Sizing</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor={`scoreboard-scale-${ownSide ?? 'shared'}`}
                            className="text-sm font-medium"
                        >
                            Scale (%)
                        </label>
                        <Input
                            id={`scoreboard-scale-${ownSide ?? 'shared'}`}
                            type="number"
                            min={10}
                            max={500}
                            value={scaleText}
                            onChange={(e) => handleScaleChange(e.target.value)}
                            onBlur={handleScaleBlur}
                            className="w-28"
                        />
                    </div>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="advanced">
                <AccordionTrigger className="px-4">Advanced</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Field mappings
                            </span>
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
                            <p className="text-xs text-muted-foreground">
                                No mappings — SVG text stays static.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {config.fieldMappings.map((mapping, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-1.5"
                                    >
                                        <Input
                                            placeholder="SVG element id"
                                            value={mapping.id}
                                            onChange={(e) =>
                                                handleUpdateMapping(index, {
                                                    id: e.target.value,
                                                })
                                            }
                                            className="flex-1"
                                        />
                                        <FieldSelect
                                            className="w-28 shrink-0"
                                            value={mapping.field}
                                            options={FIELD_OPTIONS}
                                            onChange={(field) =>
                                                handleUpdateMapping(index, {
                                                    field,
                                                })
                                            }
                                        />
                                        {allowSidePicker && (
                                            <FieldSelect
                                                className="w-20 shrink-0"
                                                value={mapping.side}
                                                options={SIDE_OPTIONS}
                                                onChange={(side) =>
                                                    handleUpdateMapping(index, {
                                                        side,
                                                    })
                                                }
                                            />
                                        )}
                                        <Button
                                            type="button"
                                            size="icon-xs"
                                            variant="destructive"
                                            className="cursor-pointer shrink-0"
                                            onClick={() =>
                                                handleRemoveMapping(index)
                                            }
                                        >
                                            <Trash2Icon />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

export default ScoreboardConfigEditor;
