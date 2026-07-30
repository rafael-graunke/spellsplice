import React from 'react';
import FileDropdown from "./FileDropdown";
import EditDropdown from "./EditDropdown";
import HelpDropdown from "./HelpDropdown";
import ChannelMenu from "./ChannelMenu";

type Mode = 'welcome' | 'timeline' | 'live';

interface AppBarProps {
    mode: Mode;
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
    onExportVideo: () => void;
    onOpenSettings: () => void;
    onRelinkMedia: () => void;
    onOpenLiveSettings: () => void;
}

// Non-production builds tint the bar so a beta window is never mistaken for
// production at a glance -- both are the same app on near-identical URLs.
// Hues match the semantic badges in ChannelMenu (amber = caution, blue =
// local). Stable gets no tint: production is the default, unremarkable state.
// The per-channel badge + switcher lives in ChannelMenu.
const CHANNEL_BAR: Record<string, string> = {
    beta: 'bg-amber-500/10 border-amber-500/40',
    dev: 'bg-blue-500/10 border-blue-500/40',
};

function AppBar({ mode, isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings, onRelinkMedia, onOpenLiveSettings }: AppBarProps) {
    const barTint = CHANNEL_BAR[__APP_CHANNEL__];

    return (
        <div className={`w-full h-8 border-b flex items-center ${barTint ?? 'border-bg'}`}>
            <FileDropdown mode={mode} isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} onExportVideo={onExportVideo} onOpenSettings={onOpenSettings} onRelinkMedia={onRelinkMedia} onOpenLiveSettings={onOpenLiveSettings} />
            <EditDropdown />
            <HelpDropdown />
            <ChannelMenu />
        </div>
    );
}

export default React.memo(AppBar);
