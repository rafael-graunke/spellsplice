import { useState } from 'react';
import { Input } from '@/components/ui/input';
import type { Offset } from '@/lib/liveMode';

const AXES = ['x', 'y'] as const;

interface Props {
    offset: Offset;
    onChange: (next: Offset) => void;
    // Seeds each input's id (e.g. `hand-stack-offset-x`).
    idPrefix?: string;
}

// Signed X/Y nudge editor. Values may be negative (move the stack the opposite
// way from the anchor), so nothing is clamped to a floor.
function OffsetField({ offset, onChange, idPrefix }: Props) {
    const [text, setText] = useState<Record<(typeof AXES)[number], string>>(
        () => ({ x: String(offset.x), y: String(offset.y) })
    );

    // Resync the inputs when `offset` changes from outside (e.g. picking a new
    // anchor snaps to its default). Canonical "adjust state on prop change"
    // pattern: compare against the last-seen offset held in state.
    const [seen, setSeen] = useState(offset);
    if (offset.x !== seen.x || offset.y !== seen.y) {
        setSeen(offset);
        setText({ x: String(offset.x), y: String(offset.y) });
    }

    const handleChange = (axis: (typeof AXES)[number], value: string) => {
        setText((prev) => ({ ...prev, [axis]: value }));
        const num = Number(value);
        if (value !== '' && value !== '-' && Number.isFinite(num)) {
            onChange({ ...offset, [axis]: num });
        }
    };

    const handleBlur = (axis: (typeof AXES)[number]) => {
        const num = Number(text[axis]);
        const committed =
            text[axis] !== '' && Number.isFinite(num) ? num : offset[axis];
        setText((prev) => ({ ...prev, [axis]: String(committed) }));
        onChange({ ...offset, [axis]: committed });
    };

    return (
        <div className="flex items-center gap-4">
            {AXES.map((axis) => (
                <label key={axis} className="flex items-center gap-1.5 text-sm">
                    <span className="w-3 uppercase text-muted-foreground">
                        {axis}
                    </span>
                    <Input
                        id={idPrefix ? `${idPrefix}-${axis}` : undefined}
                        type="text"
                        inputMode="numeric"
                        aria-label={`${axis} offset`}
                        value={text[axis]}
                        onChange={(e) => handleChange(axis, e.target.value)}
                        onBlur={() => handleBlur(axis)}
                        className="w-20"
                    />
                </label>
            ))}
        </div>
    );
}

export default OffsetField;
