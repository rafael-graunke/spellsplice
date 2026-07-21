import React from 'react';
import FileDropdown from "./FileDropdown";
import EditDropdown from "./EditDropdown";
import HelpDropdown from "./HelpDropdown";

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
// Colours are taken from logo.svg: violet #9425cc / #4a1570, gold #e3a567.
const CHANNEL_STYLES: Record<string, { bar: string; badge: string; label: string }> = {
    beta: {
        bar: 'bg-[#9425cc]/10 border-[#9425cc]/40',
        badge: 'bg-[#9425cc]/20 text-[#4a1570] dark:text-[#d9a3f0]',
        label: 'BETA',
    },
    dev: {
        bar: 'bg-[#e3a567]/10 border-[#e3a567]/40',
        badge: 'bg-[#e3a567]/25 text-[#8a5a22] dark:text-[#eeb47b]',
        label: 'DEV',
    },
};

function AppBar({ mode, isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings, onRelinkMedia, onOpenLiveSettings }: AppBarProps) {
    const channel = CHANNEL_STYLES[__APP_CHANNEL__];

    return (
        <div className={`w-full h-8 border-b flex items-center ${channel ? channel.bar : 'border-bg'}`}>
            <FileDropdown mode={mode} isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} onExportVideo={onExportVideo} onOpenSettings={onOpenSettings} onRelinkMedia={onRelinkMedia} onOpenLiveSettings={onOpenLiveSettings} />
            <EditDropdown />
            <HelpDropdown />
            <span className="ml-auto flex items-center gap-2 px-3 select-none">
                {channel && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${channel.badge}`}>
                        {channel.label}
                    </span>
                )}
                <span className="text-xs text-muted-foreground">v{__APP_VERSION__}</span>
            </span>
        </div>
    );
}

export default React.memo(AppBar);
