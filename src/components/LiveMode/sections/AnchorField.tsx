import type { CardDisplayAnchor } from '@/lib/liveMode';
import { cn } from '@/lib/utils';

interface Props<T extends string> {
    value: T;
    onChange: (next: T) => void;
    // Scoreboard anchors have no vertical-center row; omit it to show a 3×2 grid.
    includeMiddleRow?: boolean;
    // Renders the grid inert and dimmed (e.g. annotations following the hand).
    disabled?: boolean;
}

const ANCHOR_CELLS: { id: CardDisplayAnchor; label: string }[] = [
    { id: 'top-left', label: 'Top Left' },
    { id: 'top-center', label: 'Top Center' },
    { id: 'top-right', label: 'Top Right' },
    { id: 'middle-left', label: 'Middle Left' },
    { id: 'middle-center', label: 'Middle Center' },
    { id: 'middle-right', label: 'Middle Right' },
    { id: 'bottom-left', label: 'Bottom Left' },
    { id: 'bottom-center', label: 'Bottom Center' },
    { id: 'bottom-right', label: 'Bottom Right' },
];

function AnchorField<T extends string>({
    value,
    onChange,
    includeMiddleRow = true,
    disabled = false,
}: Props<T>) {
    const cells = ANCHOR_CELLS.filter(
        (cell) => includeMiddleRow || !cell.id.startsWith('middle-')
    );
    const selected = cells.find((cell) => cell.id === value);

    return (
        <div
            className={cn(
                'flex w-28 flex-col gap-1.5',
                disabled && 'pointer-events-none opacity-50'
            )}
        >
            <div className="grid grid-cols-3 overflow-hidden rounded-sm border">
                {cells.map((cell) => (
                    <button
                        key={cell.id}
                        type="button"
                        aria-label={cell.label}
                        aria-pressed={value === cell.id}
                        disabled={disabled}
                        onClick={() => onChange(cell.id as T)}
                        className={cn(
                            'aspect-square cursor-pointer ring-1 ring-inset ring-border transition-colors',
                            value === cell.id
                                ? 'bg-primary'
                                : 'bg-background hover:bg-accent'
                        )}
                    />
                ))}
            </div>
            <span className="text-center text-xs text-muted-foreground">
                {selected?.label}
            </span>
        </div>
    );
}

export default AnchorField;
