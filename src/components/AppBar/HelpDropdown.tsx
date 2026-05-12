import { useState } from 'react';
import { modKey } from '@/lib/platform';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SHORTCUT_GROUPS = [
    {
        label: 'File',
        shortcuts: [
            { keys: [`${modKey}+S`], description: 'Save project' },
            { keys: [`${modKey}+O`], description: 'Open project' },
            { keys: [`${modKey}+Alt+N`], description: 'New project' },
        ],
    },
    {
        label: 'Playback',
        shortcuts: [
            { keys: ['Space'], description: 'Play / Pause' },
            { keys: ['←', '→'], description: 'Seek ±1 second' },
            { keys: [`${modKey}+←`, `${modKey}+→`], description: 'Seek ±1 frame (30 fps)' },
        ],
    },
    {
        label: 'Timeline',
        shortcuts: [
            { keys: [`${modKey}+K`], description: 'Create event' },
            { keys: [`${modKey}+Scroll`], description: 'Zoom in / out' },
            { keys: [`${modKey}+C`], description: 'Copy selected events' },
            { keys: [`${modKey}+V`], description: 'Paste events' },
            { keys: [`${modKey}+Z`], description: 'Undo' },
            { keys: [`${modKey}+Shift+Z`, `${modKey}+Y`], description: 'Redo' },
            { keys: ['Del', 'Backspace'], description: 'Delete selected events' },
            { keys: [`${modKey}+Click`], description: 'Multi-select event' },
            { keys: ['Tab'], description: 'Cycle active player' },
        ],
    },
];

function ShortcutRow({ keys, description }: { keys: string[]; description: string }) {
    return (
        <div className="flex items-center justify-between gap-8 py-1 border-b border-border">
            <span className="text-sm text-muted-foreground">{description}</span>
            <div className="flex gap-1 shrink-0">
                {keys.map((k, i) => (
                    <span key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-xs text-muted-foreground">/</span>}
                        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">{k}</kbd>
                    </span>
                ))}
            </div>
        </div>
    );
}

function HelpDropdown() {
    const [shortcutsOpen, setShortcutsOpen] = useState(false);

    return (
        <>
            <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Keyboard Shortcuts</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-2">
                        {SHORTCUT_GROUPS.map((group) => (
                            <div key={group.label}>
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-foreground">
                                    {group.label}
                                </p>
                                {group.shortcuts.map((s) => (
                                    <ShortcutRow key={s.description} keys={s.keys} description={s.description} />
                                ))}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost">Help</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48">
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
                            Shortcuts
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </>
    );
}

export default HelpDropdown;
