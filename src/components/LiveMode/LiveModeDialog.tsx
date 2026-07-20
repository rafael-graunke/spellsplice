import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useLiveModeSocket } from '@/hooks/useLiveModeSocket';
import { useOracleCards } from '@/hooks/useOracleCards';
import {
    loadLiveModeConfig,
    saveLiveModeConfig,
    loadLiveScoreboardState,
    saveLiveScoreboardState,
    loadLiveCardDisplayConfig,
    saveLiveCardDisplayConfig,
    loadLiveHandStackConfig,
    saveLiveHandStackConfig,
    loadLiveLayerOrder,
    saveLiveLayerOrder,
    loadLivePlayerInfos,
    patchLivePlayerIdentity,
    DEFAULT_CARD_STRIP_WIDTH,
    DEFAULT_CARD_DISPLAY_DURATION_MS,
    type LiveScoreboardState,
    type LiveCardDisplayConfig,
    type LiveHandStackConfig,
    type LiveLayerId,
    type LiveOverlayPreset,
    type LivePlayerIdentity,
} from '@/lib/liveMode';
import { cn } from '@/lib/utils';
import CardDatabaseSection from './sections/CardDatabaseSection';
import ConnectionSection from './sections/ConnectionSection';
import GeneralSection from './sections/GeneralSection';
import HandStackSection from './sections/HandStackSection';
import CardDisplaySection from './sections/CardDisplaySection';
import ScoreboardSection from './sections/ScoreboardSection';
import PlayersSection from './sections/PlayersSection';

export type Section =
    | 'connection'
    | 'players'
    | 'general'
    | 'scoreboard'
    | 'hand-stack'
    | 'card-display'
    | 'card-database';

type NavLeaf = { id: Section; label: string };
type NavNode = NavLeaf | { label: string; children: NavLeaf[] };

const NAV_ITEMS: NavNode[] = [
    { id: 'connection', label: 'Connection' },
    { id: 'players', label: 'Players' },
    {
        label: 'Overlay Appearance',
        children: [
            { id: 'general', label: 'General' },
            { id: 'scoreboard', label: 'Scoreboard' },
            { id: 'hand-stack', label: 'Hand Stack' },
            { id: 'card-display', label: 'Card Display' },
        ],
    },
    { id: 'card-database', label: 'Card Database' },
];

interface LiveModeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onStart: () => void;
    // Which section to show when the dialog opens (defaults to Connection).
    initialSection?: Section;
}

function LiveModeDialog({
    open,
    onOpenChange,
    onStart,
    initialSection,
}: LiveModeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {open && (
                <LiveModeDialogContent
                    onStart={onStart}
                    initialSection={initialSection}
                />
            )}
        </Dialog>
    );
}

function LiveModeDialogContent({
    onStart,
    initialSection,
}: {
    onStart: () => void;
    initialSection?: Section;
}) {
    const [selectedSection, setSelectedSection] = useState<Section>(
        initialSection ?? 'connection'
    );
    const isOverlaySection =
        selectedSection === 'general' ||
        selectedSection === 'scoreboard' ||
        selectedSection === 'hand-stack' ||
        selectedSection === 'card-display';
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

    // Refs to each Overlay Appearance sub-section (and the scroll container) so
    // clicking a nav leaf can scroll the (single) Overlay Appearance page to
    // that section, and scrolling can highlight the section in view.
    const OVERLAY_ANCHORS: Section[] = [
        'general',
        'scoreboard',
        'hand-stack',
        'card-display',
    ];
    const anchorRefs = useRef<Partial<Record<Section, HTMLDivElement | null>>>(
        {}
    );
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Click-driven scroll, decoupled from `selectedSection` so scroll-spy
    // highlight updates (below) don't re-trigger a scroll (feedback loop).
    const pendingScrollRef = useRef<Section | null>(null);
    const [scrollNonce, setScrollNonce] = useState(0);
    const scrollToAnchor = (id: Section) => {
        pendingScrollRef.current = id;
        setScrollNonce((n) => n + 1);
    };
    useEffect(() => {
        const id = pendingScrollRef.current;
        if (id) {
            anchorRefs.current[id]?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    }, [scrollNonce]);
    // Scroll into the initial overlay section when the dialog opens on one.
    useEffect(() => {
        if (isOverlaySection) scrollToAnchor(selectedSection);
        // Mount-only: initial section is fixed for the dialog's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scroll-spy: highlight the topmost sub-section within the top band of the
    // scroll container as the user scrolls. `-70%` bottom margin shrinks the
    // active zone to the top 30% of the container.
    useEffect(() => {
        if (!isOverlaySection) return;
        const root = scrollContainerRef.current;
        if (!root) return;
        const visible = new Set<Section>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.getAttribute(
                        'data-anchor'
                    ) as Section;
                    if (entry.isIntersecting) visible.add(id);
                    else visible.delete(id);
                }
                const active = OVERLAY_ANCHORS.find((id) => visible.has(id));
                if (active) setSelectedSection(active);
            },
            { root, rootMargin: '0px 0px -70% 0px', threshold: 0 }
        );
        for (const id of OVERLAY_ANCHORS) {
            const el = anchorRefs.current[id];
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOverlaySection]);

    // Select the Overlay Appearance page (clicking the group label), landing on
    // the first section; also ensure the group is expanded.
    const selectOverlay = (groupLabel: string, firstAnchor: Section) => {
        setExpandedGroups((prev) => new Set(prev).add(groupLabel));
        setSelectedSection(firstAnchor);
        scrollToAnchor(firstAnchor);
    };
    const [url, setUrl] = useState(
        () => loadLiveModeConfig()?.websocketUrl ?? ''
    );
    // Legacy global width still drives the shareable overlay URL's stripW seed
    // (card display first-paint). The hand's own width now lives per-side in the
    // Hand Stack config, so this is read-only here.
    const cardStripWidth =
        loadLiveModeConfig()?.cardStripWidth ?? DEFAULT_CARD_STRIP_WIDTH;
    const [cardDisplayDuration, setCardDisplayDuration] = useState(
        () =>
            loadLiveModeConfig()?.cardDisplayDuration ??
            DEFAULT_CARD_DISPLAY_DURATION_MS
    );
    const [scoreboardState, setScoreboardState] = useState(() =>
        loadLiveScoreboardState()
    );
    const [cardDisplayConfig, setCardDisplayConfig] = useState(() =>
        loadLiveCardDisplayConfig()
    );
    const [handStackConfig, setHandStackConfig] = useState(() =>
        loadLiveHandStackConfig()
    );
    const [layerOrder, setLayerOrder] = useState<LiveLayerId[]>(() =>
        loadLiveLayerOrder()
    );
    const [playerInfos, setPlayerInfos] = useState(() =>
        loadLivePlayerInfos()
    );
    const { status: oracleCardsStatus, forceRefresh: forceRefreshOracleCards } =
        useOracleCards();

    // Own connection scoped to the dialog's lifetime, used only to broadcast
    // live config changes (e.g. card strip width) to any connected overlay
    // as they're made - independent of the Connection tab's Test/Start flow.
    const { send } = useLiveModeSocket(url || null, () => {});

    const handleHandStackConfigChange = useCallback(
        (next: LiveHandStackConfig) => {
            saveLiveHandStackConfig(next);
            setHandStackConfig(next);
            send({ type: 'hand-stack-config', config: next });
        },
        [send]
    );

    // Controller-only setting (the play timer runs in the controller), so no
    // websocket broadcast is needed - just persist it.
    const handleCardDisplayDurationChange = useCallback((value: number) => {
        setCardDisplayDuration(value);
        saveLiveModeConfig({
            websocketUrl: '',
            ...loadLiveModeConfig(),
            cardDisplayDuration: value,
        });
    }, []);

    const handleScoreboardChange = useCallback(
        (next: LiveScoreboardState) => {
            saveLiveScoreboardState(next);
            setScoreboardState(next);
            send({ type: 'scoreboard-state', scoreboard: next });
        },
        [send]
    );

    const handleCardDisplayConfigChange = useCallback(
        (next: LiveCardDisplayConfig) => {
            saveLiveCardDisplayConfig(next);
            setCardDisplayConfig(next);
            send({ type: 'card-display-config', config: next });
        },
        [send]
    );

    const handleLayerOrderChange = useCallback(
        (next: LiveLayerId[]) => {
            saveLiveLayerOrder(next);
            setLayerOrder(next);
            send({ type: 'layer-order', order: next });
        },
        [send]
    );

    // Persists the edited identity fields to the project store and broadcasts
    // the full player-info snapshot (identity + current life/wins) to any
    // connected overlay. LiveMode re-reads identity from the store on close.
    const handlePlayerIdentityChange = useCallback(
        (side: 'left' | 'right', patch: Partial<LivePlayerIdentity>) => {
            setPlayerInfos((prev) => {
                const next = {
                    ...prev,
                    [side]: { ...prev[side], ...patch },
                };
                patchLivePlayerIdentity(side, patch);
                send({
                    type: 'player-info-state',
                    left: next.left,
                    right: next.right,
                });
                return next;
            });
        },
        [send]
    );

    // Applies a whole preset: routes each slice through its own change handler
    // so every config persists and broadcasts exactly as a manual edit would.
    const handleApplyPreset = useCallback(
        (preset: LiveOverlayPreset) => {
            handleScoreboardChange(preset.scoreboard);
            handleHandStackConfigChange(preset.handStack);
            handleCardDisplayConfigChange(preset.cardDisplay);
            handleCardDisplayDurationChange(preset.cardDisplayDuration);
            // Legacy presets (pre-layerOrder) omit the field; keep current order.
            if (preset.layerOrder)
                handleLayerOrderChange(preset.layerOrder);
        },
        [
            handleScoreboardChange,
            handleHandStackConfigChange,
            handleCardDisplayConfigChange,
            handleCardDisplayDurationChange,
            handleLayerOrderChange,
        ]
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
                                    <div
                                        className={cn(
                                            'w-full flex items-center gap-1 px-4 py-1.5 text-sm rounded-none transition-colors',
                                            isOverlaySection
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                        )}
                                    >
                                        <button
                                            type="button"
                                            aria-label={
                                                open ? 'Collapse' : 'Expand'
                                            }
                                            onClick={() =>
                                                toggleGroup(item.label)
                                            }
                                            className="shrink-0 flex items-center cursor-pointer"
                                        >
                                            {open ? (
                                                <ChevronDownIcon className="size-3.5" />
                                            ) : (
                                                <ChevronRightIcon className="size-3.5" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                selectOverlay(
                                                    item.label,
                                                    item.children[0].id
                                                )
                                            }
                                            className="flex-1 text-left cursor-pointer"
                                        >
                                            {item.label}
                                        </button>
                                    </div>
                                    {open &&
                                        item.children.map((child) => (
                                            <button
                                                key={child.id}
                                                onClick={() => {
                                                    setSelectedSection(
                                                        child.id
                                                    );
                                                    scrollToAnchor(child.id);
                                                }}
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
                <div ref={scrollContainerRef} className="flex-1 min-h-0 p-6">
                    <div className="h-full overflow-y-auto pr-2">
                        {selectedSection === 'connection' && (
                            <ConnectionSection
                                url={url}
                                onUrlChange={setUrl}
                                cardStripWidth={cardStripWidth}
                                onStart={onStart}
                            />
                        )}
                        {selectedSection === 'players' && (
                            <PlayersSection
                                infos={playerInfos}
                                onChange={handlePlayerIdentityChange}
                            />
                        )}
                        {isOverlaySection && (
                            <div className="flex flex-col gap-6">
                                <div
                                    data-anchor="general"
                                    className="scroll-mt-6"
                                    ref={(el) => {
                                        anchorRefs.current['general'] = el;
                                    }}
                                >
                                    <GeneralSection
                                        scoreboard={scoreboardState}
                                        handStack={handStackConfig}
                                        cardDisplay={cardDisplayConfig}
                                        cardDisplayDuration={
                                            cardDisplayDuration
                                        }
                                        layerOrder={layerOrder}
                                        onLayerOrderChange={
                                            handleLayerOrderChange
                                        }
                                        onApplyPreset={handleApplyPreset}
                                    />
                                </div>
                                <Separator className="bg-foreground/20" />
                                <div
                                    data-anchor="scoreboard"
                                    className="scroll-mt-6"
                                    ref={(el) => {
                                        anchorRefs.current['scoreboard'] = el;
                                    }}
                                >
                                    <ScoreboardSection
                                        state={scoreboardState}
                                        onChange={handleScoreboardChange}
                                    />
                                </div>
                                <Separator className="bg-foreground/20" />
                                <div
                                    data-anchor="hand-stack"
                                    className="scroll-mt-6"
                                    ref={(el) => {
                                        anchorRefs.current['hand-stack'] = el;
                                    }}
                                >
                                    <HandStackSection
                                        handStackConfig={handStackConfig}
                                        onHandStackConfigChange={
                                            handleHandStackConfigChange
                                        }
                                    />
                                </div>
                                <Separator className="bg-foreground/20" />
                                <div
                                    data-anchor="card-display"
                                    className="scroll-mt-6"
                                    ref={(el) => {
                                        anchorRefs.current['card-display'] = el;
                                    }}
                                >
                                    <CardDisplaySection
                                        cardDisplayDuration={
                                            cardDisplayDuration
                                        }
                                        onCardDisplayDurationChange={
                                            handleCardDisplayDurationChange
                                        }
                                        cardDisplayConfig={cardDisplayConfig}
                                        onCardDisplayConfigChange={
                                            handleCardDisplayConfigChange
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {selectedSection === 'card-database' && (
                            <CardDatabaseSection
                                status={oracleCardsStatus}
                                onForceRefresh={forceRefreshOracleCards}
                            />
                        )}
                    </div>
                </div>
            </div>
        </DialogContent>
    );
}

export default LiveModeDialog;
