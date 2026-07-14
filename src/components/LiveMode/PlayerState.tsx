import { useEffect, useState } from 'react';
import { MinusIcon, PencilIcon, PlusIcon, CheckIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PlayerStateProps {
    name: string;
    deckName: string;
    life: number;
    wins: number;
    onChangeName: (name: string) => void;
    onChangeDeckName: (deckName: string) => void;
    onLifeChange: (life: number) => void;
    onWinsChange: (wins: number) => void;
}

export function PlayerState({
    name,
    deckName,
    life,
    wins,
    onChangeName,
    onChangeDeckName,
    onLifeChange,
    onWinsChange,
}: PlayerStateProps) {
    const [editing, setEditing] = useState(false);
    const [lifeDraft, setLifeDraft] = useState(String(life));

    useEffect(() => {
        setLifeDraft(String(life));
    }, [life]);

    const commitLife = () => {
        const parsed = parseInt(lifeDraft, 10);
        if (Number.isNaN(parsed)) {
            setLifeDraft(String(life));
        } else if (parsed !== life) {
            onLifeChange(parsed);
        }
    };

    return (
        <div className="flex justify-between gap-2 rounded-lg border bg-muted p-2">
            <div className="flex items-center gap-2">
                {editing ? (
                    <div className="flex flex-1 flex-col gap-1">
                        <Input
                            className="h-7"
                            value={name}
                            placeholder="Player name"
                            onChange={(e) => onChangeName(e.target.value)}
                        />
                        <Input
                            className="h-7"
                            value={deckName}
                            placeholder="Deck name"
                            onChange={(e) => onChangeDeckName(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col min-w-0">
                        <p className="text-sm font-medium truncate">{name || 'Player name'}</p>
                        <p className="text-xs text-muted-foreground truncate">{deckName || 'Deck name'}</p>
                    </div>
                )}
                <Button
                    className="cursor-pointer"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing((v) => !v)}
                >
                    {editing ? <CheckIcon /> : <PencilIcon />}
                </Button>
            </div>

            <div className="flex items-center justify-center gap-3">
                <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onLifeChange(life - 1)}
                >
                    <MinusIcon />
                </Button>
                <input
                    className={cn(
                        'w-10 bg-transparent text-center text-lg font-semibold tabular-nums outline-none',
                        'border-none p-0 focus-visible:ring-0',
                    )}
                    value={lifeDraft}
                    inputMode="numeric"
                    onChange={(e) => setLifeDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    onBlur={commitLife}
                />
                <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onLifeChange(life + 1)}
                >
                    <PlusIcon />
                </Button>
            </div>

            <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Wins</span>
                <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="icon-xs"
                    disabled={wins <= 0}
                    onClick={() => onWinsChange(wins - 1)}
                >
                    <MinusIcon />
                </Button>
                <span className="w-4 text-center text-sm font-semibold tabular-nums">{wins}</span>
                <Button
                    className="cursor-pointer"
                    variant="outline"
                    size="icon-xs"
                    onClick={() => onWinsChange(wins + 1)}
                >
                    <PlusIcon />
                </Button>
            </div>
        </div>
    );
}
