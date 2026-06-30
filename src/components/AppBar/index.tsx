import React from 'react';
import FileDropdown from "./FileDropdown";
import EditDropdown from "./EditDropdown";
import HelpDropdown from "./HelpDropdown";

interface AppBarProps {
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
    onExportVideo: () => void;
    onOpenSettings: () => void;
    onRelinkMedia: () => void;
}

function AppBar({ isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings, onRelinkMedia }: AppBarProps) {
    return (
        <div className="w-full h-8 border-b border-bg flex items-center">
            <FileDropdown isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} onExportVideo={onExportVideo} onOpenSettings={onOpenSettings} onRelinkMedia={onRelinkMedia} />
            <EditDropdown />
            <HelpDropdown />
            <span className="ml-auto px-3 text-xs text-muted-foreground select-none">v{__APP_VERSION__}</span>
        </div>
    );
}

export default React.memo(AppBar);
