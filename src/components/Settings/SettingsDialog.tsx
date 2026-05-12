import { useState } from 'react';
import type { ProjectConfig } from '@/components/types/config';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ProjectMetadataSection from './sections/ProjectMetadataSection';
import PlayerDefaultsSection from './sections/PlayerDefaultsSection';
import OverlayAppearanceSection from './sections/OverlayAppearanceSection';

type Section = 'metadata' | 'player-defaults' | 'overlay';

const NAV_ITEMS: { id: Section; label: string }[] = [
    { id: 'metadata', label: 'Project Metadata' },
    { id: 'player-defaults', label: 'Player Defaults' },
    { id: 'overlay', label: 'Overlay Appearance' },
];

interface SettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    config: ProjectConfig;
    onConfigChange: (c: ProjectConfig) => void;
}

function SettingsDialog({ open, onOpenChange, config, onConfigChange }: SettingsDialogProps) {
    const [selectedSection, setSelectedSection] = useState<Section>('metadata');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl h-[560px] p-0 gap-0 overflow-hidden">
                <DialogTitle className="sr-only">Settings</DialogTitle>
                <div className="flex h-full">
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
                    <div className="flex-1 overflow-y-auto p-6">
                        {selectedSection === 'metadata' && (
                            <ProjectMetadataSection config={config} onConfigChange={onConfigChange} />
                        )}
                        {selectedSection === 'player-defaults' && (
                            <PlayerDefaultsSection config={config} onConfigChange={onConfigChange} />
                        )}
                        {selectedSection === 'overlay' && (
                            <OverlayAppearanceSection config={config} onConfigChange={onConfigChange} />
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default SettingsDialog;
