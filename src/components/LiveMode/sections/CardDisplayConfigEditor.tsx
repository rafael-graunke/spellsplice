import { useState } from 'react';
import {
    defaultOffsetForAnchor,
    type SingleCardDisplayConfig,
    type CardDisplayAnimType,
    type SlideDirection,
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

const ACCORDION_ITEMS = ['position', 'behaviour'];

interface Props {
    config: SingleCardDisplayConfig;
    onChange: (next: SingleCardDisplayConfig) => void;
    ownSide: 'left' | 'right';
}

const ANIM_TYPE_OPTIONS: { id: CardDisplayAnimType; label: string }[] = [
    { id: 'fade', label: 'Fade' },
    { id: 'slide', label: 'Slide' },
];

const DIRECTION_OPTIONS: { id: SlideDirection; label: string }[] = [
    { id: 'left', label: 'Left' },
    { id: 'right', label: 'Right' },
    { id: 'top', label: 'Top' },
    { id: 'bottom', label: 'Bottom' },
];

function CardDisplayConfigEditor({ config, onChange, ownSide }: Props) {
    const [openItems, setOpenItems] = usePersistedAccordion(
        `spellsplice-acc-carddisplay-${ownSide}`,
        ACCORDION_ITEMS
    );
    const { animation } = config;
    const [durationText, setDurationText] = useState(() =>
        String(animation.duration)
    );

    const clampDuration = (ms: number) => Math.max(0, Math.min(5000, ms));

    const handleDurationChange = (value: string) => {
        setDurationText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num))
            onChange({
                ...config,
                animation: { ...animation, duration: clampDuration(num) },
            });
    };

    const handleDurationBlur = () => {
        const num = Number(durationText);
        const committed =
            durationText !== '' && Number.isFinite(num)
                ? clampDuration(num)
                : animation.duration;
        setDurationText(String(committed));
        onChange({
            ...config,
            animation: { ...animation, duration: committed },
        });
    };

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
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
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
                                idPrefix={`card-display-offset-${ownSide}`}
                            />
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="behaviour">
                <AccordionTrigger className="px-4">Behaviour</AccordionTrigger>
                <AccordionContent className="p-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium shrink-0">
                                Animation
                            </span>
                            <Select
                                value={animation.type}
                                onValueChange={(value) =>
                                    onChange({
                                        ...config,
                                        animation: {
                                            ...animation,
                                            type: value as CardDisplayAnimType,
                                        },
                                    })
                                }
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ANIM_TYPE_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={option.id}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <label
                                htmlFor={`card-display-anim-duration-${ownSide}`}
                                className="text-sm font-medium shrink-0"
                            >
                                Duration (ms)
                            </label>
                            <Input
                                id={`card-display-anim-duration-${ownSide}`}
                                type="number"
                                min={0}
                                max={5000}
                                value={durationText}
                                onChange={(e) =>
                                    handleDurationChange(e.target.value)
                                }
                                onBlur={handleDurationBlur}
                                className="flex-1"
                            />
                        </div>

                        {animation.type === 'slide' && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium shrink-0">
                                    Slide from
                                </span>
                                <Select
                                    value={animation.direction}
                                    onValueChange={(value) =>
                                        onChange({
                                            ...config,
                                            animation: {
                                                ...animation,
                                                direction:
                                                    value as SlideDirection,
                                            },
                                        })
                                    }
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {DIRECTION_OPTIONS.map((option) => (
                                            <SelectItem
                                                key={option.id}
                                                value={option.id}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <InfoHint>
                                    Edge the card starts off of and slides in
                                    from (and exits back to). Independent of the
                                    anchor.
                                </InfoHint>
                            </div>
                        )}
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

export default CardDisplayConfigEditor;
