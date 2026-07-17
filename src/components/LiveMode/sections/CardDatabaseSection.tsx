import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OracleCardsStatus } from '@/lib/oracleCards';

interface Props {
    status: OracleCardsStatus;
    onForceRefresh: () => void;
}

const BUSY_STATUSES: OracleCardsStatus[] = ['checking', 'downloading', 'storing'];

function CardDatabaseSection({ status, onForceRefresh }: Props) {
    const busy = BUSY_STATUSES.includes(status);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-base font-medium mb-4">Card Database</h2>
                <div className="flex flex-col gap-4">
                    <p className="text-xs text-muted-foreground">
                        Card names, mana costs, and images come from Scryfall&apos;s bulk data, cached locally in
                        your browser. If a card looks wrong or out of date (missing mana pips, wrong art, wrong
                        name), force a full re-download.
                    </p>

                    {status !== 'idle' && (
                        <div className="flex items-center gap-2 text-sm">
                            {busy && (
                                <>
                                    <Loader2 className="size-4 animate-spin text-yellow-500" />
                                    <span className="text-yellow-500">
                                        {status === 'downloading' ? 'Downloading card database...' : 'Updating card database...'}
                                    </span>
                                </>
                            )}
                            {status === 'ready' && (
                                <>
                                    <CheckCircle2 className="size-4 text-green-500" />
                                    <span className="text-green-500">Card database up to date</span>
                                </>
                            )}
                            {status === 'error' && (
                                <>
                                    <XCircle className="size-4 text-red-500" />
                                    <span className="text-red-500">Card database update failed</span>
                                </>
                            )}
                        </div>
                    )}

                    <div>
                        <Button variant="outline" onClick={onForceRefresh} disabled={busy}>
                            Force Update
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CardDatabaseSection;
