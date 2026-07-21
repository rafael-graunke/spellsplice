import { useState } from 'react';
import {
    defaultOffsetForAnchor,
    type SingleHandStackConfig,
    type HandStackGrowth,
    type HandStackInsert,
} from '@/lib/liveMode';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { usePersistedAccordion } from '@/hooks/usePersistedAccordion';
import InfoHint from './InfoHint';
import AnchorField from './AnchorField';
import OffsetField from './OffsetField';

const ACCORDION_ITEMS = ['position', 'sizing', 'behaviour'];

interface Props {
    config: SingleHandStackConfig;
    onChange: (next: SingleHandStackConfig) => void;
    ownSide: 'left' | 'right';
}

const GROWTH_OPTIONS: { id: HandStackGrowth; label: string }[] = [
    { id: 'top-down', label: 'Top-down' },
    { id: 'bottom-up', label: 'Bottom-up' },
    { id: 'center', label: 'Center' },
];

const INSERT_OPTIONS: { id: HandStackInsert; label: string }[] = [
    { id: 'append', label: 'Append' },
    { id: 'prepend', label: 'Prepend' },
];

function HandStackConfigEditor({ config, onChange, ownSide }: Props) {
    const [openItems, setOpenItems] = usePersistedAccordion(
        `spellsplice-acc-handstack-${ownSide}`,
        ACCORDION_ITEMS
    );

    const clampWidth = (value: number) => Math.max(100, Math.min(1000, value));

    const [widthText, setWidthText] = useState(() =>
        String(config.cardStripWidth)
    );

    const handleWidthChange = (value: string) => {
        setWidthText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num))
            onChange({ ...config, cardStripWidth: clampWidth(num) });
    };

    const handleWidthBlur = () => {
        const num = Number(widthText);
        const committed =
            widthText !== '' && Number.isFinite(num)
                ? clampWidth(num)
                : config.cardStripWidth;
        setWidthText(String(committed));
        onChange({ ...config, cardStripWidth: committed });
    };

    const clampMaxHeight = (value: number) =>
        Math.max(0, Math.min(2000, Math.round(value)));

    const [maxHeightText, setMaxHeightText] = useState(() =>
        String(config.maxHeight ?? 0)
    );

    const handleMaxHeightChange = (value: string) => {
        setMaxHeightText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num))
            onChange({ ...config, maxHeight: clampMaxHeight(num) });
    };

    const handleMaxHeightBlur = () => {
        const num = Number(maxHeightText);
        const committed =
            maxHeightText !== '' && Number.isFinite(num)
                ? clampMaxHeight(num)
                : (config.maxHeight ?? 0);
        setMaxHeightText(String(committed));
        onChange({ ...config, maxHeight: committed });
    };

    const growField = (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium flex items-center gap-1.5">
                Grow
                <InfoHint>
                    Direction the stack extends from its anchored point as cards
                    are added.
                </InfoHint>
            </span>
            <Select
                value={config.growth}
                onValueChange={(value) =>
                    onChange({ ...config, growth: value as HandStackGrowth })
                }
            >
                <SelectTrigger className="w-44">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {GROWTH_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    const insertField = (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium flex items-center gap-1.5">
                New card
                <InfoHint>
                    Where a newly added card lands: append to the end of the
                    stack, or prepend to the anchor end.
                </InfoHint>
            </span>
            <Select
                value={config.insert ?? 'append'}
                onValueChange={(value) =>
                    onChange({ ...config, insert: value as HandStackInsert })
                }
            >
                <SelectTrigger className="w-44">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {INSERT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    const widthField = (
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={`hand-stack-width-${ownSide}`}
                className="text-sm font-medium"
            >
                Card strip width (px)
            </label>
            <Input
                id={`hand-stack-width-${ownSide}`}
                type="number"
                min={100}
                max={1000}
                value={widthText}
                onChange={(e) => handleWidthChange(e.target.value)}
                onBlur={handleWidthBlur}
                className="w-28"
            />
        </div>
    );

    const maxHeightField = (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium flex items-center gap-1.5">
                Max height (px)
                <InfoHint>
                    Cap the stack height. Cards nearest the anchor stay; the
                    rest collapse into a “+N” pill at the growth edge. 0 =
                    unlimited.
                </InfoHint>
            </span>
            <Input
                id={`hand-stack-max-height-${ownSide}`}
                type="number"
                min={0}
                max={2000}
                value={maxHeightText}
                onChange={(e) => handleMaxHeightChange(e.target.value)}
                onBlur={handleMaxHeightBlur}
                className="w-28"
            />
        </div>
    );

    return (
        <Accordion
            type="multiple"
            value={openItems}
            onValueChange={setOpenItems}
            className="w-full rounded-md border"
        >
            <AccordionItem value="position">
                <AccordionTrigger className="px-4">Position</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium">Anchor</span>
                            <AnchorField
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
                                idPrefix={`hand-stack-offset-${ownSide}`}
                            />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="sizing">
                <AccordionTrigger className="px-4">Sizing</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                        {widthField}
                        {maxHeightField}
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="behaviour">
                <AccordionTrigger className="px-4">Behaviour</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                        {growField}
                        {insertField}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

export default HandStackConfigEditor;
