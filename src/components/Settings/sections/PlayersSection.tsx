import { useRef, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { Player, Decklist } from '@/components/types/player';
import { parseDecklist } from '@/lib/parseDecklist';
import { cardDataCache, verifyCard } from '@/lib/cardCache';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
    players: Player[];
    onUpdatePlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: Decklist }) => void;
}

interface PlayerRowProps {
    player: Player;
    onUpdate: (updates: { name?: string; deckName?: string; decklist?: Decklist }) => void;
}

function PlayerRow({ player, onUpdate }: PlayerRowProps) {
    const [name, setName] = useState(player.name);
    const [deckName, setDeckName] = useState(player.deckName ?? '');
    const [decklistExpanded, setDecklistExpanded] = useState(false);
    const [decklistText, setDecklistText] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [verifyProgress, setVerifyProgress] = useState<{ done: number; total: number } | null>(null);
    const [notFoundCards, setNotFoundCards] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readFileAsText = (file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => setDecklistText(ev.target?.result as string ?? '');
        reader.readAsText(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) readFileAsText(file);
    };

    const handleImportDecklist = async () => {
        if (!decklistText.trim() || verifyProgress !== null) return;
        setNotFoundCards([]);

        const decklist = parseDecklist(decklistText);
        const allCards = [...decklist.maindeck, ...(decklist.sideboard ?? [])];
        const unique = [...new Map(
            allCards.map(({ card }) => [`${card.name}|${card.edition ?? ''}`, card])
        ).values()];

        const toFetch = unique.filter((card) => !cardDataCache[card.name]?.[card.edition ?? '*']);

        if (toFetch.length > 0) {
            setVerifyProgress({ done: 0, total: toFetch.length });
            const failed: string[] = [];
            let done = 0;

            await Promise.all(toFetch.map(async (card) => {
                try {
                    const found = await verifyCard(card.name, card.edition);
                    if (!found) failed.push(card.edition ? `${card.name} (${card.edition})` : card.name);
                } catch {
                    failed.push(card.edition ? `${card.name} (${card.edition})` : card.name);
                }
                done++;
                setVerifyProgress({ done, total: toFetch.length });
            }));

            setVerifyProgress(null);

            if (failed.length > 0) {
                setNotFoundCards(failed);
                return;
            }
        }

        onUpdate({ decklist });
        setDecklistText('');
        setDecklistExpanded(false);
    };

    const cardCount = player.decklist
        ? player.decklist.maindeck.reduce((n, e) => n + e.quantity, 0)
        : null;

    return (
        <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex flex-col gap-3">
                <div className="flex gap-3">
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-medium text-muted-foreground">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => {
                                const trimmed = name.trim();
                                if (trimmed && trimmed !== player.name) onUpdate({ name: trimmed });
                                else setName(player.name);
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-medium text-muted-foreground">Deck name</label>
                        <Input
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                            onBlur={() => {
                                const trimmed = deckName.trim();
                                const current = player.deckName ?? '';
                                if (trimmed !== current) onUpdate({ deckName: trimmed || undefined });
                            }}
                            placeholder="Optional"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setDecklistExpanded((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
                >
                    {decklistExpanded
                        ? <ChevronDownIcon className="size-3.5" />
                        : <ChevronRightIcon className="size-3.5" />}
                    {cardCount !== null
                        ? `Decklist · ${cardCount} cards`
                        : 'Import decklist'}
                </button>
            </div>

            {decklistExpanded && (
                <div className="border-t px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            Paste MTGO export or drop a file
                        </span>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Upload file
                        </button>
                    </div>
                    <Textarea
                        value={decklistText}
                        onChange={(e) => { setDecklistText(e.target.value); setNotFoundCards([]); }}
                        placeholder="4 Lightning Bolt&#10;4 Goblin Guide (M10)&#10;…"
                        className={cn(
                            'min-h-16 max-h-40 resize-y font-mono text-xs transition-colors',
                            isDragOver && 'border-ring bg-input/50',
                            notFoundCards.length > 0 && 'border-destructive',
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        disabled={verifyProgress !== null}
                    />
                    {verifyProgress !== null && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-200"
                                style={{ width: `${(verifyProgress.done / verifyProgress.total) * 100}%` }}
                            />
                        </div>
                    )}
                    {notFoundCards.length > 0 && (
                        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <p className="font-medium mb-1">Cards not found:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {notFoundCards.map((c) => <li key={c}>{c}</li>)}
                            </ul>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.dec,.dek"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) readFileAsText(f); e.target.value = ''; }}
                    />
                    <Button
                        size="sm"
                        onClick={handleImportDecklist}
                        disabled={!decklistText.trim() || verifyProgress !== null}
                        className="self-end"
                    >
                        {verifyProgress !== null
                            ? `Verifying… ${verifyProgress.done}/${verifyProgress.total}`
                            : 'Import'}
                    </Button>
                </div>
            )}
        </div>
    );
}

function PlayersSection({ players, onUpdatePlayer }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Players</h2>
                <div className="flex flex-col gap-3">
                    {players.map((player) => (
                        <PlayerRow
                            key={player.id}
                            player={player}
                            onUpdate={(updates) => onUpdatePlayer(player.id, updates)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PlayersSection;
