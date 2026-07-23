import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { ProjectConfig } from '@/components/types/config';
import type { Player, Decklist } from '@/components/types/player';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import ProjectMetadataSection from './sections/ProjectMetadataSection';
import PlayersSection from './sections/PlayersSection';
import OverlayAppearanceSection from './sections/OverlayAppearanceSection';
import AnnotationSlotsSection from './sections/AnnotationSlotsSection';
import LayersSection from './sections/LayersSection';
import ScoreboardSection from '@/components/LiveMode/sections/ScoreboardSection';
import HandStackSection from '@/components/LiveMode/sections/HandStackSection';
import CardDisplaySection from '@/components/LiveMode/sections/CardDisplaySection';
import AnnotationsSection from '@/components/LiveMode/sections/AnnotationsSection';
import CardDatabaseSection from '@/components/LiveMode/sections/CardDatabaseSection';
import type { OracleCardsStatus } from '@/lib/oracleCards';

export type Section =
    | 'metadata'
    | 'players'
    | 'annotation-slots'
    | 'overlay'
    | 'general'
    | 'scoreboard'
    | 'hand'
    | 'card-display'
    | 'annotations'
    | 'card-database';

type NavLeaf = { id: Section; label: string };
type NavNode = NavLeaf | { label: string; children: NavLeaf[] };

// Sub-sections of the single-scroll "Overlay Appearance" page, in paint order.
const OVERLAY_ANCHORS: Section[] = ['general', 'scoreboard', 'hand', 'card-display', 'annotations'];

const NAV_ITEMS: NavNode[] = [
    { id: 'metadata', label: 'Project Metadata' },
    { id: 'players', label: 'Players' },
    { id: 'annotation-slots', label: 'Annotations' },
    { id: 'overlay', label: 'Overlay Behaviour' },
    {
        label: 'Overlay Appearance',
        children: [
            { id: 'general', label: 'General' },
            { id: 'scoreboard', label: 'Scoreboard' },
            { id: 'hand', label: 'Hand Stack' },
            { id: 'card-display', label: 'Card Display' },
            { id: 'annotations', label: 'Annotations' },
        ],
    },
    { id: 'card-database', label: 'Card Database' },
];

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
    players: Player[];
    onUpdatePlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: Decklist; pronouns?: string; standing?: string }) => void;
    // Which section to show when the dialog opens (defaults to Project Metadata).
    initialSection?: Section;
    cardStatus: OracleCardsStatus;
    onForceRefreshCards: () => void;
}

type ContentProps = Omit<SettingsDialogProps, 'open' | 'onOpenChange'>;

// Inner content is mounted fresh each time the dialog opens, so `initialSection`
// seeds the selected tab on every open without a setState-in-effect.
function SettingsContent({ config, onConfigChange, players, onUpdatePlayer, initialSection, cardStatus, onForceRefreshCards }: ContentProps) {
    const [selectedSection, setSelectedSection] = useState<Section>(initialSection ?? 'metadata');
    const isOverlaySection = OVERLAY_ANCHORS.includes(selectedSection);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(['Overlay Appearance']),
    );
    const toggleGroup = (label: string) =>
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });

    // Refs to each Overlay Appearance sub-section + the scroll container, so a
    // nav click can scroll the single page to that section and scroll-spy can
    // highlight the section in view.
    const anchorRefs = useRef<Partial<Record<Section, HTMLDivElement | null>>>({});
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Click-driven scroll, decoupled from `selectedSection` so the scroll-spy
    // highlight below does not re-trigger a scroll (feedback loop).
    const pendingScrollRef = useRef<Section | null>(null);
    const [scrollNonce, setScrollNonce] = useState(0);
    const scrollToAnchor = (id: Section) => {
        pendingScrollRef.current = id;
        setScrollNonce((n) => n + 1);
    };
    useEffect(() => {
        const id = pendingScrollRef.current;
        if (id) anchorRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [scrollNonce]);
    // Scroll into the initial overlay section when the dialog opens on one.
    useEffect(() => {
        if (isOverlaySection) scrollToAnchor(selectedSection);
        // Mount-only: initial section is fixed for the dialog's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Scroll-spy: highlight the topmost sub-section within the top band.
    useEffect(() => {
        if (!isOverlaySection) return;
        const root = scrollContainerRef.current;
        if (!root) return;
        const visible = new Set<Section>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.getAttribute('data-anchor') as Section;
                    if (entry.isIntersecting) visible.add(id);
                    else visible.delete(id);
                }
                const active = OVERLAY_ANCHORS.find((id) => visible.has(id));
                if (active) setSelectedSection(active);
            },
            { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
        );
        for (const id of OVERLAY_ANCHORS) {
            const el = anchorRefs.current[id];
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [isOverlaySection]);

    // Clicking the group label lands on its first section and expands the group.
    const selectOverlay = (groupLabel: string, firstAnchor: Section) => {
        setExpandedGroups((prev) => new Set(prev).add(groupLabel));
        setSelectedSection(firstAnchor);
        scrollToAnchor(firstAnchor);
    };

    const anchor = (id: Section, node: React.ReactNode) => (
        <div
            data-anchor={id}
            className="scroll-mt-6"
            ref={(el) => {
                anchorRefs.current[id] = el;
            }}
        >
            {node}
        </div>
    );

    return (
        <div className="flex h-full overflow-hidden">
            <nav className="w-52 shrink-0 border-r flex flex-col pt-3 pb-3">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Settings
                </p>
                {NAV_ITEMS.map((item) => {
                    const leafClass = (id: Section, indented: boolean) =>
                        cn(
                            'w-full text-left py-1.5 text-sm rounded-none transition-colors',
                            indented ? 'pl-12 pr-4' : 'pl-[2.125rem] pr-4',
                            selectedSection === id
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
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
                                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                    )}
                                >
                                    <button
                                        type="button"
                                        aria-label={open ? 'Collapse' : 'Expand'}
                                        onClick={() => toggleGroup(item.label)}
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
                                        onClick={() => selectOverlay(item.label, item.children[0].id)}
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
                                                setSelectedSection(child.id);
                                                scrollToAnchor(child.id);
                                            }}
                                            className={leafClass(child.id, true)}
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
                    {selectedSection === 'metadata' && (
                        <ProjectMetadataSection config={config} onConfigChange={onConfigChange} />
                    )}
                    {selectedSection === 'players' && (
                        <PlayersSection players={players} onUpdatePlayer={onUpdatePlayer} />
                    )}
                    {selectedSection === 'annotation-slots' && (
                        <AnnotationSlotsSection config={config} onConfigChange={onConfigChange} />
                    )}
                    {selectedSection === 'overlay' && (
                        <OverlayAppearanceSection config={config} onConfigChange={onConfigChange} />
                    )}
                    {selectedSection === 'card-database' && (
                        <CardDatabaseSection status={cardStatus} onForceRefresh={onForceRefreshCards} />
                    )}
                    {isOverlaySection && (
                        <div className="flex flex-col gap-6">
                            {anchor('general', <LayersSection config={config} onConfigChange={onConfigChange} />)}
                            <Separator className="bg-foreground/20" />
                            {anchor(
                                'scoreboard',
                                <ScoreboardSection
                                    state={config.scoreboard}
                                    onChange={(scoreboard) => onConfigChange({ ...config, scoreboard })}
                                />,
                            )}
                            <Separator className="bg-foreground/20" />
                            {anchor(
                                'hand',
                                <HandStackSection
                                    handStackConfig={config.handStack}
                                    onHandStackConfigChange={(handStack) => onConfigChange({ ...config, handStack })}
                                />,
                            )}
                            <Separator className="bg-foreground/20" />
                            {anchor(
                                'card-display',
                                <CardDisplaySection
                                    cardDisplayDuration={config.cardDisplayDuration}
                                    onCardDisplayDurationChange={(cardDisplayDuration) => onConfigChange({ ...config, cardDisplayDuration })}
                                    cardDisplayConfig={config.cardDisplay}
                                    onCardDisplayConfigChange={(cardDisplay) => onConfigChange({ ...config, cardDisplay })}
                                />,
                            )}
                            <Separator className="bg-foreground/20" />
                            {anchor(
                                'annotations',
                                <AnnotationsSection
                                    annotationConfig={config.annotationConfig}
                                    onAnnotationConfigChange={(annotationConfig) => onConfigChange({ ...config, annotationConfig })}
                                />,
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SettingsDialog({ open, onOpenChange, ...content }: SettingsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
                <DialogTitle className="sr-only">Settings</DialogTitle>
                {open && <SettingsContent {...content} />}
            </DialogContent>
        </Dialog>
    );
}

export default SettingsDialog;
