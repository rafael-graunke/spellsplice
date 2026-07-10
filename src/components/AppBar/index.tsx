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

function AppBar({ mode, isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings, onRelinkMedia, onOpenLiveSettings }: AppBarProps) {
    return (
        <div className="w-full h-8 border-b border-bg flex items-center">
            <FileDropdown mode={mode} isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} onExportVideo={onExportVideo} onOpenSettings={onOpenSettings} onRelinkMedia={onRelinkMedia} onOpenLiveSettings={onOpenLiveSettings} />
            <EditDropdown />
            <HelpDropdown />
            <span className="ml-auto px-3 text-xs text-muted-foreground select-none">v{__APP_VERSION__}</span>
        </div>
    );
}

export default React.memo(AppBar);
