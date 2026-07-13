import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface Props {
    cardStripWidth: number;
    onCardStripWidthChange: (value: number) => void;
}

function OverlaySection({ cardStripWidth, onCardStripWidthChange }: Props) {
    const [text, setText] = useState(() => String(cardStripWidth));

    const clamp = (value: number) => Math.max(100, Math.min(1000, value));

    const handleChange = (value: string) => {
        setText(value);
        const num = Number(value);
        if (value !== '' && Number.isFinite(num)) {
            onCardStripWidthChange(clamp(num));
        }
    };

    const handleBlur = () => {
        const num = Number(text);
        const committed = text !== '' && Number.isFinite(num) ? clamp(num) : cardStripWidth;
        setText(String(committed));
        onCardStripWidthChange(committed);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Overlay Appearance</h2>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="card-strip-width" className="text-sm font-medium">Card strip width (px)</label>
                        <Input
                            id="card-strip-width"
                            type="number"
                            min={100}
                            max={1000}
                            value={text}
                            onChange={(e) => handleChange(e.target.value)}
                            onBlur={handleBlur}
                            className="w-28"
                        />
                        <p className="text-xs text-muted-foreground">
                            Updates the live overlay immediately (sent over the websocket).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OverlaySection;
