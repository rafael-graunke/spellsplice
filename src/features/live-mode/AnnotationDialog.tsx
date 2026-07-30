import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface AnnotationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    onSave: (title: string, description: string) => void;
    onDelete?: () => void;
}

export function AnnotationDialog({
    open,
    onOpenChange,
    title,
    description,
    onSave,
    onDelete,
}: AnnotationDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {onDelete ? 'Edit Annotation' : 'New Annotation'}
                    </DialogTitle>
                </DialogHeader>
                {open && (
                    <AnnotationDialogFields
                        title={title ?? ''}
                        description={description ?? ''}
                        onSave={onSave}
                        onDelete={onDelete}
                        onOpenChange={onOpenChange}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

interface AnnotationDialogFieldsProps {
    title: string;
    description: string;
    onSave: (title: string, description: string) => void;
    onDelete?: () => void;
    onOpenChange: (open: boolean) => void;
}

function AnnotationDialogFields({
    title,
    description,
    onSave,
    onDelete,
    onOpenChange,
}: AnnotationDialogFieldsProps) {
    const [titleDraft, setTitleDraft] = useState(title);
    const [descriptionDraft, setDescriptionDraft] = useState(description);

    const handleSave = () => {
        const trimmed = titleDraft.trim();
        if (!trimmed) return;
        onSave(trimmed, descriptionDraft.trim());
        onOpenChange(false);
    };

    const handleDelete = () => {
        onDelete?.();
        onOpenChange(false);
    };

    return (
        <>
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">Title</p>
                    <Input
                        autoFocus
                        value={titleDraft}
                        placeholder="Annotation name…"
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                        }}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium">Description</p>
                    <Textarea
                        value={descriptionDraft}
                        placeholder="Optional description…"
                        className="min-h-20 resize-y"
                        onChange={(e) => setDescriptionDraft(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter
                className={onDelete ? 'sm:justify-between' : undefined}
            >
                {onDelete && (
                    <Button
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={handleDelete}
                    >
                        Delete
                    </Button>
                )}
                <Button
                    className="cursor-pointer"
                    onClick={handleSave}
                    disabled={!titleDraft.trim()}
                >
                    Save
                </Button>
            </DialogFooter>
        </>
    );
}
