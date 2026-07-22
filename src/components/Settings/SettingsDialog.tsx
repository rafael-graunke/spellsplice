import { useState } from 'react';
import type { ProjectConfig } from '@/components/types/config';
import type { Player, Decklist } from '@/components/types/player';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ProjectMetadataSection from './sections/ProjectMetadataSection';
import PlayerDefaultsSection from './sections/PlayerDefaultsSection';
import PlayersSection from './sections/PlayersSection';
import OverlayAppearanceSection from './sections/OverlayAppearanceSection';
import AnnotationSlotsSection from './sections/AnnotationSlotsSection';

export type Section = 'metadata' | 'players' | 'player-defaults' | 'overlay' | 'annotations';

const NAV_ITEMS: { id: Section; label: string }[] = [
    { id: 'metadata', label: 'Project Metadata' },
    { id: 'players', label: 'Players' },
    { id: 'player-defaults', label: 'Player Defaults' },
    { id: 'overlay', label: 'Overlay Appearance' },
    { id: 'annotations', label: 'Annotations' },
];

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
    players: Player[];
    onUpdatePlayer: (playerId: string, updates: { name?: string; deckName?: string; decklist?: Decklist }) => void;
    // Which section to show when the dialog opens (defaults to Project Metadata).
    initialSection?: Section;
}

type ContentProps = Omit<SettingsDialogProps, 'open' | 'onOpenChange'>;

// Inner content is mounted fresh each time the dialog opens, so `initialSection`
// seeds the selected tab on every open without a setState-in-effect.
function SettingsContent({ config, onConfigChange, players, onUpdatePlayer, initialSection }: ContentProps) {
    const [selectedSection, setSelectedSection] = useState<Section>(initialSection ?? 'metadata');

    return (
        <div className="flex h-full overflow-hidden">
            <nav className="w-52 shrink-0 border-r flex flex-col pt-3 pb-3">
                <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Settings
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
                {selectedSection === 'metadata' && (
                    <ProjectMetadataSection config={config} onConfigChange={onConfigChange} />
                )}
                {selectedSection === 'players' && (
                    <PlayersSection players={players} onUpdatePlayer={onUpdatePlayer} />
                )}
                {selectedSection === 'player-defaults' && (
                    <PlayerDefaultsSection config={config} onConfigChange={onConfigChange} />
                )}
                {selectedSection === 'overlay' && (
                    <OverlayAppearanceSection config={config} onConfigChange={onConfigChange} />
                )}
                {selectedSection === 'annotations' && (
                    <AnnotationSlotsSection config={config} onConfigChange={onConfigChange} />
                )}
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
