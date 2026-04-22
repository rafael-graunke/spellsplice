import { useRef, useState } from 'react';
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
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileDropdownProps {
    isDirty: boolean;
    onNew: () => void;
    onExport: () => Promise<void>;
    onImport: (file: File) => void;
}

function FileDropdown({ isDirty, onNew, onExport, onImport }: FileDropdownProps) {
    const importRef = useRef<HTMLInputElement>(null);
    const [showNewModal, setShowNewModal] = useState(false);

    const handleNew = () => {
        if (isDirty) setShowNewModal(true);
        else onNew();
    };

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

            <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
                <DialogContent showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>Unsaved changes</DialogTitle>
                        <DialogDescription>
                            This project has unsaved changes. Save before creating a new project?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowNewModal(false); onNew(); }}>
                            Discard
                        </Button>
                        <Button
                            onClick={async () => {
                                await onExport();
                                setShowNewModal(false);
                                onNew();
                            }}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">File</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={handleNew}>New...</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => importRef.current?.click()}>
                            Open...
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={onExport}>
                                        Project
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem disabled>Video</DropdownMenuItem>
                                    <DropdownMenuItem disabled>Overlay</DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export default FileDropdown;
