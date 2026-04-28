import FileDropdown from "./FileDropdown";

interface AppBarProps {
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
    onExportVideo: () => void;
}

function AppBar({ isDirty, onNew, onExport, onImport, onExportVideo }: AppBarProps) {
    return (
        <div className="w-full h-8 border-b border-bg">
            <FileDropdown isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} onExportVideo={onExportVideo} />
        </div>
    );
}

export default AppBar;
