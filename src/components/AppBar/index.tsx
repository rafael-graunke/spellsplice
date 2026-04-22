import FileDropdown from "./FileDropdown";

interface AppBarProps {
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
}

function AppBar({ isDirty, onNew, onExport, onImport }: AppBarProps) {
    return (
        <div className="w-full h-8 border-b border-bg">
            <FileDropdown isDirty={isDirty} onNew={onNew} onExport={onExport} onImport={onImport} />
        </div>
    );
}

export default AppBar;
