import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { OracleCardsStatus } from '@/lib/oracleCards';

interface Props {
    status: OracleCardsStatus;
    // 0..1 within the current phase; undefined when the phase can't measure a
    // total (indeterminate).
    progress?: number;
    onRetry: () => void;
}

// First-run blocking screen shown while the card database downloads. Once a
// local copy exists, later refreshes happen in the background and never mount
// this. Both phases (download bytes, storing chunks) report a fraction, so a
// determinate bar is shown when one is available.
function TimelineCardsLoader({ status, progress, onRetry }: Props) {
    const label =
        status === 'downloading'
            ? 'Downloading card database…'
            : status === 'storing'
              ? 'Preparing cards…'
              : 'Loading card database…';
    const showBar = status === 'downloading' || status === 'storing';
    const pct = progress != null ? Math.round(progress * 100) : undefined;

    return (
        <div className="flex-1 flex items-center justify-center">
            {status === 'error' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                    <XCircle className="size-8 text-red-500" />
                    <div>
                        <p className="text-sm font-medium">
                            Card database failed to load
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Check your connection and try again.
                        </p>
                    </div>
                    <Button variant="outline" onClick={onRetry}>
                        Retry
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">
                            {label}
                            {pct != null && showBar ? ` ${pct}%` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            First-time setup, this only happens once.
                        </p>
                    </div>
                    {showBar && <Progress value={pct ?? 0} className="w-56" />}
                </div>
            )}
        </div>
    );
}

export default TimelineCardsLoader;
