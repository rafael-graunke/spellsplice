import { useState } from 'react';
import type {
    SingleCardDisplayConfig,
    CardDisplayAnchor,
    CardDisplayAnimType,
    SlideDirection,
} from '@/lib/liveMode';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
    config: SingleCardDisplayConfig;
    onChange: (next: SingleCardDisplayConfig) => void;
    ownSide: 'left' | 'right';
}

const ANCHOR_GRID: { id: CardDisplayAnchor; label: string }[][] = [
    [
        { id: 'top-left', label: 'Top Left' },
        { id: 'top-center', label: 'Top Center' },
        { id: 'top-right', label: 'Top Right' },
    ],
    [
        { id: 'middle-left', label: 'Middle Left' },
        { id: 'middle-center', label: 'Middle Center' },
        { id: 'middle-right', label: 'Middle Right' },
    ],
    [
        { id: 'bottom-left', label: 'Bottom Left' },
        { id: 'bottom-center', label: 'Bottom Center' },
        { id: 'bottom-right', label: 'Bottom Right' },
    ],
];

const MARGIN_KEYS = ['top', 'right', 'bottom', 'left'] as const;

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

    const [marginText, setMarginText] = useState<
        Record<(typeof MARGIN_KEYS)[number], string>
    >(
        () =>
            Object.fromEntries(
                MARGIN_KEYS.map((k) => [k, String(config.margins[k])])
            ) as Record<(typeof MARGIN_KEYS)[number], string>
    );

    const handleMarginChange = (
        key: (typeof MARGIN_KEYS)[number],
        value: string
    ) => {
        setMarginText((prev) => ({ ...prev, [key]: value }));
        const num = Number(value);
        if (value !== '' && Number.isFinite(num)) {
            onChange({
                ...config,
                margins: { ...config.margins, [key]: Math.max(0, num) },
            });
        }
    };

    const handleMarginBlur = (key: (typeof MARGIN_KEYS)[number]) => {
        const num = Number(marginText[key]);
        const committed =
            marginText[key] !== '' && Number.isFinite(num)
                ? Math.max(0, num)
                : config.margins[key];
        setMarginText((prev) => ({ ...prev, [key]: String(committed) }));
        onChange({
            ...config,
            margins: { ...config.margins, [key]: committed },
        });
    };

    return (
        <div className="flex flex-col gap-4">
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
                                    variant={
                                        config.anchor === option.id
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className={cn(
                                        'cursor-pointer w-28',
                                        config.anchor === option.id &&
                                            'pointer-events-none'
                                    )}
                                    onClick={() =>
                                        onChange({
                                            ...config,
                                            anchor: option.id,
                                        })
                                    }
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Margins (px)</span>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 w-fit">
                    {MARGIN_KEYS.map((key) => (
                        <label
                            key={key}
                            className="flex items-center gap-1.5 text-sm"
                        >
                            <span className="w-12 shrink-0 capitalize">
                                {key}
                            </span>
                            <Input
                                id={`card-display-margin-${ownSide}-${key}`}
                                type="text"
                                inputMode="numeric"
                                value={marginText[key]}
                                onChange={(e) =>
                                    handleMarginChange(key, e.target.value)
                                }
                                onBlur={() => handleMarginBlur(key)}
                                className="w-20"
                            />
                        </label>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Offset from the anchored edge(s), in overlay pixels
                    (1920x1080).
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Animation</span>
                <div className="flex gap-1">
                    {ANIM_TYPE_OPTIONS.map((option) => (
                        <Button
                            key={option.id}
                            type="button"
                            size="sm"
                            variant={
                                animation.type === option.id
                                    ? 'default'
                                    : 'outline'
                            }
                            className={cn(
                                'cursor-pointer w-24',
                                animation.type === option.id &&
                                    'pointer-events-none'
                            )}
                            onClick={() =>
                                onChange({
                                    ...config,
                                    animation: {
                                        ...animation,
                                        type: option.id,
                                    },
                                })
                            }
                        >
                            {option.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <label
                    htmlFor={`card-display-anim-duration-${ownSide}`}
                    className="text-sm font-medium"
                >
                    Duration (ms)
                </label>
                <Input
                    id={`card-display-anim-duration-${ownSide}`}
                    type="number"
                    min={0}
                    max={5000}
                    value={durationText}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    onBlur={handleDurationBlur}
                    className="w-28"
                />
            </div>

            {animation.type === 'slide' && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Slide from</span>
                    <div className="flex gap-1">
                        {DIRECTION_OPTIONS.map((option) => (
                            <Button
                                key={option.id}
                                type="button"
                                size="sm"
                                variant={
                                    animation.direction === option.id
                                        ? 'default'
                                        : 'outline'
                                }
                                className={cn(
                                    'cursor-pointer w-20',
                                    animation.direction === option.id &&
                                        'pointer-events-none'
                                )}
                                onClick={() =>
                                    onChange({
                                        ...config,
                                        animation: {
                                            ...animation,
                                            direction: option.id,
                                        },
                                    })
                                }
                            >
                                {option.label}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Edge the card starts off of and slides in from (and
                        exits back to). Independent of the anchor.
                    </p>
                </div>
            )}
        </div>
    );
}

export default CardDisplayConfigEditor;
