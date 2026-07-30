import { useEffect, useRef, useState } from 'react';
import { modKey } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Mode = 'welcome' | 'timeline' | 'live';

interface FileDropdownProps {
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

function FileDropdown({ mode, isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings, onRelinkMedia, onOpenLiveSettings }: FileDropdownProps) {
    const importRef = useRef<HTMLInputElement>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const guardDirty = (action: () => void) => {
        if (isDirty) setPendingAction(() => action);
        else action();
    };

    const handleNew = () => (mode === 'timeline' ? guardDirty(onNew) : onNew());
    const handleOpen = () => guardDirty(() => importRef.current?.click());

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (mode === 'timeline' && e.ctrlKey && !e.altKey && e.code === 'KeyS') {
                e.preventDefault();
                onExport();
            } else if (mode === 'timeline' && e.ctrlKey && !e.altKey && e.code === 'KeyO') {
                e.preventDefault();
                if (isDirty) setPendingAction(() => () => importRef.current?.click());
                else importRef.current?.click();
            } else if (mode !== 'welcome' && e.ctrlKey && e.altKey && e.code === 'KeyN') {
                e.preventDefault();
                if (mode === 'timeline' && isDirty) setPendingAction(() => onNew);
                else onNew();
            } else if (mode === 'timeline' && e.ctrlKey && !e.altKey && e.code === 'Comma') {
                e.preventDefault();
                onOpenSettings();
            } else if (mode === 'live' && e.ctrlKey && !e.altKey && e.code === 'Comma') {
                e.preventDefault();
                onOpenLiveSettings();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [mode, isDirty, onExport, onNew, onOpenSettings, onOpenLiveSettings]);

    return (
        <>
            <input
                ref={importRef}
                type="file"
                accept=".sps"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport(file);
                    e.target.value = '';
                }}
            />

            <Dialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Unsaved changes</DialogTitle>
                        <DialogDescription>
                            This project has unsaved changes. Discard and continue?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingAction(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => { pendingAction?.(); setPendingAction(null); }}
                        >
                            Discard
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {mode === 'welcome' ? (
                <Button variant="ghost" disabled>File</Button>
            ) : (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost">File</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48">
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={handleNew}>
                                New...<DropdownMenuShortcut>{modKey}+Alt+N</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            {mode === 'timeline' && (
                                <>
                                    <DropdownMenuItem onClick={handleOpen}>
                                        Open...<DropdownMenuShortcut>{modKey}+O</DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onExport}>
                                        Save<DropdownMenuShortcut>{modKey}+S</DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onOpenSettings}>
                                        Settings<DropdownMenuShortcut>{modKey}+,</DropdownMenuShortcut>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onRelinkMedia}>Relink Media...</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={onExportVideo}>Export...</DropdownMenuItem>
                                </>
                            )}
                            {mode === 'live' && (
                                <DropdownMenuItem onClick={onOpenLiveSettings}>
                                    Settings...<DropdownMenuShortcut>{modKey}+,</DropdownMenuShortcut>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </>
    );
}

export default FileDropdown;
