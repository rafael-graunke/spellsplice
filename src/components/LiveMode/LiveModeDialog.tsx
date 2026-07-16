import { useCallback, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { useOracleCards } from '@/hooks/useOracleCards';
import {
    loadLiveModeConfig,
    saveLiveModeConfig,
    loadLiveScoreboardState,
    saveLiveScoreboardState,
    DEFAULT_CARD_STRIP_WIDTH,
    type LiveScoreboardState,
} from '@/lib/liveMode';
import { cn } from '@/lib/utils';
import CardDatabaseSection from './sections/CardDatabaseSection';
import ConnectionSection from './sections/ConnectionSection';
import CardStripSection from './sections/CardStripSection';
import ScoreboardSection from './sections/ScoreboardSection';

type Section = 'connection' | 'scoreboard' | 'card-strip' | 'card-database';

type NavLeaf = { id: Section; label: string };
type NavNode = NavLeaf | { label: string; children: NavLeaf[] };

const NAV_ITEMS: NavNode[] = [
    { id: 'connection', label: 'Connection' },
    {
        label: 'Overlay Appearance',
        children: [
            { id: 'scoreboard', label: 'Scoreboard' },
            { id: 'card-strip', label: 'Card Strip' },
        ],
    },
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
    const [selectedSection, setSelectedSection] =
        useState<Section>('connection');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(['Overlay Appearance'])
    );
    const toggleGroup = (label: string) =>
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    const [url, setUrl] = useState(
        () => loadLiveModeConfig()?.websocketUrl ?? ''
    );
    const [cardStripWidth, setCardStripWidth] = useState(
        () => loadLiveModeConfig()?.cardStripWidth ?? DEFAULT_CARD_STRIP_WIDTH
    );
    const [scoreboardState, setScoreboardState] = useState(() =>
        loadLiveScoreboardState()
    );
    const { status: oracleCardsStatus, forceRefresh: forceRefreshOracleCards } =
        useOracleCards();

    // Own connection scoped to the dialog's lifetime, used only to broadcast
    // live config changes (e.g. card strip width) to any connected overlay
    // as they're made - independent of the Connection tab's Test/Start flow.
    const { send } = useLiveModeSocket(url || null, () => {});

    const handleCardStripWidthChange = useCallback(
        (value: number) => {
            setCardStripWidth(value);
            saveLiveModeConfig({
                websocketUrl: '',
                ...loadLiveModeConfig(),
                cardStripWidth: value,
            });
            send({ type: 'config-state', cardStripWidth: value });
        },
        [send]
    );

    const handleScoreboardChange = useCallback(
        (next: LiveScoreboardState) => {
            saveLiveScoreboardState(next);
            setScoreboardState(next);
            send({ type: 'scoreboard-state', scoreboard: next });
        },
        [send]
    );

    return (
        <DialogContent className="sm:max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
            <DialogTitle className="sr-only">Live Mode Settings</DialogTitle>
            <div className="flex h-full overflow-hidden">
                <nav className="w-52 shrink-0 border-r flex flex-col pt-3 pb-3">
                    <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Live Mode
                    </p>
                    {NAV_ITEMS.map((item) => {
                        const leafClass = (id: Section, indented: boolean) =>
                            cn(
                                'w-full text-left py-1.5 text-sm rounded-none transition-colors',
                                // Top-level leaves get pl-[2.125rem] (px-4 + chevron
                                // width + gap) so their text aligns with the group
                                // label, which the chevron pushes right.
                                indented ? 'pl-12 pr-4' : 'pl-[2.125rem] pr-4',
                                selectedSection === id
                                    ? 'bg-accent text-accent-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                            );
                        if ('children' in item) {
                            const open = expandedGroups.has(item.label);
                            return (
                                <div key={item.label}>
                                    <button
                                        onClick={() => toggleGroup(item.label)}
                                        className="w-full flex items-center gap-1 text-left px-4 py-1.5 text-sm rounded-none text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                                    >
                                        {open ? (
                                            <ChevronDownIcon className="size-3.5 shrink-0" />
                                        ) : (
                                            <ChevronRightIcon className="size-3.5 shrink-0" />
                                        )}
                                        {item.label}
                                    </button>
                                    {open &&
                                        item.children.map((child) => (
                                            <button
                                                key={child.id}
                                                onClick={() =>
                                                    setSelectedSection(child.id)
                                                }
                                                className={leafClass(
                                                    child.id,
                                                    true
                                                )}
                                            >
                                                {child.label}
                                            </button>
                                        ))}
                                </div>
                            );
                        }
                        return (
                            <button
                                key={item.id}
                                onClick={() => setSelectedSection(item.id)}
                                className={leafClass(item.id, false)}
                            >
                                {item.label}
                            </button>
                        );
                    })}
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
                    {selectedSection === 'scoreboard' && (
                        <ScoreboardSection
                            state={scoreboardState}
                            onChange={handleScoreboardChange}
                        />
                    )}
                    {selectedSection === 'card-strip' && (
                        <CardStripSection
                            cardStripWidth={cardStripWidth}
                            onCardStripWidthChange={handleCardStripWidthChange}
                        />
                    )}
                    {selectedSection === 'card-database' && (
                        <CardDatabaseSection
                            status={oracleCardsStatus}
                            onForceRefresh={forceRefreshOracleCards}
                        />
                    )}
                </div>
            </div>
        </DialogContent>
    );
}

export default LiveModeDialog;
