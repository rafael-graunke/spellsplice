import { useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { parseDecklist } from '@/lib/parseDecklist';
import { findOracleCard } from '@/lib/oracleCards';
import type { Decklist } from '@/components/types/player';
import { cn } from '@/lib/utils';

interface ImportDecklistDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (decklist: Decklist) => void;
    ready: boolean;
}

function ImportDecklistDialog({
    open,
    onOpenChange,
    onImport,
    ready,
}: ImportDecklistDialogProps) {
    const [text, setText] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [notFoundCards, setNotFoundCards] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readFileAsText = (file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => setText((ev.target?.result as string) ?? '');
        reader.readAsText(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) readFileAsText(file);
    };

    const handleImport = () => {
        if (!text.trim() || !ready) return;

        const decklist = parseDecklist(text);
        const notFound = decklist.maindeck
            .filter(({ card }) => !findOracleCard(card.name))
            .map(({ card }) => card.name);

        if (notFound.length > 0) {
            setNotFoundCards(notFound);
            return;
        }

        onImport(decklist);
        setText('');
        setNotFoundCards([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Decklist</DialogTitle>
                    <DialogDescription>
                        Paste an MTGO export or drop a file. Cards are checked
                        against the local card database.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                        {ready
                            ? 'Paste MTGO export or drop a file'
                            : 'Card database still loading…'}
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
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setNotFoundCards([]);
                    }}
                    placeholder="4 Lightning Bolt&#10;4 Goblin Guide (M10)&#10;…"
                    className={cn(
                        'min-h-32 max-h-64 resize-y font-mono text-xs transition-colors',
                        isDragOver && 'border-ring bg-input/50',
                        notFoundCards.length > 0 && 'border-destructive'
                    )}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    disabled={!ready}
                />
                {notFoundCards.length > 0 && (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <p className="font-medium mb-1">Cards not found:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            {notFoundCards.map((c) => (
                                <li key={c}>{c}</li>
                            ))}
                        </ul>
                    </div>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.dec,.dek"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) readFileAsText(f);
                        e.target.value = '';
                    }}
                />

                <DialogFooter>
                    <Button
                        onClick={handleImport}
                        disabled={!text.trim() || !ready}
                    >
                        Import
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default ImportDecklistDialog;
