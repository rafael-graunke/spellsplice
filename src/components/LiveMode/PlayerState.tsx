import { useEffect, useState } from 'react';
import { MinusIcon, PencilIcon, PlusIcon, Trophy, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface PlayerStateProps {
    name: string;
    deckName: string;
    life: number;
    wins: number;
    // Opens the Players config (name/deck/standing/pronouns live there now).
    onEdit: () => void;
    onLifeChange: (life: number) => void;
    onWinsChange: (wins: number) => void;
    reverse?: boolean;
}

export function PlayerState({
    name,
    deckName,
    life,
    wins,
    onEdit,
    onLifeChange,
    onWinsChange,
    reverse = false,
}: PlayerStateProps) {
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
        <div
            className={cn(
                'flex justify-between gap-2 rounded-lg border bg-muted p-2 px-3',
                reverse ? 'flex-row-reverse' : 'flex-row'
            )}
        >
            <div className="flex items-center gap-2">
                <div className="flex flex-col items-start min-w-0">
                    <p className="text-md font-medium truncate">
                        {name || 'Player name'}
                    </p>
                    <p className="text-sm font-medium text-muted-foreground truncate">
                        {deckName || 'Deck name'}
                    </p>
                </div>
                <Button
                    className="cursor-pointer"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onEdit}
                >
                    <PencilIcon />
                </Button>
            </div>

            <div
                className={cn(
                    'flex items-center justify-center gap-2',
                    reverse ? 'flex-row-reverse' : 'flex-row'
                )}
            >
                <div className="flex items-center justify-center gap-3 p-1 pl-2 rounded-md border bg-black/20">
                    <div className="flex items-center justify-start gap-2">
                        <Heart className="w-4 h-4" />
                        <p className="text-sm text-muted-foreground tabular-nums">Life</p>
                    </div>
                    <Separator orientation="vertical" className="w-full"/>
                    <div className="flex items-center justify-center gap-1">
                        <Button
                            className="cursor-pointer"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onLifeChange(life - 1)}
                        >
                            <MinusIcon className="" />
                        </Button>
                        <input
                            className={cn(
                                'w-10 bg-transparent text-center text-lg font-semibold tabular-nums outline-none',
                                'border-none p-0 focus-visible:ring-0'
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
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onLifeChange(life + 1)}
                        >
                            <PlusIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-3 p-1 pl-2 rounded-md border bg-black/20">
                    <div className="flex items-center w-full justify-start gap-2">
                        <Trophy className="w-4 h-4" />
                        <p className="text-sm text-muted-foreground tabular-nums">Wins</p>
                    </div>
                    <Separator orientation="vertical" className="w-full" />
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            className="cursor-pointer"
                            variant="ghost"
                            size="icon-sm"
                            disabled={wins <= 0}
                            onClick={() => onWinsChange(wins - 1)}
                        >
                            <MinusIcon className="h-4 w-4" />
                        </Button>
                        <span className="w-10 text-center text-lg font-semibold tabular-nums">
                            {wins}
                        </span>
                        <Button
                            className="cursor-pointer"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onWinsChange(wins + 1)}
                        >
                            <PlusIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
