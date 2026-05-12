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

interface FileDropdownProps {
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
    onExportVideo: () => void;
    onOpenSettings: () => void;
}

function FileDropdown({ isDirty, onNew, onExport, onImport, onExportVideo, onOpenSettings }: FileDropdownProps) {
    const importRef = useRef<HTMLInputElement>(null);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const guardDirty = (action: () => void) => {
        if (isDirty) setPendingAction(() => action);
        else action();
    };

    const handleNew = () => guardDirty(onNew);
    const handleOpen = () => guardDirty(() => importRef.current?.click());

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && !e.altKey && e.code === 'KeyS') {
                e.preventDefault();
                onExport();
            } else if (e.ctrlKey && !e.altKey && e.code === 'KeyO') {
                e.preventDefault();
                if (isDirty) setPendingAction(() => () => importRef.current?.click());
                else importRef.current?.click();
            } else if (e.ctrlKey && e.altKey && e.code === 'KeyN') {
                e.preventDefault();
                if (isDirty) setPendingAction(() => onNew);
                else onNew();
            } else if (e.ctrlKey && !e.altKey && e.code === 'Comma') {
                e.preventDefault();
                onOpenSettings();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isDirty, onExport, onNew, onOpenSettings]);

    return (
        <>
            <input
                ref={importRef}
                type="file"
                accept=".spellsplice"
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

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">File</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={handleNew}>
                            New...<DropdownMenuShortcut>{modKey}+Alt+N</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleOpen}>
                            Open...<DropdownMenuShortcut>{modKey}+O</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onExport}>
                            Save<DropdownMenuShortcut>{modKey}+S</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onOpenSettings}>
                            Settings<DropdownMenuShortcut>{modKey}+,</DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onExportVideo}>Export...</DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export default FileDropdown;
