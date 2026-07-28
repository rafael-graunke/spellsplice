import { useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface MatchControlsProps {
    onResetMatch: () => void;
}

export function MatchControls({ onResetMatch }: MatchControlsProps) {
    const [open, setOpen] = useState(false);

    const handleConfirm = () => {
        onResetMatch();
        setOpen(false);
    };

    return (
        <div className="flex h-full flex-col items-center justify-center gap-2 self-stretch bg-surface rounded-lg border px-5">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="destructive"
                        size="lg"
                        className="cursor-pointer"
                    >
                        <RotateCcwIcon />
                        Reset Match
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset match?</DialogTitle>
                        <DialogDescription>
                            Clears both hands, all annotations, and resets life
                            totals to 20. Wins, decklists, and player names are
                            kept.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                className="cursor-pointer"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            className="cursor-pointer"
                            onClick={handleConfirm}
                        >
                            Reset Match
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
