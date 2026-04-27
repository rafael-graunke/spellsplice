import { useRef, useState } from 'react';
import { PencilIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player, Decklist } from '../types/player';
import { parseDecklist } from '@/lib/parseDecklist';
import { cardDataCache, verifyCard } from '@/lib/cardCache';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface TimelineTrackControlProps {
    players: Player[];
    selectedPlayer: Player | null;
    onSelectPlayer: (player: Player) => void;
    onEditPlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: Decklist }) => void;
}

function TimelineTrackControl({
    players,
    selectedPlayer,
    onSelectPlayer,
    onEditPlayer,
}: TimelineTrackControlProps) {
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [name, setName] = useState('');
    const [deckName, setDeckName] = useState('');
    const [decklistText, setDecklistText] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [verifyProgress, setVerifyProgress] = useState<{ done: number; total: number } | null>(null);
    const [notFoundCards, setNotFoundCards] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openEdit = (e: React.MouseEvent, player: Player) => {
        e.stopPropagation();
        setEditingPlayer(player);
        setName(player.name);
        setDeckName(player.deckName ?? '');
        setDecklistText('');
        setVerifyProgress(null);
        setNotFoundCards([]);
    };

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

    const handleSave = async () => {
        if (!editingPlayer || verifyProgress !== null) return;

        setNotFoundCards([]);

        if (decklistText.trim()) {
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

            const updates: Parameters<typeof onEditPlayer>[1] = {
                name: name.trim() || editingPlayer.name,
                deckName: deckName.trim() || undefined,
                decklist,
            };
            onEditPlayer(editingPlayer.id, updates);
        } else {
            onEditPlayer(editingPlayer.id, {
                name: name.trim() || editingPlayer.name,
                deckName: deckName.trim() || undefined,
            });
        }

        setEditingPlayer(null);
    };

    return (
        <>
            <div className="flex flex-col">
                {players.map((player) => (
                    <div
                        key={player.id}
                        onClick={() => onSelectPlayer(player)}
                        className={cn(
                            'group h-12 flex items-center px-3 border-b border-gray-600 border-solid text-sm truncate cursor-pointer select-none',
                            player.id === selectedPlayer?.id
                                ? 'text-white bg-white/10'
                                : 'text-gray-400 hover:text-gray-200'
                        )}
                    >
                        <span className="flex-1 truncate">{player.name}</span>
                        <button
                            onClick={(e) => openEdit(e, player)}
                            className="opacity-0 group-hover:opacity-100 ml-1 p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-opacity"
                        >
                            <PencilIcon className="size-3.5" />
                        </button>
                    </div>
                ))}
            </div>

            <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit player</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-md text-muted-foreground">Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-md text-muted-foreground">Deck name</label>
                            <Input
                                value={deckName}
                                onChange={(e) => setDeckName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                placeholder="Optional"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <label className="text-md text-muted-foreground">Decklist</label>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-md text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Upload file
                                </button>
                            </div>
                            <Textarea
                                value={decklistText}
                                onChange={(e) => { setDecklistText(e.target.value); setNotFoundCards([]); }}
                                placeholder="Paste or drop decklist here…"
                                className={cn('min-h-32 resize-y font-mono text-xs transition-colors', isDragOver && 'border-ring bg-input/50', notFoundCards.length > 0 && 'border-destructive')}
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
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={verifyProgress !== null}>
                            {verifyProgress !== null
                                ? `Verifying… ${verifyProgress.done}/${verifyProgress.total}`
                                : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default TimelineTrackControl;
