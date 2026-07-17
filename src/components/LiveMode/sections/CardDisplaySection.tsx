import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { LiveCardDisplayConfig } from '@/lib/liveMode';
import CardDisplayConfigEditor from './CardDisplayConfigEditor';

interface Props {
    cardDisplayDuration: number;
    onCardDisplayDurationChange: (value: number) => void;
    cardDisplayConfig: LiveCardDisplayConfig;
    onCardDisplayConfigChange: (next: LiveCardDisplayConfig) => void;
}

// Stored as ms; edited in whole seconds.
function CardDisplaySection({
    cardDisplayDuration,
    onCardDisplayDurationChange,
    cardDisplayConfig,
    onCardDisplayConfigChange,
}: Props) {
    const [text, setText] = useState(() => String(cardDisplayDuration / 1000));

    const clamp = (seconds: number) => Math.max(1, Math.min(60, seconds));

    const handleChange = (value: string) => {
        setText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num)) {
            onCardDisplayDurationChange(clamp(num) * 1000);
        }
    };

    const handleBlur = () => {
        const num = Number(text);
        const committed =
            text !== '' && Number.isFinite(num)
                ? clamp(num)
                : cardDisplayDuration / 1000;
        setText(String(committed));
        onCardDisplayDurationChange(committed * 1000);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Card Display</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="card-display-duration"
                            className="text-sm font-medium"
                        >
                            Card display duration (seconds)
                        </label>
                        <Input
                            id="card-display-duration"
                            type="number"
                            min={1}
                            max={60}
                            value={text}
                            onChange={(e) => handleChange(e.target.value)}
                            onBlur={handleBlur}
                            className="w-28"
                        />
                        <p className="text-xs text-muted-foreground">
                            How long a played card stays on screen before it
                            auto-clears.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold mb-3">Left Player</h3>
                <CardDisplayConfigEditor
                    config={cardDisplayConfig.left}
                    onChange={(left) =>
                        onCardDisplayConfigChange({
                            ...cardDisplayConfig,
                            left,
                        })
                    }
                    ownSide="left"
                />
            </div>
            <div>
                <h3 className="text-sm font-semibold mb-3">Right Player</h3>
                <CardDisplayConfigEditor
                    config={cardDisplayConfig.right}
                    onChange={(right) =>
                        onCardDisplayConfigChange({
                            ...cardDisplayConfig,
                            right,
                        })
                    }
                    ownSide="right"
                />
            </div>
        </div>
    );
}

export default CardDisplaySection;
