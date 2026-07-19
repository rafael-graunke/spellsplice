import { useState } from 'react';
import {
    defaultOffsetForAnchor,
    type SingleHandStackConfig,
    type HandStackGrowth,
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
                    {widthField}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="behaviour">
                <AccordionTrigger className="px-4">Behaviour</AccordionTrigger>
                <AccordionContent className="p-4">{growField}</AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

export default HandStackConfigEditor;
