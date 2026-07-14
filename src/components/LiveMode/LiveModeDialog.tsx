import { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { useOracleCards } from '@/hooks/useOracleCards';
import {
    loadLiveModeConfig,
    saveLiveModeConfig,
    loadLiveTemplateState,
    saveLiveTemplateState,
    DEFAULT_CARD_STRIP_WIDTH,
    type LiveTemplateState,
} from '@/lib/liveMode';
import { cn } from '@/lib/utils';
import CardDatabaseSection from './sections/CardDatabaseSection';
import ConnectionSection from './sections/ConnectionSection';
import OverlaySection from './sections/OverlaySection';
import TemplateSection from './sections/TemplateSection';

type Section = 'connection' | 'overlay' | 'template' | 'card-database';

const NAV_ITEMS: { id: Section; label: string }[] = [
    { id: 'connection', label: 'Connection' },
    { id: 'overlay', label: 'Overlay Appearance' },
    { id: 'template', label: 'Template' },
    { id: 'card-database', label: 'Card Database' },
];

interface LiveModeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: () => void;
}

function LiveModeDialog({ open, onOpenChange, onStart }: LiveModeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && <LiveModeDialogContent onStart={onStart} />}
        </Dialog>
    );
}

function LiveModeDialogContent({ onStart }: { onStart: () => void }) {
    const [selectedSection, setSelectedSection] = useState<Section>('connection');
    const [url, setUrl] = useState(() => loadLiveModeConfig()?.websocketUrl ?? '');
    const [cardStripWidth, setCardStripWidth] = useState(
        () => loadLiveModeConfig()?.cardStripWidth ?? DEFAULT_CARD_STRIP_WIDTH,
    );
    const [templateState, setTemplateState] = useState(() => loadLiveTemplateState());
    const { status: oracleCardsStatus, forceRefresh: forceRefreshOracleCards } = useOracleCards();

    // Own connection scoped to the dialog's lifetime, used only to broadcast
    // live config changes (e.g. card strip width) to any connected overlay
    // as they're made - independent of the Connection tab's Test/Start flow.
    const { send } = useLiveModeSocket(url || null, () => {});

    const handleCardStripWidthChange = useCallback(
        (value: number) => {
            setCardStripWidth(value);
            saveLiveModeConfig({ websocketUrl: '', ...loadLiveModeConfig(), cardStripWidth: value });
            send({ type: 'config-state', cardStripWidth: value });
        },
        [send],
    );

    const handleTemplateChange = useCallback(
        (next: LiveTemplateState) => {
            saveLiveTemplateState(next);
            setTemplateState(next);
            send({ type: 'template-state', template: next });
        },
        [send],
    );

    return (
        <DialogContent className="sm:max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">Live Mode Settings</DialogTitle>
            <div className="flex h-full overflow-hidden">
                <nav className="w-52 shrink-0 border-r flex flex-col pt-3 pb-3">
                    <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Live Mode
                    </p>
                    {NAV_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setSelectedSection(item.id)}
                            className={cn(
                                'w-full text-left px-4 py-1.5 text-sm rounded-none transition-colors',
                                selectedSection === item.id
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    {selectedSection === 'connection' && (
                        <ConnectionSection
                            url={url}
                            onUrlChange={setUrl}
                            cardStripWidth={cardStripWidth}
                            onStart={onStart}
                        />
                    )}
                    {selectedSection === 'overlay' && (
                        <OverlaySection
                            cardStripWidth={cardStripWidth}
                            onCardStripWidthChange={handleCardStripWidthChange}
                        />
                    )}
                    {selectedSection === 'template' && (
                        <TemplateSection state={templateState} onChange={handleTemplateChange} />
                    )}
                    {selectedSection === 'card-database' && (
                        <CardDatabaseSection status={oracleCardsStatus} onForceRefresh={forceRefreshOracleCards} />
                    )}
                </div>
            </div>
        </DialogContent>
    );
}

export default LiveModeDialog;
