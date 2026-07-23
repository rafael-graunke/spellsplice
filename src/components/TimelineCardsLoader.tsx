import { Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OracleCardsStatus } from '@/lib/oracleCards';

interface Props {
    status: OracleCardsStatus;
    onRetry: () => void;
}

// First-run blocking screen shown while the card database downloads. Once a
// local copy exists, later refreshes happen in the background and never mount
// this. Progress is phase text only (a gzip transfer has no reliable byte %).
function TimelineCardsLoader({ status, onRetry }: Props) {
    const label =
        status === 'downloading'
            ? 'Downloading card database…'
            : status === 'storing'
              ? 'Preparing cards…'
              : 'Loading card database…';

    return (
        <div className="flex-1 flex items-center justify-center">
            {status === 'error' ? (
                <div className="flex flex-col items-center gap-4 text-center">
                    <XCircle className="size-8 text-red-500" />
                    <div>
                        <p className="text-sm font-medium">Card database failed to load</p>
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
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            First-time setup, this only happens once.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TimelineCardsLoader;
